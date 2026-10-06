import { Fine, FineStatus } from '../types';
import { generateId } from '../utils/helpers';

export class FineService {
  static calculateFine(dueDate: string, dailyRate: number): { daysOverdue: number; amount: number } {
    const due = new Date(dueDate).getTime();
    const now = Date.now();
    if (now <= due) return { daysOverdue: 0, amount: 0 };
    const daysOverdue = Math.ceil((now - due) / (1000 * 60 * 60 * 24));
    return { daysOverdue, amount: daysOverdue * dailyRate };
  }

  static createFine(transactionId: string, memberId: string, memberName: string, bookId: string, bookTitle: string, daysOverdue: number, amount: number): Fine {
    return {
      id: generateId('FIN'),
      transactionId, memberId, memberName, bookId, bookTitle,
      amount, daysOverdue,
      status: FineStatus.PENDING,
      createdAt: new Date().toISOString(),
      paidAt: null,
    };
  }

  static getUnpaidFines(fines: Fine[]): Fine[] { return fines.filter(f => f.status === FineStatus.PENDING); }
  static getMemberFines(fines: Fine[], memberId: string): Fine[] { return fines.filter(f => f.memberId === memberId); }
  static getTotalUnpaidAmount(fines: Fine[]): number { return this.getUnpaidFines(fines).reduce((s, f) => s + f.amount, 0); }
  static getMemberUnpaidAmount(fines: Fine[], memberId: string): number { return this.getMemberFines(fines, memberId).filter(f => f.status === FineStatus.PENDING).reduce((s, f) => s + f.amount, 0); }
}
