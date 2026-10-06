/* NOTIFICATION SERVICES & EMAIL DISPATCHER */
LuminaLibrary.prototype.sendLibraryEmail = async function({ member, subject, message, book_name = "", book_id = "", issue_date = "", return_date = "", fine = "", status = "" }) {
  if (!member || !member.email) return false;

  const templatePayload = {
    email: member.email.trim(),
    name: member.name,
    subject: subject,
    message: message,
    book_name: book_name,
    book_id: book_id ? `#${book_id}` : "",
    issue_date: issue_date,
    return_date: return_date,
    fine: fine,
    status: status
  };

  const emailLog = {
    emailID: `EML-${Math.floor(1000 + Math.random() * 9000)}`,
    recipient: member.email.trim(),
    recipientName: member.name,
    type: status || "NOTIFICATION",
    subject: subject,
    body: message,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: "SENDING..."
  };

  this.outbox.unshift(emailLog);
  this.saveState();
  this.updateBadgeCounts();

  try {
    if (window.emailjs && typeof window.emailjs.send === "function") {
      await emailjs.send(this.emailjsServiceID, this.emailjsTemplateID, templatePayload);
      emailLog.status = "DELIVERED";
      this.showToast(`Notification email dispatched to ${member.email}`);
    } else {
      emailLog.status = "FAILED";
      this.showToast(`Email delivery failed (EmailJS offline) for ${member.email}`, true);
    }
  } catch (error) {
    console.warn("EmailJS delivery failure:", error);
    emailLog.status = "FAILED";
    this.showToast(`Email delivery failed for ${member.email}`, true);
  }

  if (window.LuminaAPI && typeof window.LuminaAPI.request === 'function') {
    try {
      await window.LuminaAPI.request('/emails', {
        method: 'POST',
        body: JSON.stringify({
          recipient: emailLog.recipient,
          recipientName: emailLog.recipientName,
          subject: emailLog.subject,
          message: emailLog.body,
          type: emailLog.type,
          status: emailLog.status
        })
      });
    } catch (dbErr) {
      console.warn("Failed to persist email record to DB:", dbErr);
    }
  }

  this.saveState();
  if (this.currentView === "email-dispatch") this.render();
  return emailLog.status === "DELIVERED";
};

LuminaLibrary.prototype.showToast = function(msg, isError = false) {
  const tray = document.getElementById("toast-root");
  if (!tray) return;
  const card = document.createElement("div");
  card.className = "toast-card";
  if (isError) card.style.background = "var(--danger)";
  const span = document.createElement("span");
  span.textContent = String(msg); // plain text: member/book names must never be interpreted as HTML
  card.appendChild(span);
  tray.appendChild(card);
  setTimeout(() => card.remove(), 4000);
};

LuminaLibrary.prototype.sendDailyOverdueReminders = function() {
  const activeLoans = this.transactionList.toArray().filter(t => t.status === "ISSUED");
  const overdueLoans = activeLoans.filter(t => this.calculateOverdueDays(t.dueDate) > 0);
  
  if (overdueLoans.length === 0) {
    this.showToast("No overdue loans currently active!");
    return;
  }

  let sentCount = 0;
  overdueLoans.forEach(t => {
    const dedupeKey = `${t.transactionID}_OVERDUE_${this.todayStr}`;
    if (this.sentReminders[dedupeKey]) return; // Skip if already dispatched today

    const m = this.findMember(t.memberID);
    const days = this.calculateOverdueDays(t.dueDate);
    const fine = days * this.fineRatePerDay;

    if (m) {
      this.sendLibraryEmail({
        member: m,
        subject: `OVERDUE NOTICE: '${t.bookTitle}' is ${days} Days Late`,
        message: `Urgent Reminder:\n\n'${t.bookTitle}' was due on ${t.dueDate}.\nDays Overdue: ${days} Days\nCurrent Fine Accrued: ₹${fine.toFixed(2)}\n\nPlease return this volume immediately to avoid further fines.`,
        book_name: t.bookTitle,
        book_id: t.bookID,
        return_date: t.dueDate,
        fine: `₹${fine.toFixed(2)}`,
        status: "OVERDUE"
      });
      this.sentReminders[dedupeKey] = new Date().toISOString();
      sentCount++;
    }
  });

  this.saveState();
  if (sentCount > 0) {
    this.showToast(`Batch Overdue Alerts dispatched to ${sentCount} patrons!`);
  } else {
    this.showToast("Overdue reminders were already dispatched for today.");
  }
};

LuminaLibrary.prototype.sendUpcomingReturnReminders = function() {
  const activeLoans = this.transactionList.toArray().filter(t => t.status === "ISSUED");
  let sentCount = 0;

  activeLoans.forEach(t => {
    const due = this.parseLocalDate(t.dueDate);
    const now = this.parseLocalDate(this.todayStr);
    const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let reminderType = null;
    if (diffDays === 3) reminderType = "UPCOMING_3";
    else if (diffDays === 2) reminderType = "UPCOMING_2";
    else if (diffDays === 1) reminderType = "UPCOMING_1";
    else if (diffDays === 0) reminderType = "DUE_TODAY";

    if (reminderType) {
      const dedupeKey = `${t.transactionID}_${reminderType}_${this.todayStr}`;
      if (this.sentReminders[dedupeKey]) return; // Prevent duplicate reminders for same date

      const m = this.findMember(t.memberID);
      if (m) {
        const subjectText = diffDays === 0 
          ? `DUE TODAY: '${t.bookTitle}' is due today` 
          : `Upcoming Due Reminder: '${t.bookTitle}' due in ${diffDays} day(s)`;

        this.sendLibraryEmail({
          member: m,
          subject: subjectText,
          message: `Dear ${m.name},\n\nReminder that '${t.bookTitle}' is due on ${t.dueDate} (${diffDays === 0 ? 'DUE TODAY' : `${diffDays} days remaining`}).\n\nPlease return or renew on time to avoid late fees.`,
          book_name: t.bookTitle,
          book_id: t.bookID,
          issue_date: t.issueDate,
          return_date: t.dueDate,
          status: diffDays === 0 ? "DUE_TODAY" : "REMINDER"
        });
        this.sentReminders[dedupeKey] = new Date().toISOString();
        sentCount++;
      }
    }
  });

  this.saveState();
  if (sentCount > 0) {
    this.showToast(`Dispatched near-due reminders to ${sentCount} patrons.`);
  } else {
    this.showToast("No new upcoming reminders due for dispatch right now.");
  }
};
