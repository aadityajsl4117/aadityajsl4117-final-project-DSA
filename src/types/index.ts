// ============ ENUMS ============

export enum BookStatus { AVAILABLE = 'AVAILABLE', ISSUED = 'ISSUED', RESERVED = 'RESERVED', DAMAGED = 'DAMAGED', LOST = 'LOST', MAINTENANCE = 'MAINTENANCE' }

export enum CopyStatus { AVAILABLE = 'AVAILABLE', ISSUED = 'ISSUED', RESERVED = 'RESERVED', DAMAGED = 'DAMAGED', LOST = 'LOST', MAINTENANCE = 'MAINTENANCE' }

export enum MemberType { STUDENT = 'STUDENT', FACULTY = 'FACULTY', STAFF = 'STAFF', EXTERNAL = 'EXTERNAL' }

export enum MemberStatus { ACTIVE = 'ACTIVE', INACTIVE = 'INACTIVE', SUSPENDED = 'SUSPENDED', BLOCKED = 'BLOCKED' }

export enum VerificationStatus { PENDING = 'PENDING', VERIFIED = 'VERIFIED', REJECTED = 'REJECTED' }

export enum TransactionStatus { ACTIVE = 'ACTIVE', RETURNED = 'RETURNED', OVERDUE = 'OVERDUE', LOST = 'LOST' }

export enum FineStatus { PENDING = 'PENDING', PAID = 'PAID', WAIVED = 'WAIVED' }

export enum PaymentMethod { CASH = 'CASH', UPI = 'UPI', QR = 'QR', ONLINE = 'ONLINE' }

export enum PaymentStatus { SUCCESS = 'SUCCESS', FAILED = 'FAILED', PENDING = 'PENDING' }

export enum ReservationStatus { WAITING = 'WAITING', AVAILABLE = 'AVAILABLE', FULFILLED = 'FULFILLED', EXPIRED = 'EXPIRED', CANCELLED = 'CANCELLED' }

export enum RestockStatus { REQUESTED = 'REQUESTED', APPROVED = 'APPROVED', ORDERED = 'ORDERED', RECEIVED = 'RECEIVED', REJECTED = 'REJECTED' }

export enum DepositStatus { RECEIVED = 'RECEIVED', REFUND_INITIATED = 'REFUND_INITIATED', REFUNDED = 'REFUNDED' }

export enum EmailType {
  REGISTRATION = 'REGISTRATION',
  PROFILE_UPDATE = 'PROFILE_UPDATE',
  MEMBER_VERIFIED = 'MEMBER_VERIFIED',
  MEMBER_REJECTED = 'MEMBER_REJECTED',
  BOOK_BORROWED = 'BOOK_BORROWED',
  BOOK_RETURNED = 'BOOK_RETURNED',
  DUE_REMINDER = 'DUE_REMINDER',
  OVERDUE = 'OVERDUE',
  FINE_GENERATED = 'FINE_GENERATED',
  PAYMENT_RECEIPT = 'PAYMENT_RECEIPT',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  RESERVATION_CREATED = 'RESERVATION_CREATED',
  RESERVATION_AVAILABLE = 'RESERVATION_AVAILABLE',
  RESERVATION_EXPIRED = 'RESERVATION_EXPIRED',
  DEPOSIT_RECEIVED = 'DEPOSIT_RECEIVED',
  DEPOSIT_REFUNDED = 'DEPOSIT_REFUNDED',
  RESTOCK_UPDATE = 'RESTOCK_UPDATE'
}

export enum EmailDeliveryStatus { PENDING = 'PENDING', DELIVERED = 'DELIVERED', FAILED = 'FAILED' }

export enum AuditAction {
  REGISTER_MEMBER = 'REGISTER_MEMBER', UPDATE_MEMBER = 'UPDATE_MEMBER', VERIFY_MEMBER = 'VERIFY_MEMBER',
  REJECT_MEMBER = 'REJECT_MEMBER', ISSUE_BOOK = 'ISSUE_BOOK', RETURN_BOOK = 'RETURN_BOOK',
  CREATE_FINE = 'CREATE_FINE', PAY_FINE = 'PAY_FINE', WAIVE_FINE = 'WAIVE_FINE',
  CREATE_RESERVATION = 'CREATE_RESERVATION', PROMOTE_RESERVATION = 'PROMOTE_RESERVATION',
  EXPIRE_RESERVATION = 'EXPIRE_RESERVATION', CANCEL_RESERVATION = 'CANCEL_RESERVATION',
  RESTOCK_REQUEST = 'RESTOCK_REQUEST', RESTOCK_APPROVED = 'RESTOCK_APPROVED', RESTOCK_RECEIVED = 'RESTOCK_RECEIVED',
  EMAIL_SENT = 'EMAIL_SENT', EMAIL_FAILED = 'EMAIL_FAILED',
  DEPOSIT_RECEIVED = 'DEPOSIT_RECEIVED', DEPOSIT_REFUNDED = 'DEPOSIT_REFUNDED',
  ADD_BOOK = 'ADD_BOOK', UPDATE_BOOK = 'UPDATE_BOOK', ADD_REVIEW = 'ADD_REVIEW',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED', UNDO_ACTION = 'UNDO_ACTION',
  AUTOMATION_RUN = 'AUTOMATION_RUN'
}

