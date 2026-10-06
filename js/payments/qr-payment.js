/* DYNAMIC UPI QR CODE PAYMENT MODAL GENERATOR */
LuminaLibrary.prototype.openPaymentModal = function(txnID, amount) {
  const modal = document.getElementById("app-modal");
  const dialog = document.getElementById("modal-content");
  const tx = this.transactionList.find(t => t.transactionID === txnID);
  const numAmount = parseFloat(amount);
  const isValidAmount = !isNaN(numAmount) && numAmount > 0;
  const displayAmount = isValidAmount ? numAmount.toFixed(2) : "0.00";

  dialog.innerHTML = `
    <div class="payment-receipt-wrap">
      <div class="payment-card-left">
        <span class="badge badge-primary" style="margin-bottom:8px;">Instant UPI Settlement</span>
        <h3 style="font-size:1.1rem; font-weight:800; color:var(--text-main);">Scan to Pay Fine</h3>
        <div class="qr-visual-box">
          <div id="payment-fine-qr"></div>
        </div>
        <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted);">Compatible with GPay, PhonePe, Paytm, BHIM</span>
      </div>

      <div class="payment-card-right">
        <div>
          <h3 style="font-size:1.15rem; font-weight:800; margin-bottom:12px;">Fine Receipt Details</h3>
          <div style="background:var(--bg-card-subtle); padding:14px; border-radius:var(--radius-sm); font-size:0.83rem; line-height:1.7; margin-bottom:16px;">
            <div><strong>Loan ID:</strong> <code>${txnID}</code></div>
            <div><strong>Book:</strong> ${tx ? tx.bookTitle : 'N/A'}</div>
            <div><strong>Patron:</strong> ${tx ? ((tx.memberName && tx.memberName !== 'undefined') ? tx.memberName : (this.findMember(tx.memberID)?.name || 'Patron')) : 'N/A'} (<code>${tx ? tx.memberID : ''}</code>)</div>
            <div><strong>Due Date:</strong> ${tx ? tx.dueDate : ''}</div>
            <div style="border-top:1px solid var(--border-subtle); margin-top:8px; padding-top:6px; font-size:1.05rem;">
              <strong>Total Amount Due:</strong> <strong style="color:var(--danger);">₹${displayAmount}</strong>
            </div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px;">
          <button class="btn btn-primary" onclick="app.recordFinePayment('${txnID}', ${isValidAmount ? numAmount : 0}, 'UPI_QR')">
            ⚡ Confirm UPI QR Payment
          </button>
          <button class="btn" onclick="app.recordFinePayment('${txnID}', ${isValidAmount ? numAmount : 0}, 'CASH')">
            💵 Settle via Cash Desk
          </button>
          <button class="btn" onclick="app.closeModal()" style="border:none; color:var(--text-muted);">
            Cancel
          </button>
        </div>
      </div>
    </div>
  `;

  modal.style.display = "grid";

  setTimeout(() => {
    const el = document.getElementById("payment-fine-qr");
    if (!el) return;
    el.innerHTML = "";

    if (!isValidAmount) {
      el.innerHTML = `<span style="font-size:0.78rem; color:var(--danger); font-weight:700; padding:12px; text-align:center; display:block;">Invalid payment amount.</span>`;
      return;
    }

    if (typeof QRCode === "undefined") {
      el.innerHTML = `<span style="font-size:0.78rem; color:var(--warning); font-weight:700; padding:12px; text-align:center; display:block;">QR generation unavailable. Please try again.</span>`;
      return;
    }

    try {
      const upiData = `upi://pay?pa=libraryamrita@upi&pn=LuminaLibrary&am=${numAmount.toFixed(2)}&cu=INR`;
      new QRCode(el, { text: upiData, width: 150, height: 150 });
    } catch (err) {
      console.error("QRCode generation error:", err);
      el.innerHTML = `<span style="font-size:0.78rem; color:var(--warning); font-weight:700; padding:12px; text-align:center; display:block;">QR generation unavailable. Please try again.</span>`;
    }
  }, 50);
};

LuminaLibrary.prototype.openQuickPaymentModal = function() {
  const activeLoans = this.transactionList.toArray().filter(t => t.status === "ISSUED");
  const overdueLoans = activeLoans.filter(t => this.calculateOverdueDays(t.dueDate) > 0 && t.paymentStatus !== "PAID");
  
  const targetTx = overdueLoans.length > 0 ? overdueLoans[0] : (activeLoans.length > 0 ? activeLoans[0] : null);
  const txnID = targetTx ? targetTx.transactionID : 'TXN-9010';
  const days = targetTx ? this.calculateOverdueDays(targetTx.dueDate) : 10;
  const amount = days > 0 ? (days * this.fineRatePerDay) : 50;

  this.openPaymentModal(txnID, amount);
};
