import {
  LibraryState,
  AutomationResult,
  TransactionStatus,
  EmailType,
  EmailDeliveryStatus,
  AuditAction,
  Fine,
  FineStatus,
} from '../types';
import { EmailService } from './EmailService';
import { AuditService } from './AuditService';
import { RestockService } from './RestockService';
import { calculateFine, daysUntilDue, isOverdue, generateId } from '../utils/helpers';
import { DUE_REMINDER_DAYS } from '../utils/constants';

export class AutomationEngine {
  static async runDailyAutomation(
    state: LibraryState,
    _emailService: typeof EmailService = EmailService,
    _auditService: typeof AuditService = AuditService
  ): Promise<{ updatedState: Partial<LibraryState>; result: AutomationResult }> {
    const now = new Date();
    const result: AutomationResult = {
      dueReminders: 0,
      overdueDetected: 0,
      finesGenerated: 0,
      reservationsExpired: 0,
      reservationsPromoted: 0,
      restockAlerts: 0,
      emailsSent: 0,
      emailsFailed: 0,
      timestamp: now.toISOString(),
    };

    let updatedTransactions = [...state.transactions];
    let updatedFines = [...state.fines];
    let updatedReservations = [...state.reservations];
    let updatedEmailLogs = [...state.emailLogs];
    let updatedAuditLog = [...state.auditLog];

    // 1. Due Reminders
    for (let i = 0; i < updatedTransactions.length; i++) {
      const t = updatedTransactions[i];
      if (t.status === TransactionStatus.ACTIVE) {
        try {
          const daysLeft = daysUntilDue(t.dueDate);
          if (DUE_REMINDER_DAYS.includes(daysLeft)) {
            const todayStr = now.toISOString().split('T')[0];
            const lastReminderDate = t.lastReminderSentAt?.split('T')[0];
            if (lastReminderDate !== todayStr) {
              const member = state.members.find(m => m.id === t.memberId);
              if (member) {
                const log = await EmailService.sendAutomaticEmail({
                  member,
                  type: EmailType.DUE_REMINDER,
                  data: {
                    book_name: t.bookTitle,
                    book_id: t.bookId,
                    due_date: t.dueDate,
                    days: daysLeft,
                    transaction_id: t.id,
                  },
                });
                updatedEmailLogs.push(log);
                if (log.status === EmailDeliveryStatus.DELIVERED) result.emailsSent++;
                else result.emailsFailed++;
                result.dueReminders++;

                updatedTransactions[i] = {
                  ...t,
                  lastReminderSentAt: now.toISOString(),
                };
              }
            }
          }
        } catch (e) {
          result.emailsFailed++;
        }
      }
    }

    // 2. Overdue Loans
    for (let i = 0; i < updatedTransactions.length; i++) {
      const t = updatedTransactions[i];
      if (t.status === TransactionStatus.ACTIVE && isOverdue(t.dueDate)) {
        try {
          updatedTransactions[i] = { ...t, status: TransactionStatus.OVERDUE };
          result.overdueDetected++;

          const { days, amount } = calculateFine(t.dueDate, state.dailyFineRate);
          const existingFine = updatedFines.find(f => f.transactionId === t.id && f.status === FineStatus.PENDING);
          if (!existingFine && amount > 0) {
            const fine: Fine = {
              id: generateId('FIN'),
              transactionId: t.id,
              memberId: t.memberId,
              memberName: t.memberName,
              bookId: t.bookId,
              bookTitle: t.bookTitle,
              amount,
              daysOverdue: days,
              status: FineStatus.PENDING,
              createdAt: now.toISOString(),
              paidAt: null,
            };
            updatedFines.push(fine);
            result.finesGenerated++;
          }

          const member = state.members.find(m => m.id === t.memberId);
          if (member) {
            const log = await EmailService.sendAutomaticEmail({
              member,
              type: EmailType.OVERDUE,
              data: {
                book_name: t.bookTitle,
                book_id: t.bookId,
                transaction_id: t.id,
                due_date: t.dueDate,
                days_overdue: days,
                fine_amount: amount,
              },
            });
            updatedEmailLogs.push(log);
            if (log.status === EmailDeliveryStatus.DELIVERED) result.emailsSent++;
            else result.emailsFailed++;
          }
        } catch (e) {
          result.emailsFailed++;
        }
      }
    }

    // 3. Restock Alerts
    const restockNeeded = RestockService.checkRestockNeeded(state.books, state.reservations, state.restockThreshold);
    result.restockAlerts = restockNeeded.length;

    const auditEntry = AuditService.createEntry(
      AuditAction.AUTOMATION_RUN,
      'System',
      'AUTOMATION',
      'Librarian',
      `Daily automation: ${result.dueReminders} reminders, ${result.overdueDetected} overdue, ${result.finesGenerated} fines, ${result.emailsSent} emails sent`
    );
    updatedAuditLog.push(auditEntry);

    return {
      updatedState: {
        transactions: updatedTransactions,
        fines: updatedFines,
        reservations: updatedReservations,
        emailLogs: updatedEmailLogs,
        auditLog: updatedAuditLog,
        lastAutomationRun: now.toISOString(),
      },
      result,
    };
  }
}
