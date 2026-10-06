/* PAYMENT RECORDING & DEPOSIT REFUND ENGINE */
LuminaLibrary.prototype.recordFinePayment = async function(txnID, amount, method) {
  const tx = this.transactionList.find(t => t.transactionID === txnID);
  if (tx && tx.paymentStatus === "PAID") {
    this.showToast("Payment is already settled for this loan.");
    this.closeModal();
    return;
  }
  
  try {
    if (window.LuminaAPI) {
      await window.LuminaAPI.settlePayment({ transactionID: txnID, amount, method });
      if (tx) {
        tx.paymentStatus = "PAID";
        tx.fineAmount = 0;
      }
      this.showToast(`Fine of ₹${amount.toFixed(2)} settled via ${method}!`);
      if (tx) {
        const member = this.findMember(tx.memberID);
        if (member) {
          this.sendLibraryEmail({
            member: member,
            subject: `PAYMENT RECEIPT: ₹${amount.toFixed(2)} Received`,
            message: `Dear ${member.name},\n\nPayment of ₹${amount.toFixed(2)} for Loan ID #${txnID} via ${method} has been received and cleared.\n\nThank you!`,
            book_name: tx.bookTitle,
            book_id: tx.bookID,
            fine: `₹${amount.toFixed(2)}`,
            status: "PAYMENT_RECEIPT"
          });
        }
      }
      this.closeModal();
      await this.loadState();
      return;
    }
  } catch (err) {
    this.showToast(err.message || "Failed to record payment in database", true);
    return;
  }

  // Fallback Local Mutation
  if (tx) {
    tx.paymentStatus = "PAID";
    tx.fineAmount = 0;
  }

  const member = tx ? this.findMember(tx.memberID) : null;
  const patronName = member ? member.name : (tx && tx.memberName ? tx.memberName : "N/A");

  this.logHistory("FINE_PAYMENT", "PAYMENTS", {
    transactionID: txnID,
    memberID: tx ? tx.memberID : "N/A",
    memberName: patronName,
    description: `Settled fine of ₹${amount.toFixed(2)} via ${method}. Receipt generated.`
  });

  this.showToast(`Fine of ₹${amount.toFixed(2)} settled via ${method}!`);
  this.closeModal();
  this.saveState();
  this.render();
};

LuminaLibrary.prototype.refundDeposit = async function(depID) {
  const dep = this.deposits.find(d => d.depositID === depID || d.memberID === depID);
  const memberName = dep ? (dep.memberName || dep.memberID) : depID;
  const amount = dep ? (dep.amount || 500) : 500;

  const confirmed = confirm(`Are you sure you want to process ₹${amount.toFixed(2)} deposit refund for ${memberName}?`);
  if (!confirmed) return;

  try {
    if (window.LuminaAPI) {
      await window.LuminaAPI.refundDeposit(depID);
      this.showToast(`Security deposit ₹${amount.toFixed(2)} refunded to ${memberName}!`);
      await this.loadState();
      return;
    }
  } catch (err) {
    this.showToast(err.message || "Failed to process deposit refund in database", true);
    return;
  }

  // Fallback
  if (dep) {
    dep.status = "REFUNDED";
    dep.refundID = `REF-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  const member = this.findMember(dep ? dep.memberID : depID);
  if (member) {
    member.depositAmount = 0;
    member.depositStatus = "REFUNDED";
  }

  this.logHistory("REFUND_DEPOSIT", "DEPOSITS", {
    memberID: dep ? dep.memberID : depID,
    memberName: memberName,
    description: `Refunded ₹${amount.toFixed(2)} security deposit.`
  });

  this.showToast(`Security deposit ₹${amount.toFixed(2)} refunded to ${memberName}.`);
  this.saveState();
  this.render();
};
