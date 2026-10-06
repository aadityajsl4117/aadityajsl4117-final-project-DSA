import { Deposit, DepositStatus } from '../types';
import { generateId } from '../utils/helpers';

export class DepositService {
  static createDeposit(memberId: string, memberName: string, amount: number): Deposit {
    return {
      id: generateId('DEP'),
      memberId, memberName, amount,
      status: DepositStatus.RECEIVED,
      receivedAt: new Date().toISOString(),
      refundedAt: null,
    };
  }

  static processRefund(deposit: Deposit): Deposit {
    return { ...deposit, status: DepositStatus.REFUNDED, refundedAt: new Date().toISOString() };
  }

  static getMemberDeposits(deposits: Deposit[], memberId: string): Deposit[] {
    return deposits.filter(d => d.memberId === memberId);
  }
}
