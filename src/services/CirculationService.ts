import { Book, Member, Transaction, Reservation, Fine, TransactionStatus, MemberStatus, VerificationStatus, CopyStatus, FineStatus } from '../types';
import { generateId, toISODate, daysBetween, isOverdue, getDueDateFromNow } from '../utils/helpers';
import { ReservationService } from './ReservationService';
import { BookService } from './BookService';

export class CirculationService {
  static validateBorrow(book: Book, member: Member, transactions: Transaction[], reservations: Reservation[], fines: Fine[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!member) { errors.push('Member not found'); return { valid: false, errors }; }
    if (member.status !== MemberStatus.ACTIVE) errors.push('Member account is not active');
    if (member.verification !== VerificationStatus.VERIFIED) errors.push('Member is not verified');
    if (!book) { errors.push('Book not found'); return { valid: false, errors }; }
    if (book.availableCopies <= 0) errors.push('No available copies');
    if (member.currentBorrowed >= member.borrowLimit) errors.push(`Borrow limit exceeded (${member.borrowLimit})`);

    const unpaidFines = fines
      .filter(f => f.memberId === member.id && f.status === FineStatus.PENDING)
      .reduce((sum, f) => sum + f.amount, 0);
    if (unpaidFines > 100) errors.push(`Outstanding fines ₹${unpaidFines} exceed ₹100 limit`);

    // Check reservation rules
    const hasReservation = ReservationService.hasActiveReservation(reservations, book.id, member.id);
    if (!hasReservation) {
      const queue = ReservationService.getBookQueue(reservations, book.id);
      if (queue.length >= book.availableCopies) {
        errors.push('All available copies are reserved by other members');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  static createBorrowTransaction(book: Book, member: Member, copyId: string, borrowDays: number): { transaction: Transaction; updatedBook: Book; updatedMember: Member } {
    const now = new Date();
    const dueDateStr = getDueDateFromNow(borrowDays);

    const transaction: Transaction = {
      id: generateId('TXN'),
      bookId: book.id,
      bookTitle: book.title,
      copyId,
      memberId: member.id,
      memberName: member.fullName,
      issueDate: toISODate(now),
      dueDate: dueDateStr,
      returnDate: null,
      status: TransactionStatus.ACTIVE,
      fineAmount: 0,
      condition: 'GOOD',
      lastReminderSentAt: null,
      createdAt: toISODate(now),
    };

    const updatedBook = BookService.updateCopyStatus(book, copyId, CopyStatus.ISSUED, member.id);

    const updatedMember: Member = {
      ...member,
      currentBorrowed: member.currentBorrowed + 1,
    };

    return { transaction, updatedBook: { ...updatedBook, borrowCount: updatedBook.borrowCount + 1 }, updatedMember };
  }

  static processReturn(transaction: Transaction, book: Book, member: Member, condition: string, dailyFineRate: number): { updatedTransaction: Transaction; updatedBook: Book; updatedMember: Member; fine: Fine | null } {
    const returnDate = toISODate(new Date());

    const updatedTransaction: Transaction = {
      ...transaction,
      returnDate,
      status: TransactionStatus.RETURNED,
      condition,
    };

    const updatedBook = BookService.updateCopyStatus(book, transaction.copyId, CopyStatus.AVAILABLE);

    const updatedMember: Member = {
      ...member,
      currentBorrowed: Math.max(0, member.currentBorrowed - 1),
    };

    // Calculate fine
    let fine: Fine | null = null;
    if (isOverdue(transaction.dueDate)) {
      const dueMs = new Date(transaction.dueDate).getTime();
      const returnMs = new Date(returnDate).getTime();
      const daysOverdue = Math.ceil((returnMs - dueMs) / (1000 * 60 * 60 * 24));
      if (daysOverdue > 0) {
        const amount = daysOverdue * dailyFineRate;
        fine = {
          id: generateId('FIN'),
          transactionId: transaction.id,
          memberId: member.id,
          memberName: member.fullName,
          bookId: book.id,
          bookTitle: book.title,
          amount,
          daysOverdue,
          status: FineStatus.PENDING,
          createdAt: returnDate,
          paidAt: null,
        };
        updatedTransaction.fineAmount = amount;
      }
    }

    return { updatedTransaction, updatedBook, updatedMember, fine };
  }

  static getActiveTransactions(transactions: Transaction[]): Transaction[] {
    return transactions.filter(t => t.status === TransactionStatus.ACTIVE);
  }

  static getOverdueTransactions(transactions: Transaction[]): Transaction[] {
    return transactions.filter(t =>
      t.status === TransactionStatus.OVERDUE ||
      (t.status === TransactionStatus.ACTIVE && isOverdue(t.dueDate))
    );
  }

  static getMemberTransactions(transactions: Transaction[], memberId: string): Transaction[] {
    return transactions.filter(t => t.memberId === memberId);
  }
}
