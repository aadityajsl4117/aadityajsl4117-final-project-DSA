const http = require('http');

function postJSON(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data || {});
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, raw: body }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getJSON(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, raw: body }); }
      });
    }).on('error', reject);
  });
}

async function verifyDepositSectionRepair() {
  console.log("==================================================");
  console.log("🧪 VERIFYING REPAIRED EXTERNAL DEPOSIT SECTION");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      failed++;
    }
  }

  // 1. Fetch bootstrap deposits
  const bootstrapRes = await getJSON('/api/bootstrap');
  assert(bootstrapRes.status === 200 && Array.isArray(bootstrapRes.data.deposits), "GET /api/bootstrap returns deposits array");
  console.log(`Loaded ${bootstrapRes.data.deposits.length} deposit records`);

  // Find or create external user deposit with HELD status
  let extDep = bootstrapRes.data.deposits.find(d => d.status === 'HELD' && (d.memberID === 'EXT-401' || d.memberID.startsWith('EXT-'))) || { depositID: 'DEP-701', memberID: 'EXT-401' };

  // 2. Test active loan blocking (issue book to EXT-401 first)
  const issueRes = await postJSON('/api/circulation/issue', {
    memberID: extDep.memberID,
    bookID: 102
  });
  console.log("Issued book to external user for test:", issueRes.data.message || issueRes.status);

  // Attempt refund while book is issued
  const blockedRefundRes = await postJSON(`/api/deposits/${extDep.depositID}/refund`);
  assert(blockedRefundRes.status === 400, "Refunding deposit while book is issued returns HTTP 400");
  assert(blockedRefundRes.data.error.includes("active issued books"), "Returns clear error message requiring book return first");

  // 3. Return book to clear active loan
  const loanID = issueRes.data.transactionID || issueRes.data.loanID;
  if (loanID) {
    await postJSON('/api/circulation/return', { transactionID: loanID });
    console.log("Returned book for external user");
  }

  // 4. Now process deposit refund
  const refundRes = await postJSON(`/api/deposits/${extDep.depositID}/refund`);
  assert(refundRes.status === 200 && refundRes.data.success, `POST /api/deposits/${extDep.depositID}/refund processes refund successfully`);
  assert(refundRes.data.refundedAt !== undefined, "Stores actual refund date/timestamp");

  // 5. Verify status updated to REFUNDED in SQLite database
  const updatedBootstrap = await getJSON('/api/bootstrap');
  const dbDep = updatedBootstrap.data.deposits.find(d => d.depositID === extDep.depositID || d.memberID === extDep.memberID);
  assert(dbDep && dbDep.status === 'REFUNDED', "Deposit status changed HELD -> REFUNDED in SQLite database");
  assert(dbDep && dbDep.refundedAt !== null, "Refund timestamp persisted in database");

  // 6. Test duplicate refund prevention
  const dupRefundRes = await postJSON(`/api/deposits/${extDep.depositID}/refund`);
  assert(dupRefundRes.status === 400, "Refunding an already refunded deposit returns HTTP 400 (Duplicate refund blocked)");
  assert(dupRefundRes.data.error === "Deposit has already been refunded", "Returns error: 'Deposit has already been refunded'");

  console.log("\n==================================================");
  console.log(`TOTAL PASSED: ${passed}`);
  console.log(`TOTAL FAILED: ${failed}`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
}

verifyDepositSectionRepair().catch(err => {
  console.error("Test execution error:", err);
  process.exit(1);
});
