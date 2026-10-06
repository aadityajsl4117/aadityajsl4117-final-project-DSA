import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import {
  LibraryState, Book, Member, Transaction, Fine, Payment, Reservation,
  EmailLog, AuditEntry, RestockRequest, Deposit, UndoAction,
  AutomationResult, DashboardMetrics, Review,
  BookStatus, CopyStatus, MemberStatus, MemberType, VerificationStatus,
  TransactionStatus, FineStatus, PaymentMethod, PaymentStatus,
  ReservationStatus, RestockStatus, DepositStatus,
  EmailType, EmailDeliveryStatus, AuditAction
} from '../types';
import { SEED_BOOKS, SEED_MEMBERS } from '../utils/seedData';
import { StorageService } from '../services/StorageService';
import { EmailService } from '../services/EmailService';
import { MemberService } from '../services/MemberService';
import { BookService } from '../services/BookService';
import { CirculationService } from '../services/CirculationService';
import { ReservationService } from '../services/ReservationService';
import { FineService } from '../services/FineService';
import { PaymentService } from '../services/PaymentService';
import { DepositService } from '../services/DepositService';
import { RestockService } from '../services/RestockService';
import { AuditService } from '../services/AuditService';

import { BinarySearchTree } from '../dsa/BinarySearchTree';
import { LinkedList } from '../dsa/LinkedList';
import { FIFOQueue } from '../dsa/FIFOQueue';
import { UndoStack } from '../dsa/UndoStack';

import { generateId, isOverdue, daysUntilDue, calculateFine, formatDate } from '../utils/helpers';
import { DAILY_FINE_RATE, DEFAULT_BORROW_DAYS, RESERVATION_EXPIRY_HOURS, RESTOCK_THRESHOLD, DUE_REMINDER_DAYS } from '../utils/constants';

// ======== Context Type ========
export interface LibraryContextType {
  state: LibraryState;
  addBook: (book: Partial<Book>) => void;
  updateBook: (bookId: string, updates: Partial<Book>) => void;
  searchBooks: (query: string) => Book[];
  getBook: (bookId: string) => Book | undefined;
  registerMember: (data: Partial<Member>) => Promise<{ success: boolean; member?: Member; error?: string; emailLog?: EmailLog }>;
  updateMember: (memberId: string, updates: Partial<Member>) => Promise<{ success: boolean; member?: Member; emailLog?: EmailLog }>;
  verifyMember: (memberId: string) => Promise<{ success: boolean; emailLog?: EmailLog }>;
  rejectMember: (memberId: string, reason: string) => Promise<{ success: boolean; emailLog?: EmailLog }>;
  getMember: (memberId: string) => Member | undefined;
  searchMembers: (query: string) => Member[];
  getNextMemberID: () => string;
  borrowBook: (bookId: string, memberId: string) => Promise<{ success: boolean; transaction?: Transaction; error?: string; emailLog?: EmailLog }>;
  returnBook: (transactionId: string, condition: string) => Promise<{ success: boolean; transaction?: Transaction; fine?: Fine | null; error?: string; emailLog?: EmailLog }>;
  reserveBook: (bookId: string, memberId: string) => Promise<{ success: boolean; reservation?: Reservation; error?: string; emailLog?: EmailLog }>;
  cancelReservation: (reservationId: string) => void;
  payFine: (fineId: string, method: PaymentMethod) => Promise<{ success: boolean; payment?: Payment; error?: string; emailLog?: EmailLog }>;
  waiveFine: (fineId: string) => void;
  createDeposit: (memberId: string, amount: number) => Promise<{ success: boolean; deposit?: Deposit; emailLog?: EmailLog }>;
  refundDeposit: (depositId: string) => Promise<{ success: boolean; emailLog?: EmailLog }>;
  requestRestock: (bookId: string, copies: number, reason: string) => void;
  approveRestock: (requestId: string) => void;
  receiveRestock: (requestId: string) => void;
  addReview: (bookId: string, memberId: string, rating: number, comment: string) => void;
  runAutomation: () => Promise<AutomationResult>;
  undo: () => void;
  undoStack: UndoAction[];
  getDashboardMetrics: () => DashboardMetrics;
  bookBST: BinarySearchTree<string, Book>;
  transactionHistory: LinkedList<Transaction>;
  reservationQueues: Map<string, FIFOQueue<Reservation>>;
}

const defaultState: LibraryState = {
  books: [],
  members: [],
  transactions: [],
  fines: [],
  payments: [],
  reservations: [],
  emailLogs: [],
  auditLog: [],
  restockRequests: [],
  deposits: [],
  lastAutomationRun: null,
  dailyFineRate: DAILY_FINE_RATE,
  defaultBorrowDays: DEFAULT_BORROW_DAYS,
  reservationExpiryHours: RESERVATION_EXPIRY_HOURS,
  restockThreshold: RESTOCK_THRESHOLD,
};

