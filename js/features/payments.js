/* FINES & PAYMENTS VIEW FEATURE MODULE */
LuminaLibrary.prototype.renderPayments = function() {
  const list = typeof this.transactionList.toArray === 'function' ? this.transactionList.toArray() : (Array.isArray(this.transactionList) ? this.transactionList : []);
  
  const overdueLoans = list.filter(t => {
    const isIssuedOverdue = t.status === "ISSUED" && this.calculateOverdueDays(t.dueDate) > 0;
    const isReturnedUnpaid = t.status === "RETURNED" && parseFloat(t.fineAmount || t.fine_amount || 0) > 0;
    const hasUnpaidFine = (isIssuedOverdue || isReturnedUnpaid || parseFloat(t.fineAmount || t.fine_amount || 0) > 0) && t.paymentStatus !== "PAID" && t.paymentStatus !== "COMPLETED" && t.fineStatus !== "PAID";
    return hasUnpaidFine;
  });
  const settledHistory = (this.history || []).filter(h => h.action === "FINE_PAYMENT" || h.action === "SETTLE_FINE" || h.action === "PAYMENT");

  return `
    <div class="page-title-row">
      <div>
        <h1 class="page-heading">Fines & Payment Processing</h1>
        <p class="page-subtext">Settle overdue charges via Cash or Dynamic UPI QR with instant digital receipts</p>
      </div>
      <div>
        <button class="btn btn-primary" onclick="app.openQuickPaymentModal()">
          💳 Quick Settle Desk (Cash / QR)
        </button>
      </div>
    </div>

    <div class="content-card">
      <div class="card-header-bar">
        <h3>Outstanding Overdue Charges (${overdueLoans.length} Loans)</h3>
      </div>
      <table class="custom-table">
        <thead>
          <tr>
            <th>Loan ID</th>
            <th>Patron</th>
            <th>Book Title</th>
            <th>Due Date</th>
            <th>Days Overdue</th>
            <th>Calculated Fine</th>
            <th>Settlement Action</th>
          </tr>
        </thead>
        <tbody>
          ${overdueLoans.map(t => {
            const rawFine = parseFloat(t.fineAmount || t.fine_amount || 0);
            const days = (t.status === "RETURNED" && (t.overdueDays !== undefined || t.overdue_days !== undefined))
              ? (t.overdueDays || t.overdue_days)
              : this.calculateOverdueDays(t.dueDate);
            const amount = rawFine > 0 ? rawFine : (days * this.fineRatePerDay);
            const patronName = (t.memberName && t.memberName !== 'undefined' && t.memberName !== 'N/A')
              ? t.memberName
              : (this.findMember(t.memberID)?.name || 'Patron');
            return `
              <tr>
                <td><code>${t.transactionID}</code></td>
                <td><strong>${patronName}</strong><br><small style="color:var(--text-muted);">${t.memberID}</small></td>
                <td>${t.bookTitle}</td>
                <td><span style="color: var(--danger); font-weight:700;">${t.dueDate}</span></td>
                <td><strong>${days} Days</strong></td>
                <td><strong style="color: var(--danger); font-size: 1rem;">₹${amount.toFixed(2)}</strong></td>
                <td>
                  <button class="btn btn-sm btn-primary" onclick="app.openPaymentModal('${t.transactionID}', ${amount})">
                    💳 Settle via Cash / QR
                  </button>
                </td>
              </tr>
            `;
          }).join('') || `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No outstanding late fines. All active loans are within their return period.</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="content-card">
      <div class="card-header-bar">
        <h3>Settled Payment Receipt History</h3>
        <span class="badge badge-success">Audited Financials</span>
      </div>
      <table class="custom-table">
        <thead>
          <tr>
            <th>Receipt Log ID</th>
            <th>Timestamp</th>
            <th>Loan ID</th>
            <th>Patron</th>
            <th>Settlement Details</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${settledHistory.map(h => {
            const patronName = (h.memberName && h.memberName !== 'undefined' && h.memberName !== 'N/A' && h.memberName !== h.memberID)
              ? h.memberName
              : (this.findMember(h.memberID)?.name || h.memberName || 'Patron');
            return `
              <tr>
                <td><code>${h.historyID}</code></td>
                <td>${h.timestamp}</td>
                <td><code>${h.transactionID}</code></td>
                <td><strong>${patronName}</strong> (${h.memberID})</td>
                <td>${h.description}</td>
                <td><span class="badge badge-success">PAID & SETTLED</span></td>
              </tr>
            `;
          }).join('') || `<tr><td colspan="6" style="text-align:center;">No payment settlements logged yet.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
};
