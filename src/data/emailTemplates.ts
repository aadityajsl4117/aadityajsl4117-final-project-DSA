import { EmailType } from '../types';

export function getEmailTemplate(type: EmailType, data: Record<string, any>): { subject: string; message: string } {
  let subject = '';
  let message = '';
  
  const footer = '\n\nBest regards,\nLumina Central Library\nAutomated Library System';

  switch (type) {
    case EmailType.REGISTRATION:
      subject = 'Welcome to Lumina Central Library - Registration Confirmed';
      message = `Dear ${data.name},

Welcome to Lumina Central Library! Your registration has been confirmed.

Member Details:
Member ID: ${data.memberId}
Department: ${data.department}
Year: ${data.year}
Email: ${data.email}
Phone: ${data.phone}
Address: ${data.address}
Registration Date: ${data.registrationDate}

Your current borrowing limit is ${data.borrowLimit} books.
Please note our fine policy: Late returns will incur a fee of ₹5/day per book.

We look forward to seeing you at the library!`;
      break;

    case EmailType.PROFILE_UPDATE:
      subject = 'Library Member Profile Updated';
      message = `Dear ${data.name},

Your Lumina Central Library member profile (Member ID: ${data.memberId}) has been successfully updated on ${data.updatedDate}.

Changes made:
${data.updatedFields}

If you did not request these changes, please contact the library administration immediately.`;
      break;

    case EmailType.MEMBER_VERIFIED:
      subject = 'Membership Verified - Lumina Central Library';
      message = `Dear ${data.name},

Great news! Your membership (Member ID: ${data.memberId}) has been fully verified as of ${data.verificationDate}.

You now have full access to our catalog and can begin borrowing books immediately up to your membership limit.`;
      break;

    case EmailType.MEMBER_REJECTED:
      subject = 'Membership Verification Update';
      message = `Dear ${data.name},

We are writing regarding your membership application (Member ID: ${data.memberId}). Unfortunately, your verification could not be completed.

Reason: ${data.reason}

Please contact the library front desk or reply to this email for further assistance.`;
      break;

    case EmailType.BOOK_BORROWED:
      subject = `Borrow Confirmation - ${data.bookTitle}`;
      message = `Dear ${data.name},

This is to confirm that you have successfully borrowed the following book:

Book Title: ${data.bookTitle}
Book ID: ${data.bookId}
Transaction ID: ${data.transactionId}
Borrow Date: ${data.borrowDate}
Due Date: ${data.dueDate}
Shelf Location: ${data.shelf}

You have borrowed ${data.currentBorrowed} out of your ${data.borrowLimit} book limit.
Please return the book on or before the due date to avoid late fees (₹5/day).`;
      break;

    case EmailType.BOOK_RETURNED:
      subject = `Return Receipt - ${data.bookTitle}`;
      message = `Dear ${data.name},

Thank you for returning the following book:

Book Title: ${data.bookTitle}
Book ID: ${data.bookId}
Transaction ID: ${data.transactionId}
Return Date: ${data.returnDate}
Condition Received: ${data.condition}

Fine Status: ${data.fineAmount ? `₹${data.fineAmount} generated for late return.` : 'No late fee.'}

Thank you for using Lumina Central Library!`;
      break;

    case EmailType.DUE_REMINDER:
      subject = `Due Reminder - ${data.bookTitle} due in ${data.daysRemaining} days`;
      message = `Dear ${data.name},

This is a gentle reminder that the following book is due soon:

Book Title: ${data.bookTitle}
Book ID: ${data.bookId}
Due Date: ${data.dueDate}
Days Remaining: ${data.daysRemaining}

Please return the book to the library before the due date to avoid late fees.`;
      break;

    case EmailType.OVERDUE:
      subject = `OVERDUE: Library Book - ${data.bookTitle}`;
      message = `Dear ${data.name},

URGENT: The following library book is currently OVERDUE:

Book Title: ${data.bookTitle}
Book ID: ${data.bookId}
Transaction ID: ${data.transactionId}
Due Date: ${data.dueDate}
Current Date: ${data.currentDate}
Days Overdue: ${data.daysOverdue}

Current Fine Amount: ₹${data.fineAmount}

Please return this book immediately to stop further accumulation of fines.`;
      break;

    case EmailType.FINE_GENERATED:
      subject = `Library Fine Generated - ₹${data.amount}`;
      message = `Dear ${data.name},

A fine has been generated on your account for the late return of:
Book Title: ${data.bookTitle}

Fine Amount: ₹${data.amount}
Days Overdue: ${data.daysOverdue}

Please log in to your library portal or visit the front desk to settle this amount.`;
      break;

    case EmailType.PAYMENT_RECEIPT:
      subject = `Fine Payment Receipt - ₹${data.amount}`;
      message = `Dear ${data.name},

We have successfully received your fine payment.

Payment ID: ${data.paymentId}
Transaction ID: ${data.transactionId}
Fine ID: ${data.fineId}
Amount Paid: ₹${data.amount}
Payment Method: ${data.paymentMethod}
Date: ${data.paymentDate}
Status: ${data.status}

Thank you for clearing your dues.`;
      break;

    case EmailType.PAYMENT_FAILED:
      subject = 'Payment Failed - Please Retry';
      message = `Dear ${data.name},

Your recent fine payment attempt of ₹${data.amount} was unsuccessful.

Reason: ${data.reason}

Please retry the payment through your library portal or visit the library front desk.`;
      break;

    case EmailType.RESERVATION_CREATED:
      subject = `Hold Placed - ${data.bookTitle}`;
      message = `Dear ${data.name},

You have successfully placed a hold on:

Book Title: ${data.bookTitle}
Book ID: ${data.bookId}
Reservation Date: ${data.reservationDate}
Queue Position: ${data.queuePosition}

We will notify you by email as soon as the book becomes available for collection.`;
      break;

    case EmailType.RESERVATION_AVAILABLE:
      subject = `Book Available - ${data.bookTitle}`;
      message = `Dear ${data.name},

Good news! The book you reserved is now available for pickup.

Book Title: ${data.bookTitle}
Book ID: ${data.bookId}
Available Since: ${data.availableDate}

Please collect the book within 48 hours. If not collected by the deadline, your reservation will expire.`;
      break;

    case EmailType.RESERVATION_EXPIRED:
      subject = `Reservation Expired - ${data.bookTitle}`;
      message = `Dear ${data.name},

Your reservation for the following book has expired:

Book Title: ${data.bookTitle}

Reason: ${data.reason || 'Not collected within the 48-hour claim period.'}

If you still need this book, please place a new reservation through the library portal.`;
      break;

    case EmailType.DEPOSIT_RECEIVED:
      subject = `Deposit Received - ₹${data.amount}`;
      message = `Dear ${data.name},

We have received your membership security deposit.

Member ID: ${data.memberId}
Deposit ID: ${data.depositId}
Amount: ₹${data.amount}
Date: ${data.date}

This deposit is refundable upon cancellation of your membership, provided all dues are cleared.`;
      break;

    case EmailType.DEPOSIT_REFUNDED:
      subject = `Deposit Refund Processed - ₹${data.amount}`;
      message = `Dear ${data.name},

Your security deposit refund has been processed.

Deposit ID: ${data.depositId}
Refund Amount: ₹${data.amount}
Refund Date: ${data.refundDate}

It may take a few business days for the amount to reflect in your account.`;
      break;

    case EmailType.RESTOCK_UPDATE:
      subject = `Book Restock Update - ${data.bookTitle}`;
      message = `Dear ${data.name},

We are writing to update you on a book you have shown interest in.

Book Title: ${data.bookTitle}
Status Update: ${data.statusUpdate}
${data.copiesAdded ? `New Copies Added: ${data.copiesAdded}\n` : ''}
Visit the library or check our catalog to borrow.`;
      break;

    default:
      subject = 'Lumina Central Library Notification';
      message = `Dear Member,\n\nYou have a new notification.`;
      break;
  }

  message += footer;
  
  return { subject, message };
}