export const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<LibraryState>(defaultState);

  const bookBSTRef = useRef(new BinarySearchTree<string, Book>());
  const transactionHistoryRef = useRef(new LinkedList<Transaction>());
  const reservationQueuesRef = useRef(new Map<string, FIFOQueue<Reservation>>());
  const undoStackRef = useRef(new UndoStack());
  const isInitialized = useRef(false);

  // ======== Initialize ========
  useEffect(() => {
    if (isInitialized.current) return;
    const loaded = StorageService.load();
    const initial = loaded || { ...defaultState, books: SEED_BOOKS, members: SEED_MEMBERS };
    setState(initial);
    rebuildDSA(initial);
    if (!loaded) StorageService.save(initial);
    isInitialized.current = true;
  }, []);

  // ======== Persist ========
  useEffect(() => {
    if (isInitialized.current) {
      StorageService.save(state);
    }
  }, [state]);

  // ======== DSA Rebuild ========
  const rebuildDSA = (s: LibraryState) => {
    bookBSTRef.current = new BinarySearchTree<string, Book>();
    s.books.forEach(b => bookBSTRef.current.insert(b.id, b));

    transactionHistoryRef.current = new LinkedList<Transaction>();
    s.transactions.forEach(t => transactionHistoryRef.current.append(t));

    reservationQueuesRef.current = new Map();
    s.reservations
      .filter(r => r.status === ReservationStatus.WAITING)
      .forEach(r => {
        let q = reservationQueuesRef.current.get(r.bookId);
        if (!q) { q = new FIFOQueue<Reservation>(); reservationQueuesRef.current.set(r.bookId, q); }
        q.enqueue(r);
      });
  };

  // ======== Helpers ========
  const addAudit = (action: AuditAction, entityType: string, entityId: string, description: string, oldValue?: string, newValue?: string) => {
    const entry = AuditService.createEntry(action, entityType, entityId, 'Librarian', description, oldValue, newValue);
    setState(prev => ({ ...prev, auditLog: [...prev.auditLog, entry] }));
  };

  const addEmailLog = (log: EmailLog) => {
    setState(prev => ({ ...prev, emailLogs: [...prev.emailLogs, log] }));
  };

  const pushUndo = (action: string, description: string, undoFn: () => void) => {
    const undoAction: UndoAction = {
      id: generateId('UNDO'),
      action,
      description,
      timestamp: new Date().toISOString(),
      undoFn,
      canUndo: true,
    };
    undoStackRef.current.push(undoAction);
  };

  // ======== Book Operations ========
  const addBook = (bookData: Partial<Book>) => {
    const newBook = BookService.createBook(bookData);
    setState(prev => ({ ...prev, books: [...prev.books, newBook] }));
    bookBSTRef.current.insert(newBook.id, newBook);
    addAudit(AuditAction.ADD_BOOK, 'Book', newBook.id, `Added book: ${newBook.title}`);
    pushUndo('ADD_BOOK', `Added ${newBook.title}`, () => {
      setState(prev => ({ ...prev, books: prev.books.filter(b => b.id !== newBook.id) }));
    });
  };

  const updateBook = (bookId: string, updates: Partial<Book>) => {
    const old = getBook(bookId);
    if (!old) return;
    setState(prev => ({
      ...prev,
      books: prev.books.map(b => b.id === bookId ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b),
    }));
    const updated = { ...old, ...updates };
    bookBSTRef.current.delete(bookId);
    bookBSTRef.current.insert(bookId, updated);
    addAudit(AuditAction.UPDATE_BOOK, 'Book', bookId, `Updated book: ${old.title}`);
  };

  const searchBooks = (query: string): Book[] => {
    return BookService.searchBooks(state.books, query);
  };

  const getBook = (bookId: string): Book | undefined => {
    return bookBSTRef.current.search(bookId) ?? state.books.find(b => b.id === bookId);
  };

  // ======== Member Operations ========
  const registerMember = async (data: Partial<Member>): Promise<{ success: boolean; member?: Member; error?: string; emailLog?: EmailLog }> => {
    const validation = MemberService.validateMember(data);
    if (!validation.valid) return { success: false, error: validation.errors.join(', ') };

    const dup = MemberService.checkDuplicate(state.members, data.id || '', data.email || '');
    if (dup.isDuplicate) return { success: false, error: dup.reason };

    const newMember = MemberService.createMember(data, state.members);

    setState(prev => ({ ...prev, members: [...prev.members, newMember] }));
    addAudit(AuditAction.REGISTER_MEMBER, 'Member', newMember.id, `Registered member: ${newMember.fullName}`);
    pushUndo('REGISTER_MEMBER', `Registered ${newMember.fullName}`, () => {
      setState(prev => ({ ...prev, members: prev.members.filter(m => m.id !== newMember.id) }));
    });

    // Automatic email - never breaks registration
    let emailLog: EmailLog | undefined;
    try {
      emailLog = await EmailService.sendAutomaticEmail({
        member: newMember,
        type: EmailType.REGISTRATION,
        data: {
          department: newMember.department,
          year: newMember.year,
          phone: newMember.phone,
          address: newMember.address,
          registrationDate: newMember.registrationDate,
          borrowLimit: newMember.borrowLimit,
        },
      });
      addEmailLog(emailLog);
      addAudit(
        emailLog.status === EmailDeliveryStatus.DELIVERED ? AuditAction.EMAIL_SENT : AuditAction.EMAIL_FAILED,
        'Email', emailLog.id, `Registration email ${emailLog.status.toLowerCase()} for ${newMember.fullName}`
      );
    } catch (e) { /* Email failure never breaks registration */ }

    return { success: true, member: newMember, emailLog };
  };

  const updateMember = async (memberId: string, updates: Partial<Member>): Promise<{ success: boolean; member?: Member; emailLog?: EmailLog }> => {
    const existing = getMember(memberId);
    if (!existing) return { success: false };

    const updated = MemberService.updateMember(existing, updates);
    setState(prev => ({ ...prev, members: prev.members.map(m => m.id === memberId ? updated : m) }));
    addAudit(AuditAction.UPDATE_MEMBER, 'Member', memberId, `Updated member: ${updated.fullName}`);
    pushUndo('UPDATE_MEMBER', `Updated ${updated.fullName}`, () => {
      setState(prev => ({ ...prev, members: prev.members.map(m => m.id === memberId ? existing : m) }));
    });

    let emailLog: EmailLog | undefined;
    try {
      emailLog = await EmailService.sendAutomaticEmail({
        member: updated,
        type: EmailType.PROFILE_UPDATE,
        data: { updatedDate: new Date().toISOString() },
      });
      addEmailLog(emailLog);
    } catch (e) { /* silent */ }

    return { success: true, member: updated, emailLog };
  };

  const verifyMember = async (memberId: string): Promise<{ success: boolean; emailLog?: EmailLog }> => {
    const member = getMember(memberId);
    if (!member) return { success: false };

    setState(prev => ({
      ...prev,
      members: prev.members.map(m => m.id === memberId ? { ...m, verification: VerificationStatus.VERIFIED, updatedAt: new Date().toISOString() } : m),
    }));
    addAudit(AuditAction.VERIFY_MEMBER, 'Member', memberId, `Verified member: ${member.fullName}`);

    let emailLog: EmailLog | undefined;
    try {
      emailLog = await EmailService.sendAutomaticEmail({
        member,
        type: EmailType.MEMBER_VERIFIED,
        data: { verificationDate: new Date().toISOString() },
      });
      addEmailLog(emailLog);
    } catch (e) { /* silent */ }

    return { success: true, emailLog };
  };

  const rejectMember = async (memberId: string, reason: string): Promise<{ success: boolean; emailLog?: EmailLog }> => {
    const member = getMember(memberId);
    if (!member) return { success: false };

    setState(prev => ({
      ...prev,
      members: prev.members.map(m => m.id === memberId ? { ...m, verification: VerificationStatus.REJECTED, updatedAt: new Date().toISOString() } : m),
    }));
    addAudit(AuditAction.REJECT_MEMBER, 'Member', memberId, `Rejected member: ${member.fullName}. Reason: ${reason}`);

    let emailLog: EmailLog | undefined;
    try {
      emailLog = await EmailService.sendAutomaticEmail({
        member,
        type: EmailType.MEMBER_REJECTED,
        data: { reason },
      });
      addEmailLog(emailLog);
    } catch (e) { /* silent */ }

    return { success: true, emailLog };
  };

  const getMember = (memberId: string): Member | undefined => state.members.find(m => m.id === memberId);

  const searchMembers = (query: string): Member[] => {
    const q = query.toLowerCase();
    return state.members.filter(m =>
      m.fullName.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.phone.includes(q)
    );
  };

  const getNextMemberID = (): string => MemberService.getNextMemberID(state.members);

  // ======== Circulation ========
  const borrowBook = async (bookId: string, memberId: string): Promise<{ success: boolean; transaction?: Transaction; error?: string; emailLog?: EmailLog }> => {
    const book = getBook(bookId);
    const member = getMember(memberId);
    if (!book || !member) return { success: false, error: 'Book or member not found' };

    const validation = CirculationService.validateBorrow(book, member, state.transactions, state.reservations, state.fines);
    if (!validation.valid) return { success: false, error: validation.errors.join(', ') };

    const availCopy = BookService.findAvailableCopy(book);
    if (!availCopy) return { success: false, error: 'No available copy found' };

    const result = CirculationService.createBorrowTransaction(book, member, availCopy.copyId, state.defaultBorrowDays);

    setState(prev => ({
      ...prev,
      transactions: [...prev.transactions, result.transaction],
      books: prev.books.map(b => b.id === bookId ? result.updatedBook : b),
      members: prev.members.map(m => m.id === memberId ? result.updatedMember : m),
    }));

    transactionHistoryRef.current.append(result.transaction);
    bookBSTRef.current.delete(bookId);
    bookBSTRef.current.insert(bookId, result.updatedBook);

    addAudit(AuditAction.ISSUE_BOOK, 'Transaction', result.transaction.id,
      `Issued "${book.title}" to ${member.fullName} (Due: ${formatDate(result.transaction.dueDate)})`);

    // Check if member had a reservation for this book - fulfill it
    const memberRes = state.reservations.find(
      r => r.bookId === bookId && r.memberId === memberId && (r.status === ReservationStatus.WAITING || r.status === ReservationStatus.AVAILABLE)
    );
    if (memberRes) {
      setState(prev => ({
        ...prev,
        reservations: prev.reservations.map(r => r.id === memberRes.id
          ? { ...r, status: ReservationStatus.FULFILLED, fulfilledAt: new Date().toISOString() }
          : r),
      }));
    }

    let emailLog: EmailLog | undefined;
    try {
      emailLog = await EmailService.sendAutomaticEmail({
        member,
        type: EmailType.BOOK_BORROWED,
        data: {
          book_name: book.title,
          book_id: book.id,
          transaction_id: result.transaction.id,
          issue_date: result.transaction.issueDate,
          return_date: result.transaction.dueDate,
          shelf: book.shelf,
          borrowLimit: member.borrowLimit,
          transactionId: result.transaction.id,
        },
      });
      addEmailLog(emailLog);
    } catch (e) { /* silent */ }

    return { success: true, transaction: result.transaction, emailLog };
  };

  const returnBook = async (transactionId: string, condition: string): Promise<{ success: boolean; transaction?: Transaction; fine?: Fine | null; error?: string; emailLog?: EmailLog }> => {
    const txn = state.transactions.find(t => t.id === transactionId);
    if (!txn || txn.status === TransactionStatus.RETURNED) return { success: false, error: 'Transaction not found or already returned' };

    const book = getBook(txn.bookId);
    const member = getMember(txn.memberId);
    if (!book || !member) return { success: false, error: 'Related book or member not found' };

    const result = CirculationService.processReturn(txn, book, member, condition, state.dailyFineRate);

    setState(prev => {
      const next = {
        ...prev,
        transactions: prev.transactions.map(t => t.id === transactionId ? result.updatedTransaction : t),
        books: prev.books.map(b => b.id === book.id ? result.updatedBook : b),
        members: prev.members.map(m => m.id === member.id ? result.updatedMember : m),
      };
      if (result.fine) {
        next.fines = [...prev.fines, result.fine];
      }
      return next;
    });

    bookBSTRef.current.delete(book.id);
    bookBSTRef.current.insert(book.id, result.updatedBook);

    addAudit(AuditAction.RETURN_BOOK, 'Transaction', transactionId,
      `Returned "${book.title}" by ${member.fullName}${result.fine ? ` (Fine: ₹${result.fine.amount})` : ''}`);

    if (result.fine) {
      addAudit(AuditAction.CREATE_FINE, 'Fine', result.fine.id,
        `Fine of ₹${result.fine.amount} for ${result.fine.daysOverdue} days overdue on "${book.title}"`);
    }

    // FIFO queue promotion
    const waitingRes = state.reservations
      .filter(r => r.bookId === book.id && r.status === ReservationStatus.WAITING)
      .sort((a, b) => a.position - b.position);

    if (waitingRes.length > 0) {
      const nextRes = waitingRes[0];
      const now = new Date();
      const expiry = new Date(now.getTime() + state.reservationExpiryHours * 60 * 60 * 1000);

      setState(prev => ({
        ...prev,
        reservations: prev.reservations.map(r => r.id === nextRes.id
          ? { ...r, status: ReservationStatus.AVAILABLE, availableAt: now.toISOString(), expiresAt: expiry.toISOString() }
          : r),
      }));

      addAudit(AuditAction.PROMOTE_RESERVATION, 'Reservation', nextRes.id,
        `Book "${book.title}" available for ${nextRes.memberName}`);

      // Send reservation available email
      const resMember = getMember(nextRes.memberId);
      if (resMember) {
        try {
          const resEmail = await EmailService.sendAutomaticEmail({
            member: resMember,
            type: EmailType.RESERVATION_AVAILABLE,
            data: { book_name: book.title, book_id: book.id, available_since: now.toISOString(), claim_deadline: expiry.toISOString() },
          });
          addEmailLog(resEmail);
        } catch (e) { /* silent */ }
      }
    }

    // Send return email
    let emailLog: EmailLog | undefined;
    try {
      emailLog = await EmailService.sendAutomaticEmail({
        member,
        type: EmailType.BOOK_RETURNED,
        data: {
          book_name: book.title,
          book_id: book.id,
          transaction_id: transactionId,
          return_date: result.updatedTransaction.returnDate,
          condition,
          fine_amount: result.fine?.amount || 0,
          has_fine: !!result.fine,
          transactionId,
        },
      });
      addEmailLog(emailLog);
    } catch (e) { /* silent */ }

    return { success: true, transaction: result.updatedTransaction, fine: result.fine, emailLog };
  };

  // ======== Reservations ========
  const reserveBook = async (bookId: string, memberId: string): Promise<{ success: boolean; reservation?: Reservation; error?: string; emailLog?: EmailLog }> => {
    const book = getBook(bookId);
    const member = getMember(memberId);
    if (!book || !member) return { success: false, error: 'Book or member not found' };

    if (ReservationService.hasActiveReservation(state.reservations, bookId, memberId)) {
      return { success: false, error: 'You already have an active reservation for this book' };
    }

    const reservation = ReservationService.createReservation(bookId, book.title, memberId, member.fullName, state.reservations);

    setState(prev => ({ ...prev, reservations: [...prev.reservations, reservation] }));

    let q = reservationQueuesRef.current.get(bookId);
    if (!q) { q = new FIFOQueue<Reservation>(); reservationQueuesRef.current.set(bookId, q); }
    q.enqueue(reservation);

    addAudit(AuditAction.CREATE_RESERVATION, 'Reservation', reservation.id,
      `${member.fullName} reserved "${book.title}" (Position: #${reservation.position})`);

    pushUndo('RESERVE_BOOK', `Reserved ${book.title} for ${member.fullName}`, () => {
      setState(prev => ({ ...prev, reservations: prev.reservations.filter(r => r.id !== reservation.id) }));
    });

    let emailLog: EmailLog | undefined;
    try {
      emailLog = await EmailService.sendAutomaticEmail({
        member,
        type: EmailType.RESERVATION_CREATED,
        data: { book_name: book.title, book_id: bookId, position: reservation.position, reservation_date: reservation.reservedAt },
      });
      addEmailLog(emailLog);
    } catch (e) { /* silent */ }

    return { success: true, reservation, emailLog };
  };

  const cancelReservation = (reservationId: string) => {
    const res = state.reservations.find(r => r.id === reservationId);
    if (!res) return;
    setState(prev => ({
      ...prev,
      reservations: prev.reservations.map(r => r.id === reservationId ? { ...r, status: ReservationStatus.CANCELLED } : r),
    }));
    const q = reservationQueuesRef.current.get(res.bookId);
    if (q) q.removeByPredicate(r => r.id === reservationId);
    addAudit(AuditAction.CANCEL_RESERVATION, 'Reservation', reservationId, `Cancelled reservation for "${res.bookTitle}"`);
  };

  // ======== Fines & Payments ========
  const payFine = async (fineId: string, method: PaymentMethod): Promise<{ success: boolean; payment?: Payment; error?: string; emailLog?: EmailLog }> => {
    const fine = state.fines.find(f => f.id === fineId);
    if (!fine || fine.status === FineStatus.PAID) return { success: false, error: 'Fine not found or already paid' };

    const { payment, updatedFine } = PaymentService.processPayment(fine, method);

    setState(prev => ({
      ...prev,
      fines: prev.fines.map(f => f.id === fineId ? updatedFine : f),
      payments: [...prev.payments, payment],
    }));

    addAudit(AuditAction.PAY_FINE, 'Payment', payment.id, `Fine ₹${fine.amount} paid via ${method} by ${fine.memberName}`);
    addAudit(AuditAction.PAYMENT_RECEIVED, 'Payment', payment.id, `Payment ₹${payment.amount} received`);

    const member = getMember(fine.memberId);
    let emailLog: EmailLog | undefined;
    if (member) {
      try {
        emailLog = await EmailService.sendAutomaticEmail({
          member,
          type: EmailType.PAYMENT_RECEIPT,
          data: {
            payment_id: payment.id,
            transaction_id: fine.transactionId,
            fine_id: fineId,
            amount: payment.amount,
            payment_method: method,
            date: payment.createdAt,
            transactionId: fine.transactionId,
          },
        });
        addEmailLog(emailLog);
      } catch (e) { /* silent */ }
    }

    return { success: true, payment, emailLog };
  };

  const waiveFine = (fineId: string) => {
    const fine = state.fines.find(f => f.id === fineId);
    if (!fine) return;
    setState(prev => ({ ...prev, fines: prev.fines.map(f => f.id === fineId ? { ...f, status: FineStatus.WAIVED } : f) }));
    addAudit(AuditAction.WAIVE_FINE, 'Fine', fineId, `Waived fine ₹${fine.amount} for ${fine.memberName}`);
  };

  // ======== Deposits ========
  const createDeposit = async (memberId: string, amount: number): Promise<{ success: boolean; deposit?: Deposit; emailLog?: EmailLog }> => {
    const member = getMember(memberId);
    if (!member) return { success: false };

    const deposit = DepositService.createDeposit(memberId, member.fullName, amount);
    setState(prev => ({ ...prev, deposits: [...prev.deposits, deposit] }));
    addAudit(AuditAction.DEPOSIT_RECEIVED, 'Deposit', deposit.id, `Deposit ₹${amount} received from ${member.fullName}`);

    let emailLog: EmailLog | undefined;
    try {
      emailLog = await EmailService.sendAutomaticEmail({
        member,
        type: EmailType.DEPOSIT_RECEIVED,
        data: { amount, deposit_id: deposit.id, date: deposit.receivedAt },
      });
      addEmailLog(emailLog);
    } catch (e) { /* silent */ }

    return { success: true, deposit, emailLog };
  };

  const refundDeposit = async (depositId: string): Promise<{ success: boolean; emailLog?: EmailLog }> => {
    const deposit = state.deposits.find(d => d.id === depositId);
    if (!deposit || deposit.status === DepositStatus.REFUNDED) return { success: false };

    const refunded = DepositService.processRefund(deposit);
    setState(prev => ({ ...prev, deposits: prev.deposits.map(d => d.id === depositId ? refunded : d) }));
    addAudit(AuditAction.DEPOSIT_REFUNDED, 'Deposit', depositId, `Deposit ₹${deposit.amount} refunded to ${deposit.memberName}`);

    const member = getMember(deposit.memberId);
    let emailLog: EmailLog | undefined;
    if (member) {
      try {
        emailLog = await EmailService.sendAutomaticEmail({
          member,
          type: EmailType.DEPOSIT_REFUNDED,
          data: { amount: deposit.amount, deposit_id: depositId, refund_date: refunded.refundedAt },
        });
        addEmailLog(emailLog);
      } catch (e) { /* silent */ }
    }

    return { success: true, emailLog };
  };

  // ======== Restock ========
  const requestRestock = (bookId: string, copies: number, reason: string) => {
    const book = getBook(bookId);
    if (!book) return;
    const resCount = state.reservations.filter(r => r.bookId === bookId && r.status === ReservationStatus.WAITING).length;
    const req = RestockService.createRequest(book, copies, 'Librarian', resCount, reason);
    setState(prev => ({ ...prev, restockRequests: [...prev.restockRequests, req] }));
    addAudit(AuditAction.RESTOCK_REQUEST, 'Restock', req.id, `Restock requested for "${book.title}" (${copies} copies)`);
  };

  const approveRestock = (requestId: string) => {
    const req = state.restockRequests.find(r => r.id === requestId);
    if (!req) return;
    const approved = RestockService.approveRequest(req, 'Librarian');
    setState(prev => ({ ...prev, restockRequests: prev.restockRequests.map(r => r.id === requestId ? approved : r) }));
    addAudit(AuditAction.RESTOCK_APPROVED, 'Restock', requestId, `Restock approved for "${req.bookTitle}"`);
  };

  const receiveRestock = (requestId: string) => {
    const req = state.restockRequests.find(r => r.id === requestId);
    if (!req) return;
    const received = RestockService.markReceived(req);
    setState(prev => {
      const book = prev.books.find(b => b.id === req.bookId);
      if (!book) return { ...prev, restockRequests: prev.restockRequests.map(r => r.id === requestId ? received : r) };

      const newCopies = BookService.generateCopies(book.id, req.requestedCopies, book.shelf);
      const updatedBook: Book = {
        ...book,
        totalCopies: book.totalCopies + req.requestedCopies,
        availableCopies: book.availableCopies + req.requestedCopies,
        copies: [...book.copies, ...newCopies],
      };

      return {
        ...prev,
        restockRequests: prev.restockRequests.map(r => r.id === requestId ? received : r),
        books: prev.books.map(b => b.id === req.bookId ? updatedBook : b),
      };
    });
    addAudit(AuditAction.RESTOCK_RECEIVED, 'Restock', requestId, `${req.requestedCopies} copies received for "${req.bookTitle}"`);
  };

  // ======== Reviews ========
  const addReview = (bookId: string, memberId: string, rating: number, comment: string) => {
    const member = getMember(memberId);
    const book = getBook(bookId);
    if (!member || !book) return;

    const review: Review = {
      id: generateId('REV'),
      bookId,
      memberId,
      memberName: member.fullName,
      rating,
      comment,
      createdAt: new Date().toISOString(),
    };

    setState(prev => ({
      ...prev,
      books: prev.books.map(b => {
        if (b.id !== bookId) return b;
        const newReviews = [...b.reviews, review];
        const avgRating = newReviews.reduce((sum, r) => sum + r.rating, 0) / newReviews.length;
        return { ...b, reviews: newReviews, rating: Math.round(avgRating * 10) / 10 };
      }),
    }));

    addAudit(AuditAction.ADD_REVIEW, 'Review', review.id, `${member.fullName} reviewed "${book.title}" (${rating}/5)`);
  };

  // ======== Automation Engine ========
  const runAutomation = async (): Promise<AutomationResult> => {
    const result: AutomationResult = {
      dueReminders: 0,
      overdueDetected: 0,
      finesGenerated: 0,
      reservationsExpired: 0,
      reservationsPromoted: 0,
      restockAlerts: 0,
      emailsSent: 0,
      emailsFailed: 0,
      timestamp: new Date().toISOString(),
    };

    const now = new Date();
    let updatedTransactions = [...state.transactions];
    let updatedFines = [...state.fines];
    let updatedReservations = [...state.reservations];
    const newEmailLogs: EmailLog[] = [];

    // 1. Due reminders
    for (const txn of updatedTransactions) {
      if (txn.status !== TransactionStatus.ACTIVE) continue;
      const daysLeft = daysUntilDue(txn.dueDate);
      const shouldRemind = DUE_REMINDER_DAYS.includes(daysLeft);

      if (shouldRemind) {
        const today = now.toISOString().split('T')[0];
        const lastReminder = txn.lastReminderSentAt?.split('T')[0];
        if (lastReminder === today) continue; // Already sent today

        const member = getMember(txn.memberId);
        if (member) {
          try {
            const log = await EmailService.sendAutomaticEmail({
              member,
              type: EmailType.DUE_REMINDER,
              data: { book_name: txn.bookTitle, book_id: txn.bookId, due_date: txn.dueDate, days: daysLeft, transaction_id: txn.id },
            });
            newEmailLogs.push(log);
            if (log.status === EmailDeliveryStatus.DELIVERED) result.emailsSent++;
            else result.emailsFailed++;
          } catch (e) { result.emailsFailed++; }
          result.dueReminders++;
        }

        updatedTransactions = updatedTransactions.map(t =>
          t.id === txn.id ? { ...t, lastReminderSentAt: now.toISOString() } : t
        );
      }
    }

    // 2. Overdue detection
    for (const txn of updatedTransactions) {
      if (txn.status !== TransactionStatus.ACTIVE) continue;
      if (!isOverdue(txn.dueDate)) continue;

      updatedTransactions = updatedTransactions.map(t =>
        t.id === txn.id ? { ...t, status: TransactionStatus.OVERDUE } : t
      );

      const { days, amount } = calculateFine(txn.dueDate, state.dailyFineRate);
      const existingFine = updatedFines.find(f => f.transactionId === txn.id && f.status === FineStatus.PENDING);

      if (!existingFine && amount > 0) {
        const fine: Fine = {
          id: generateId('FIN'),
          transactionId: txn.id,
          memberId: txn.memberId,
          memberName: txn.memberName,
          bookId: txn.bookId,
          bookTitle: txn.bookTitle,
          amount,
          daysOverdue: days,
          status: FineStatus.PENDING,
          createdAt: now.toISOString(),
          paidAt: null,
        };
        updatedFines.push(fine);
        result.finesGenerated++;
      }

      result.overdueDetected++;

      const member = getMember(txn.memberId);
      if (member) {
        try {
          const log = await EmailService.sendAutomaticEmail({
            member,
            type: EmailType.OVERDUE,
            data: {
              book_name: txn.bookTitle, book_id: txn.bookId, transaction_id: txn.id,
              due_date: txn.dueDate, days_overdue: days, fine_amount: amount,
            },
          });
          newEmailLogs.push(log);
          if (log.status === EmailDeliveryStatus.DELIVERED) result.emailsSent++;
          else result.emailsFailed++;
        } catch (e) { result.emailsFailed++; }
      }
    }

    // 3. Reservation expiry
    const expiredRes = updatedReservations.filter(
      r => r.status === ReservationStatus.AVAILABLE && r.expiresAt && new Date(r.expiresAt) < now
    );
    for (const res of expiredRes) {
      updatedReservations = updatedReservations.map(r =>
        r.id === res.id ? { ...r, status: ReservationStatus.EXPIRED } : r
      );
      result.reservationsExpired++;

      const member = getMember(res.memberId);
      if (member) {
        try {
          const log = await EmailService.sendAutomaticEmail({
            member,
            type: EmailType.RESERVATION_EXPIRED,
            data: { book_name: res.bookTitle, book_id: res.bookId },
          });
          newEmailLogs.push(log);
          if (log.status === EmailDeliveryStatus.DELIVERED) result.emailsSent++;
          else result.emailsFailed++;
        } catch (e) { result.emailsFailed++; }
      }

      // Promote next in queue
      const nextWaiting = updatedReservations
        .filter(r => r.bookId === res.bookId && r.status === ReservationStatus.WAITING)
        .sort((a, b) => a.position - b.position)[0];

      if (nextWaiting) {
        const expiry = new Date(now.getTime() + state.reservationExpiryHours * 60 * 60 * 1000);
        updatedReservations = updatedReservations.map(r =>
          r.id === nextWaiting.id
            ? { ...r, status: ReservationStatus.AVAILABLE, availableAt: now.toISOString(), expiresAt: expiry.toISOString() }
            : r
        );
        result.reservationsPromoted++;

        const nextMember = getMember(nextWaiting.memberId);
        if (nextMember) {
          try {
            const log = await EmailService.sendAutomaticEmail({
              member: nextMember,
              type: EmailType.RESERVATION_AVAILABLE,
              data: { book_name: nextWaiting.bookTitle, book_id: nextWaiting.bookId },
            });
            newEmailLogs.push(log);
            if (log.status === EmailDeliveryStatus.DELIVERED) result.emailsSent++;
            else result.emailsFailed++;
          } catch (e) { result.emailsFailed++; }
        }
      }
    }

    // 4. Restock alerts
    const restockNeeded = RestockService.checkRestockNeeded(state.books, state.reservations, state.restockThreshold);
    result.restockAlerts = restockNeeded.length;

    // Apply all updates
    setState(prev => ({
      ...prev,
      transactions: updatedTransactions,
      fines: updatedFines,
      reservations: updatedReservations,
      emailLogs: [...prev.emailLogs, ...newEmailLogs],
      lastAutomationRun: now.toISOString(),
    }));

    addAudit(AuditAction.AUTOMATION_RUN, 'System', 'AUTOMATION',
      `Daily automation: ${result.dueReminders} reminders, ${result.overdueDetected} overdue, ${result.finesGenerated} fines, ${result.reservationsExpired} expired, ${result.emailsSent} emails`);

    return result;
  };

  // ======== Undo ========
  const undo = () => {
    const action = undoStackRef.current.pop();
    if (!action || !action.canUndo) return;
    try {
      action.undoFn();
      addAudit(AuditAction.UNDO_ACTION, 'System', action.id, `Undone: ${action.description}`);
    } catch (e) {
      console.error('Undo failed:', e);
    }
  };

  // ======== Dashboard Metrics ========
  const getDashboardMetrics = (): DashboardMetrics => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const todayEmails = state.emailLogs.filter(l => l.createdAt >= todayStr);

    return {
      totalBooks: state.books.length,
      totalCopies: state.books.reduce((s, b) => s + b.totalCopies, 0),
      availableCopies: state.books.reduce((s, b) => s + b.availableCopies, 0),
      borrowedCopies: state.transactions.filter(t => t.status === TransactionStatus.ACTIVE || t.status === TransactionStatus.OVERDUE).length,
      activeMembers: state.members.filter(m => m.status === MemberStatus.ACTIVE).length,
      overdueBooks: state.transactions.filter(t => t.status === TransactionStatus.OVERDUE || (t.status === TransactionStatus.ACTIVE && isOverdue(t.dueDate))).length,
      pendingFines: state.fines.filter(f => f.status === FineStatus.PENDING).length,
      pendingFineAmount: state.fines.filter(f => f.status === FineStatus.PENDING).reduce((s, f) => s + f.amount, 0),
      pendingReservations: state.reservations.filter(r => r.status === ReservationStatus.WAITING).length,
      restockRequests: state.restockRequests.filter(r => r.status === RestockStatus.REQUESTED).length,
      totalPayments: state.payments.length,
      totalPaymentAmount: state.payments.filter(p => p.status === PaymentStatus.SUCCESS).reduce((s, p) => s + p.amount, 0),
      emailsSentToday: todayEmails.length,
      emailsDelivered: todayEmails.filter(l => l.status === EmailDeliveryStatus.DELIVERED).length,
      emailsFailed: todayEmails.filter(l => l.status === EmailDeliveryStatus.FAILED).length,
    };
  };

  // ======== Context Value ========
  const contextValue: LibraryContextType = {
    state,
    addBook, updateBook, searchBooks, getBook,
    registerMember, updateMember, verifyMember, rejectMember, getMember, searchMembers, getNextMemberID,
    borrowBook, returnBook,
    reserveBook, cancelReservation,
    payFine, waiveFine,
    createDeposit, refundDeposit,
    requestRestock, approveRestock, receiveRestock,
    addReview,
    runAutomation,
    undo,
    undoStack: undoStackRef.current.toArray(),
    getDashboardMetrics,
    bookBST: bookBSTRef.current,
    transactionHistory: transactionHistoryRef.current,
    reservationQueues: reservationQueuesRef.current,
  };

  return <LibraryContext.Provider value={contextValue}>{children}</LibraryContext.Provider>;
};

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (context === undefined) throw new Error('useLibrary must be used within a LibraryProvider');
  return context;
};
