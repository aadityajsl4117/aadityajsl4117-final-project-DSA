/* CIRCULATION DESK (BORROW, RETURN, TIMELINE) FEATURE MODULE */
LuminaLibrary.prototype.renderCirculation = function() {
  const activeLoans = this.transactionList.toArray().filter(t => t.status === "ISSUED");
  return `
    <div class="page-title-row">
      <div>
        <h1 class="page-heading">Borrow & Issue Return Desk</h1>
        <p class="page-subtext">Active checkouts, loan return processing, fine settlements, and auto EmailJS alerts</p>
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn" onclick="app.sendUpcomingReturnReminders()">Send Near Due Reminders</button>
        <button class="btn btn-primary" onclick="app.openModal('issue-book')">+ Issue Book</button>
      </div>
    </div>

    <div class="content-card">
      <div class="card-header-bar">
        <h3>Active Borrowed Books (${activeLoans.length} Loans)</h3>
      </div>
      <table class="custom-table">
        <thead>
          <tr>
            <th>Loan ID</th>
            <th>Book Details</th>
            <th>Borrower</th>
            <th>Issue Date</th>
            <th>Due Date</th>
            <th>Late Fee</th>
            <th>Desk Action</th>
          </tr>
        </thead>
        <tbody>
          ${activeLoans.map(t => {
            const overdueDays = this.calculateOverdueDays(t.dueDate);
            const lateFine = overdueDays * this.fineRatePerDay;
            return `
              <tr>
                <td><code>${t.transactionID}</code></td>
                <td><strong>${t.bookTitle}</strong> (ID: #${t.bookID})</td>
                <td>${t.memberName}<br><small style="color:var(--text-muted);">${t.memberID}</small></td>
                <td>${t.issueDate}</td>
                <td>
                  <strong style="color: ${overdueDays > 0 ? 'var(--danger)' : 'inherit'};">
                    ${t.dueDate}
                  </strong>
                  ${overdueDays > 0 ? `<br><small style="color:var(--danger); font-weight:700;">${overdueDays} Days Late</small>` : ''}
                </td>
                <td>
                  ${lateFine > 0 ? `<strong style="color:var(--danger);">₹${lateFine.toFixed(2)}</strong>` : `<span style="color:var(--success);">₹0.00</span>`}
                </td>
                <td>
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-sm btn-primary" onclick="app.returnBook('${t.transactionID}')">Process Return</button>
                    <button class="btn btn-sm" onclick="app.showTransactionTimeline('${t.transactionID}')">Timeline</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('') || `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No books currently out on loan.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
};

LuminaLibrary.prototype.handleIssueForm = async function(e) {
  e.preventDefault();
  const memberID = document.getElementById("modal-issue-member").value;
  const bookID = parseInt(document.getElementById("modal-issue-book").value);
  const issueDate = document.getElementById("modal-issue-date").value;
  const dueDate = document.getElementById("modal-issue-due").value;

  const member = this.findMember(memberID);
  const book = this.findBook(bookID);

  if (!member || !book) {
    this.showToast("Selected member or book not found!", true);
    return;
  }

  // Execute Atomic REST API Database Transaction
  try {
    if (window.LuminaAPI) {
      await window.LuminaAPI.issueBook({ memberID, bookID, issueDate, dueDate });
      this.showToast(`Book '${book.title}' issued to ${member.name} (DB Record Persisted)!`);
      this.sendLibraryEmail({
        member: member,
        subject: `LOAN RECEIPT: '${book.title}' Issued`,
        message: `Dear ${member.name},\n\nYou have borrowed '${book.title}' (ID: #${book.bookID}).\nIssue Date: ${issueDate}\nDue Date: ${dueDate}\n\nPlease return by the due date to avoid fines.`,
        book_name: book.title,
        book_id: book.bookID,
        issue_date: issueDate,
        return_date: dueDate,
        status: "ISSUE_RECEIPT"
      });
      this.closeModal();
      await this.loadState();
      return;
    }
  } catch (err) {
    this.showToast(err.message || "Failed to issue book in database!", true);
    return;
  }

  // Fallback Local Mutation
  const activeLoans = this.transactionList.toArray().filter(t => t.memberID === memberID && t.status === "ISSUED");
  const maxLimit = member.borrowLimit || 5;

  if (activeLoans.length >= maxLimit) {
    this.showToast(`Borrowing limit reached (${maxLimit} max) for ${member.name}`, true);
    return;
  }

  if (book.available <= 0) {
    this.showToast(`'${book.title}' is currently out of stock. Add borrower to Waiting List!`, true);
    return;
  }

  book.available--;
  book.borrowCount = (book.borrowCount || 0) + 1;

  const transactionID = `TXN-${Math.floor(1000 + Math.random() * 9000)}`;
  const txnRecord = {
    transactionID,
    bookID: book.bookID,
    bookTitle: book.title,
    memberID: member.memberID,
    memberName: member.name,
    userType: member.userType,
    issueDate,
    dueDate,
    returnDate: null,
    fineAmount: 0,
    paymentStatus: "N/A",
    status: "ISSUED"
  };

  this.transactionList.append(txnRecord);
  this.undoStack.push({ type: "UNDO_ISSUE", transactionID, bookID: book.bookID });

  this.logHistory("ISSUE_BOOK", "CIRCULATION", {
    memberID: member.memberID,
    memberName: member.name,
    bookID: book.bookID,
    bookTitle: book.title,
    transactionID,
    description: `Issued '${book.title}' to ${member.name}. Due on ${dueDate}.`
  });

  this.showToast(`Book '${book.title}' issued to ${member.name}!`);
  this.closeModal();
  this.saveState();
  this.render();
};

