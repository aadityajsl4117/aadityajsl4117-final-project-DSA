import { Book, Reservation, RestockRequest, RestockStatus, ReservationStatus } from '../types';
import { generateId } from '../utils/helpers';

export class RestockService {
  static createRequest(book: Book, requestedCopies: number, requestedBy: string, reservationCount: number, reason: string): RestockRequest {
    return {
      id: generateId('RST'),
      bookId: book.id,
      bookTitle: book.title,
      currentCopies: book.totalCopies,
      requestedCopies,
      reservationCount,
      reason,
      status: RestockStatus.REQUESTED,
      requestedBy,
      approvedBy: null,
      requestedAt: new Date().toISOString(),
      approvedAt: null,
      receivedAt: null,
    };
  }

  static approveRequest(request: RestockRequest, approvedBy: string): RestockRequest {
    return { ...request, status: RestockStatus.APPROVED, approvedBy, approvedAt: new Date().toISOString() };
  }

  static markReceived(request: RestockRequest): RestockRequest {
    return { ...request, status: RestockStatus.RECEIVED, receivedAt: new Date().toISOString() };
  }

  static rejectRequest(request: RestockRequest): RestockRequest {
    return { ...request, status: RestockStatus.REJECTED };
  }

  static checkRestockNeeded(books: Book[], reservations: Reservation[], threshold: number): { bookId: string; bookTitle: string; available: number; reservations: number }[] {
    return books
      .filter(b => b.availableCopies === 0)
      .map(b => ({
        bookId: b.id,
        bookTitle: b.title,
        available: b.availableCopies,
        reservations: reservations.filter(r => r.bookId === b.id && r.status === ReservationStatus.WAITING).length,
      }))
      .filter(r => r.reservations >= threshold);
  }
}
