import { Fine, Payment, FineStatus, PaymentMethod, PaymentStatus } from '../types';
import { generateId } from '../utils/helpers';

export class PaymentService {
  static processPayment(fine: Fine, method: PaymentMethod): { payment: Payment; updatedFine: Fine } {
    const payment: Payment = {
      id: generateId('PAY'),
      fineId: fine.id,
      transactionId: fine.transactionId,
      memberId: fine.memberId,
      memberName: fine.memberName,
      amount: fine.amount,
      method,
      status: PaymentStatus.SUCCESS,
      createdAt: new Date().toISOString(),
    };
    const updatedFine: Fine = { ...fine, status: FineStatus.PAID, paidAt: new Date().toISOString() };
    return { payment, updatedFine };
  }

  static simulatePaymentFailure(fine: Fine, method: PaymentMethod): { payment: Payment; updatedFine: Fine } {
    const payment: Payment = {
      id: generateId('PAY'),
      fineId: fine.id, transactionId: fine.transactionId,
      memberId: fine.memberId, memberName: fine.memberName,
      amount: fine.amount, method,
      status: PaymentStatus.FAILED,
      createdAt: new Date().toISOString(),
    };
    return { payment, updatedFine: fine };
  }

  static getMemberPayments(payments: Payment[], memberId: string): Payment[] { return payments.filter(p => p.memberId === memberId); }
  static getTotalCollected(payments: Payment[]): number { return payments.filter(p => p.status === PaymentStatus.SUCCESS).reduce((s, p) => s + p.amount, 0); }
}