LuminaLibrary.prototype.returnBook = async function(txnID) {
  const tx = this.transactionList.find(t => t.transactionID === txnID);
  if (!tx || tx.status === "RETURNED") return;

  // Execute Atomic REST API Database Transaction
  try {
    if (window.LuminaAPI) {
      const res = await window.LuminaAPI.returnBook({ transactionID: txnID, returnDate: this.todayStr });
      this.showToast(`Returned '${tx.bookTitle}' successfully (DB Record Persisted)!`);
      const member = this.findMember(tx.memberID);
      if (member) {
        this.sendLibraryEmail({
          member: member,
          subject: `RETURN RECEIPT: '${tx.bookTitle}' Received`,
          message: `Dear ${member.name},\n\nWe have received your return for '${tx.bookTitle}' (Loan ID: ${txnID}).\nOverdue Fine: ₹${(res.fineAmount || 0).toFixed(2)}\n\nThank you!`,
          book_name: tx.bookTitle,
          book_id: tx.bookID,
          return_date: this.todayStr,
          fine: `₹${(res.fineAmount || 0).toFixed(2)}`,
          status: "RETURN_RECEIPT"
        });
      }
      await this.loadState();
      return;
    }
  } catch (err) {
    this.showToast(err.message || "Failed to process return in database!", true);
    return;
  }

  // Fallback Local Mutation
  const book = this.findBook(tx.bookID);
  const member = this.findMember(tx.memberID);
  const overdueDays = this.calculateOverdueDays(tx.dueDate, this.todayStr);
  const fine = overdueDays * this.fineRatePerDay;

  tx.returnDate = this.todayStr;
  tx.status = "RETURNED";
  if (fine > 0) {
    tx.fineAmount = fine;
    tx.paymentStatus = "UNPAID";
  } else {
    tx.paymentStatus = "N/A";
  }

  if (book) book.available++;
  this.showToast(`Returned '${tx.bookTitle}' successfully!`);
  this.saveState();
  this.render();
};

LuminaLibrary.prototype.showTransactionTimeline = function(txnID) {
  const tx = this.transactionList.find(t => t.transactionID === txnID);
  if (!tx) return;

  const modal = document.getElementById("app-modal");
  const dialog = document.getElementById("modal-content");

  const isOverdue = tx.status === "ISSUED" && this.calculateOverdueDays(tx.dueDate) > 0;

  dialog.innerHTML = `
    <div style="padding:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
          <h2 style="font-size:1.25rem; font-weight:800;">Loan Custody Lifecycle: ${tx.transactionID}</h2>
          <span style="font-size:0.8rem; color:var(--text-muted);">'${tx.bookTitle}' — ${tx.memberName}</span>
        </div>
        <span class="badge ${tx.status === 'RETURNED' ? 'badge-success' : (isOverdue ? 'badge-danger' : 'badge-warning')}">${tx.status}</span>
      </div>

      <div class="timeline-container">
        <div class="timeline-item">
          <div class="timeline-dot">1</div>
          <strong>Book Checkout Issued</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${tx.issueDate} — Authorized by Library Desk</div>
        </div>

        <div class="timeline-item">
          <div class="timeline-dot">2</div>
          <strong>Scheduled Return Due Date</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${tx.dueDate} — Standard borrowing period</div>
        </div>

        <div class="timeline-item">
          <div class="timeline-dot">3</div>
          <strong>${tx.status === 'RETURNED' ? 'Book Returned & Re-shelved' : (isOverdue ? 'Overdue Status Active' : 'Currently Out on Loan')}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">
            ${tx.returnDate ? `Returned on ${tx.returnDate}` : (isOverdue ? `${this.calculateOverdueDays(tx.dueDate)} days late (Fine: ₹${(this.calculateOverdueDays(tx.dueDate)*this.fineRatePerDay).toFixed(2)})` : 'In custody of borrower')}
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:20px;">
        <button class="btn btn-primary" onclick="app.closeModal()">Close Timeline</button>
      </div>
    </div>
  `;
  modal.style.display = "grid";
};
