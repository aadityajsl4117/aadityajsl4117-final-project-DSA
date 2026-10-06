import emailjs from '@emailjs/browser';
import { getEmailTemplate } from '../data/emailTemplates';
import { EmailLog, EmailType, EmailDeliveryStatus } from '../types';
import { generateId } from '../utils/helpers';
import { EMAILJS_CONFIG } from '../utils/constants';

export class EmailService {
  private static initialized = false;

  static initialize(): void {
    if (!this.initialized && EMAILJS_CONFIG.publicKey) {
      try {
        emailjs.init(EMAILJS_CONFIG.publicKey);
        this.initialized = true;
      } catch (e) {
        console.warn('EmailJS initialization failed:', e);
      }
    }
  }

  static async sendAutomaticEmail(params: {
    member: { id: string; fullName: string; email: string };
    type: EmailType;
    data?: Record<string, any>;
  }): Promise<EmailLog> {
    this.initialize();

    const templateData = {
      ...params.data,
      name: params.member.fullName,
      member_id: params.member.id,
    };

    const template = getEmailTemplate(params.type, templateData);

    const emailLog: EmailLog = {
      id: generateId('EML'),
      memberId: params.member.id,
      memberName: params.member.fullName,
      recipientEmail: params.member.email,
      type: params.type,
      subject: template.subject,
      message: template.message,
      status: EmailDeliveryStatus.PENDING,
      errorMessage: null,
      transactionId: params.data?.transactionId || null,
      createdAt: new Date().toISOString(),
    };

    if (!EMAILJS_CONFIG.publicKey || !EMAILJS_CONFIG.serviceId) {
      emailLog.status = EmailDeliveryStatus.FAILED;
      emailLog.errorMessage = 'Email service not configured';
      return emailLog;
    }

    try {
      await emailjs.send(
        EMAILJS_CONFIG.serviceId,
        EMAILJS_CONFIG.templateId,
        {
          ...templateData,
          email: params.member.email,
          to_email: params.member.email,
          to_name: params.member.fullName,
          subject: template.subject,
          message: template.message,
        }
      );
      emailLog.status = EmailDeliveryStatus.DELIVERED;
    } catch (error: any) {
      emailLog.status = EmailDeliveryStatus.FAILED;
      emailLog.errorMessage = error?.text || error?.message || 'Unknown email error';
    }

    return emailLog;
  }
}
