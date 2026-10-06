import { Reservation, ReservationStatus } from '../types';
import { generateId } from '../utils/helpers';

export class ReservationService {
  static createReservation(bookId: string, bookTitle: string, memberId: string, memberName: string, existingReservations: Reservation[]): Reservation {
    const queue = this.getBookQueue(existingReservations, bookId);
    return {
      id: generateId('RES'),
      bookId,
      bookTitle,
      memberId,
      memberName,
      position: queue.length + 1,
      status: ReservationStatus.WAITING,
      reservedAt: new Date().toISOString(),
      availableAt: null,
      expiresAt: null,
      fulfilledAt: null,
    };
  }

  static getBookQueue(reservations: Reservation[], bookId: string): Reservation[] {
    return reservations
      .filter(r => r.bookId === bookId && r.status === ReservationStatus.WAITING)
      .sort((a, b) => a.position - b.position);
  }

  static promoteNextInQueue(reservations: Reservation[], bookId: string, expiryHours: number): { promoted: Reservation | null; updatedReservations: Reservation[] } {
    const queue = this.getBookQueue(reservations, bookId);
    if (queue.length === 0) return { promoted: null, updatedReservations: reservations };

    const next = queue[0];
    const now = new Date();
    const expiryDate = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

    const promoted: Reservation = {
      ...next,
      status: ReservationStatus.AVAILABLE,
      availableAt: now.toISOString(),
      expiresAt: expiryDate.toISOString(),
    };

    const updatedReservations = reservations.map(r => {
      if (r.id === promoted.id) return promoted;
      if (r.bookId === bookId && r.status === ReservationStatus.WAITING) {
        return { ...r, position: r.position - 1 };
      }
      return r;
    });

    return { promoted, updatedReservations };
  }

  static expireReservation(reservation: Reservation): Reservation {
    return { ...reservation, status: ReservationStatus.EXPIRED };
  }

  static fulfillReservation(reservation: Reservation): Reservation {
    return { ...reservation, status: ReservationStatus.FULFILLED, fulfilledAt: new Date().toISOString() };
  }

  static checkExpiredReservations(reservations: Reservation[]): { expired: Reservation[]; updatedReservations: Reservation[] } {
    const now = new Date().toISOString();
    const expired: Reservation[] = [];
    const updatedReservations = reservations.map(r => {
      if (r.status === ReservationStatus.AVAILABLE && r.expiresAt && r.expiresAt < now) {
        const expiredRes = { ...r, status: ReservationStatus.EXPIRED };
        expired.push(expiredRes);
        return expiredRes;
      }
      return r;
    });
    return { expired, updatedReservations };
  }

  static getMemberReservations(reservations: Reservation[], memberId: string): Reservation[] {
    return reservations.filter(r => r.memberId === memberId);
  }

  static hasActiveReservation(reservations: Reservation[], bookId: string, memberId: string): boolean {
    return reservations.some(r =>
      r.bookId === bookId && r.memberId === memberId &&
      (r.status === ReservationStatus.WAITING || r.status === ReservationStatus.AVAILABLE)
    );
  }
}
