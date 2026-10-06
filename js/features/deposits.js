/* EXTERNAL DEPOSITS FEATURE MODULE */
LuminaLibrary.prototype.renderDeposits = function() {
  const activeLoansMap = {};
  if (this.transactionList) {
    const list = typeof this.transactionList.toArray === 'function' ? this.transactionList.toArray() : (Array.isArray(this.transactionList) ? this.transactionList : []);
    list.forEach(tx => {
      if (tx.status === 'ISSUED') {
        activeLoansMap[tx.memberID] = tx;
        if (tx.transactionID) activeLoansMap[tx.transactionID] = tx;
      }
    });
  }

  const depositRows = this.deposits.map(d => {
    const member = this.findMember ? this.findMember(d.memberID) : null;
    const userTypeStr = member ? (member.userType || '').toUpperCase() : '';
    const isExternal = userTypeStr.includes('EXTERNAL') || (d.memberID && d.memberID.startsWith('EXT-'));

    const rawDate = d.datePaid || d.date;
    const displayDate = (rawDate && rawDate !== 'undefined') ? rawDate : 'Not provided';
    const memberName = member ? member.name : (d.memberName && d.memberName !== 'undefined' ? d.memberName : 'External User');

    if (!isExternal) {
      return `
        <tr>
          <td><code>${d.depositID || 'N/A'}</code></td>
          <td>${d.memberID || 'N/A'}</td>
          <td><strong>${memberName}</strong></td>
          <td><span style="color:var(--text-muted);">N/A</span></td>
          <td>${displayDate}</td>
          <td><span class="badge badge-muted">N/A</span></td>
          <td><span style="color:var(--text-muted); font-size:0.8rem;">N/A (Internal User)</span></td>
        </tr>
      `;
    }

    const isRefunded = d.status === 'REFUNDED';
    const activeLoan = activeLoansMap[d.memberID] || (d.transactionID ? activeLoansMap[d.transactionID] : null) || (d.loanStatus === 'ISSUED' ? true : null);
    const amountVal = parseFloat(d.amount) || 500;

    return `
      <tr>
        <td><code>${d.depositID || 'DEP-701'}</code></td>
        <td>${d.memberID}</td>
        <td><strong>${memberName}</strong></td>
        <td><strong style="color:var(--primary);">₹${amountVal.toFixed(2)}</strong></td>
        <td>${displayDate}</td>
        <td>
          <span class="badge ${isRefunded ? 'badge-success' : 'badge-warning'}">
            ${isRefunded ? 'REFUNDED' : 'HELD'}
          </span>
        </td>
        <td>
          ${isRefunded ? `
            <span style="color:var(--success); font-weight:700; font-size:0.85rem;">Refunded ✓</span>
          ` : activeLoan ? `
            <span style="color:var(--warning); font-weight:600; font-size:0.8rem;" title="Book '${activeLoan.bookTitle}' is currently issued. Return book before deposit refund.">Book Issued (Return First)</span>
          ` : `
            <button class="btn btn-sm btn-danger" style="background:#ef4444; color:white; border:none; padding:5px 12px; font-weight:700; border-radius:4px; cursor:pointer;" onclick="app.refundDeposit('${d.depositID}')">[PROCESS REFUND]</button>
          `}
        </td>
      </tr>
    `;
  });

  return `
    <div class="page-title-row">
      <div>
        <h1 class="page-heading">External User Security Deposits</h1>
        <p class="page-subtext">Manage ₹500 refundable security deposits for visiting researchers and external patrons</p>
      </div>
    </div>

    <div class="content-card">
      <table class="custom-table">
        <thead>
          <tr>
            <th>DEPOSIT ID</th>
            <th>MEMBER ID</th>
            <th>MEMBER NAME</th>
            <th>AMOUNT</th>
            <th>DATE PAID</th>
            <th>STATUS</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          ${depositRows.join('') || `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No external deposits recorded.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
};
