import { Member, MemberStatus, VerificationStatus, MemberType } from '../types';
import { generateId, getNextMemberID, isDuplicateEmail } from '../utils/helpers';
import { BORROW_LIMITS, DEPOSIT_AMOUNTS } from '../utils/constants';

export class MemberService {
  static getNextMemberID(members: Member[]): string {
    return getNextMemberID(members);
  }

  static checkDuplicate(members: Member[], memberId: string, email: string): { isDuplicate: boolean; reason: string; existingMember?: Member } {
    if (memberId) {
      const existingId = members.find(m => m.id === memberId);
      if (existingId) return { isDuplicate: true, reason: 'A member with this ID already exists', existingMember: existingId };
    }
    if (email) {
      const existingEmail = members.find(m => m.email.toLowerCase() === email.toLowerCase());
      if (existingEmail) return { isDuplicate: true, reason: 'A member with this email already exists', existingMember: existingEmail };
    }
    return { isDuplicate: false, reason: '' };
  }

  static validateMember(data: Partial<Member>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!data.fullName?.trim()) errors.push('Full name is required');
    if (!data.email?.trim()) errors.push('Email is required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Invalid email format');
    if (!data.phone?.trim()) errors.push('Phone number is required');
    else if (!/^\d{10}$/.test(data.phone.replace(/\s/g, ''))) errors.push('Phone must be 10 digits');
    if (!data.department?.trim()) errors.push('Department is required');
    return { valid: errors.length === 0, errors };
  }

  static createMember(data: Partial<Member>, members: Member[]): Member {
    const now = new Date().toISOString();
    const memberType = data.memberType || MemberType.STUDENT;

    return {
      id: data.id || this.getNextMemberID(members),
      fullName: data.fullName || '',
      email: data.email || '',
      phone: data.phone || '',
      department: data.department || '',
      year: data.year || '',
      course: data.course || '',
      address: data.address || '',
      memberType,
      registrationDate: now,
      profilePhoto: data.profilePhoto || '',
      verification: memberType === MemberType.EXTERNAL ? VerificationStatus.PENDING : VerificationStatus.VERIFIED,
      borrowLimit: BORROW_LIMITS[memberType] || 5,
      currentBorrowed: 0,
      status: MemberStatus.ACTIVE,
      deposit: DEPOSIT_AMOUNTS[memberType] || 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  static updateMember(existingMember: Member, updates: Partial<Member>): Member {
    return {
      ...existingMember,
      ...updates,
      id: existingMember.id,
      registrationDate: existingMember.registrationDate,
      createdAt: existingMember.createdAt,
      updatedAt: new Date().toISOString(),
    };
  }
}
