import { Member } from '../types';

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString(undefined, { 
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

export function daysBetween(date1: string | Date, date2: string | Date): number {
  const d1 = new Date(date1).getTime();
  const d2 = new Date(date2).getTime();
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function isOverdue(dueDate: string | Date): boolean {
  return new Date(dueDate).getTime() < new Date().getTime();
}

export function daysUntilDue(dueDate: string | Date): number {
  const due = new Date(dueDate).getTime();
  const now = new Date().getTime();
  const diffTime = due - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function calculateFine(dueDate: string | Date, dailyRate: number): { days: number, amount: number } {
  if (!isOverdue(dueDate)) {
    return { days: 0, amount: 0 };
  }
  const due = new Date(dueDate).getTime();
  const now = new Date().getTime();
  const diffTime = now - due;
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return { days, amount: days * dailyRate };
}

export function getNextMemberID(existingMembers: Member[]): string {
  const ids = existingMembers
    .map(m => {
      const match = m.id.match(/^MEM(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(num => num > 0)
    .sort((a, b) => a - b);
    
  let nextIdNum = 1;
  for (const id of ids) {
    if (id === nextIdNum) {
      nextIdNum++;
    } else if (id > nextIdNum) {
      break;
    }
  }
  
  return `MEM${nextIdNum.toString().padStart(3, '0')}`;
}

export function isDuplicateEmail(email: string, members: Member[], excludeId?: string): boolean {
  const lowerEmail = email.toLowerCase();
  return members.some(m => m.email.toLowerCase() === lowerEmail && m.id !== excludeId);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(part => part.length > 0)
    .map(part => part[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getDueDateFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function toISODate(date: Date): string {
  return date.toISOString();
}
