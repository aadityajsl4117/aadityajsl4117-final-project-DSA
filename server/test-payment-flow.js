const http = require('http');
const { db, initDB } = require('./db');

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(json.error || `HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse JSON response (${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runPaymentTest() {
  console.log("==================================================");
  console.log("💳 TESTING PAYMENT SETTLEMENT & PATRON NAME FLOW");
  console.log("==================================================\n");

  await initDB();

  // Reset TXN-9001 to UNPAID with fine for testing if needed
  await db.execute(
    "UPDATE loans SET payment_status = 'UNPAID', fine_amount = 235.0 WHERE transaction_id = 'TXN-9001'"
  );

  // 1. Test Bootstrap API & Patron Name Mapping
  const bootstrapBefore = await makeRequest('GET', '/api/bootstrap');
  const txnBefore = bootstrapBefore.transactions.find(t => t.transactionID === 'TXN-9001');
  console.log("1. Pre-Payment Loan State:", {
    transactionID: txnBefore.transactionID,
    memberID: txnBefore.memberID,
    memberName: txnBefore.memberName,
    bookTitle: txnBefore.bookTitle,
    dueDate: txnBefore.dueDate,
    paymentStatus: txnBefore.paymentStatus
  });

  if (!txnBefore.memberName || txnBefore.memberName === 'undefined') {
    throw new Error("Patron name mapped as undefined!");
  }
  console.log("✅ Patron Name mapped correctly:", txnBefore.memberName);

  // 2. Settle Fine via /api/payments/settle
  const settleRes = await makeRequest('POST', '/api/payments/settle', {
    transactionID: 'TXN-9001',
    amount: 235.00,
    method: 'UPI_QR'
  });
  console.log("2. Payment Settlement Response:", settleRes);

  if (!settleRes.success) {
    throw new Error("Payment settlement API failed!");
  }
  console.log("✅ Payment Settlement API succeeded");

  // 3. Direct SQLite DB Persistence Check
  const loanInDB = await db.getOne("SELECT * FROM loans WHERE transaction_id = 'TXN-9001'");
  const paymentInDB = await db.getOne("SELECT * FROM payments WHERE transaction_id = 'TXN-9001'");
  const historyInDB = await db.getOne("SELECT * FROM history WHERE transaction_id = 'TXN-9001' AND action = 'FINE_PAYMENT'");

  console.log("3. Database Direct Check:", {
    loanPaymentStatus: loanInDB.payment_status,
    loanFineAmount: loanInDB.fine_amount,
    paymentRecordID: paymentInDB ? paymentInDB.payment_id : null,
    historyAction: historyInDB ? historyInDB.action : null,
    historyMemberName: historyInDB ? historyInDB.member_name : null
  });

  if (loanInDB.payment_status !== 'PAID') {
    throw new Error("Loan payment_status is not PAID in database!");
  }
  if (parseFloat(loanInDB.fine_amount) !== 0) {
    throw new Error("Loan fine_amount was not reset to 0 in database!");
  }
  if (!historyInDB || historyInDB.member_name === 'undefined') {
    throw new Error("History log missing or contains undefined patron name!");
  }
  console.log("✅ Database record updated and history verified");

  // 4. Test Idempotency (Repeat Settle Request)
  const repeatRes = await makeRequest('POST', '/api/payments/settle', {
    transactionID: 'TXN-9001',
    amount: 235.00,
    method: 'UPI_QR'
  });
  console.log("4. Idempotent Settle Response:", repeatRes);
  if (!repeatRes.success) {
    throw new Error("Idempotency request failed!");
  }
  console.log("✅ Idempotent duplicate check passed");

  // 5. Post-Payment Bootstrap API Check
  const bootstrapAfter = await makeRequest('GET', '/api/bootstrap');
  const txnAfter = bootstrapAfter.transactions.find(t => t.transactionID === 'TXN-9001');
  console.log("5. Post-Payment Loan State:", {
    transactionID: txnAfter.transactionID,
    paymentStatus: txnAfter.paymentStatus,
    fineAmount: txnAfter.fineAmount
  });

  if (txnAfter.paymentStatus !== 'PAID') {
    throw new Error("Post-payment bootstrap still returns UNPAID!");
  }
  console.log("✅ Post-payment bootstrap verified");

  console.log("\n==================================================");
  console.log("🎉 ALL PAYMENT SETTLEMENT & PATRON NAME TESTS PASSED!");
  console.log("==================================================");
}

runPaymentTest().catch(err => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