// ============ INTERFACES ============

export interface Book {
  id: string; // e.g. 'BK001'
  isbn: string;
  title: string;
  author: string;
  category: string;
  publisher: string;
  publishYear: number;
  shelf: string;
  description: string;
  coverImage: string;
  totalCopies: number;
  availableCopies: number;
  borrowCount: number;
  rating: number;
  reviews: Review[];
  status: BookStatus;
  copies: BookCopy[];
  createdAt: string;
  updatedAt: string;
}

export interface BookCopy {
  copyId: string; // e.g. 'BK001-C1'
  bookId: string;
  barcode: string;
  condition: 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
  shelf: string;
  status: CopyStatus;
  borrowedBy: string | null; // memberId
  lastBorrowDate: string | null;
}

export interface Review {
  id: string;
  bookId: string;
  memberId: string;
  memberName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

export interface Member {
  id: string; // e.g. 'MEM201'
  fullName: string;
  email: string;
  phone: string;
  department: string;
  year: string;
  course: string;
  address: string;
  memberType: MemberType;
  registrationDate: string;
  profilePhoto: string; // base64 or URL
  verification: VerificationStatus;
  borrowLimit: number;
  currentBorrowed: number;
  status: MemberStatus;
  deposit: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string; // e.g. 'TXN001'
  bookId: string;
  bookTitle: string;
  copyId: string;
  memberId: string;
  memberName: string;
  issueDate: string;
  dueDate: string;
  returnDate: string | null;
  status: TransactionStatus;
  fineAmount: number;
  condition: string;
  lastReminderSentAt: string | null;
  createdAt: string;
}

export interface Fine {
  id: string;
  transactionId: string;
  memberId: string;
  memberName: string;
  bookId: string;
  bookTitle: string;
  amount: number;
  daysOverdue: number;
  status: FineStatus;
  createdAt: string;
  paidAt: string | null;
}

export interface Payment {
  id: string;
  fineId: string;
  transactionId: string;
  memberId: string;
  memberName: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
}

export interface Reservation {
  id: string;
  bookId: string;
  bookTitle: string;
  memberId: string;
  memberName: string;
  position: number;
  status: ReservationStatus;
  reservedAt: string;
  availableAt: string | null;
  expiresAt: string | null;
  fulfilledAt: string | null;
}

export interface EmailLog {
  id: string;
  memberId: string;
  memberName: string;
  recipientEmail: string;
  type: EmailType;
  subject: string;
  message: string;
  status: EmailDeliveryStatus;
  errorMessage: string | null;
  transactionId: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  performedBy: string;
  description: string;
  oldValue: string | null;
  newValue: string | null;
  result: 'SUCCESS' | 'FAILURE';
  createdAt: string;
}

export interface RestockRequest {
  id: string;
  bookId: string;
  bookTitle: string;
  currentCopies: number;
  requestedCopies: number;
  reservationCount: number;
  reason: string;
  status: RestockStatus;
  requestedBy: string;
  approvedBy: string | null;
  requestedAt: string;
  approvedAt: string | null;
  receivedAt: string | null;
}

export interface Deposit {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  status: DepositStatus;
  receivedAt: string;
  refundedAt: string | null;
}

export interface UndoAction {
  id: string;
  action: string;
  description: string;
  timestamp: string;
  undoFn: () => void;
  canUndo: boolean;
}

export interface DashboardMetrics {
  totalBooks: number;
  totalCopies: number;
  availableCopies: number;
  borrowedCopies: number;
  activeMembers: number;
  overdueBooks: number;
  pendingFines: number;
  pendingFineAmount: number;
  pendingReservations: number;
  restockRequests: number;
  totalPayments: number;
  totalPaymentAmount: number;
  emailsSentToday: number;
  emailsDelivered: number;
  emailsFailed: number;
}

export interface AutomationResult {
  dueReminders: number;
  overdueDetected: number;
  finesGenerated: number;
  reservationsExpired: number;
  reservationsPromoted: number;
  restockAlerts: number;
  emailsSent: number;
  emailsFailed: number;
  timestamp: string;
}

// ============ LIBRARY STATE ============

export interface LibraryState {
  books: Book[];
  members: Member[];
  transactions: Transaction[];
  fines: Fine[];
  payments: Payment[];
  reservations: Reservation[];
  emailLogs: EmailLog[];
  auditLog: AuditEntry[];
  restockRequests: RestockRequest[];
  deposits: Deposit[];
  lastAutomationRun: string | null;
  dailyFineRate: number;
  defaultBorrowDays: number;
  reservationExpiryHours: number;
  restockThreshold: number;
}
