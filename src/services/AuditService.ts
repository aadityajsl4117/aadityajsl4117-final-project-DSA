import { AuditEntry, AuditAction } from '../types';
import { generateId } from '../utils/helpers';

export class AuditService {
  static createEntry(
    action: AuditAction,
    entityType: string,
    entityId: string,
    performedBy: string,
    description: string,
    oldValue?: string,
    newValue?: string,
    result: 'SUCCESS' | 'FAILURE' = 'SUCCESS'
  ): AuditEntry {
    return {
      id: generateId('AUD'),
      action,
      entityType,
      entityId,
      performedBy,
      description,
      oldValue: oldValue || null,
      newValue: newValue || null,
      result,
      createdAt: new Date().toISOString(),
    };
  }
}
