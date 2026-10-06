import { MemberType } from '../types';

export const DAILY_FINE_RATE = 5;
export const DEFAULT_BORROW_DAYS = 14;
export const RESERVATION_EXPIRY_HOURS = 48;
export const RESTOCK_THRESHOLD = 3;
export const MAX_UNDO_HISTORY = 50;

export const DUE_REMINDER_DAYS = [3, 1, 0];

export const BORROW_LIMITS: Record<MemberType, number> = {
  [MemberType.STUDENT]: 5,
  [MemberType.FACULTY]: 10,
  [MemberType.STAFF]: 5,
  [MemberType.EXTERNAL]: 2
};

export const DEPOSIT_AMOUNTS: Record<MemberType, number> = {
  [MemberType.STUDENT]: 0,
  [MemberType.FACULTY]: 0,
  [MemberType.STAFF]: 0,
  [MemberType.EXTERNAL]: 500
};

export const BOOK_CATEGORIES = [
  'Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 
  'Literature', 'History', 'Philosophy', 'Economics', 'Engineering', 
  'Medicine', 'Law', 'Art', 'Music', 'Psychology'
];

export const DEPARTMENTS = [
  'Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Chemical', 
  'Aerospace', 'Biotechnology', 'Mathematics', 'Physics', 'Chemistry', 
  'English', 'Management'
];

export const APP_NAME = 'Lumina Central Library';

export const EMAILJS_CONFIG = {
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || '',
  templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '',
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || ''
};
