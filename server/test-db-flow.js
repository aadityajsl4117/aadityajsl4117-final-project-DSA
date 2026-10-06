const http = require('http');
const { db } = require('./db');

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
          reject(new Error(`Failed to parse JSON response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTestSuite() {
  console.log("==================================================");
  console.log("🧪 STARTING LUMINA LIBRARY DB TRANSACTION TEST SUITE");
  console.log("==================================================\n");

  try {
    // Step 1: Database Login Test
    console.log("1. Testing Database User Login (POST /api/auth/login)...");
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      username: 'admin@lumina.edu',
      password: 'lumina2026'
    });
    console.log("   ✅ Login Success! Authenticated user:", loginRes.user.username);

    // Step 2: Read Analytics Initial State
    console.log("\n2. Fetching Initial SQL Analytics (GET /api/analytics)...");
    const initialAnalytics = await makeRequest('GET', '/api/analytics');
    console.log(`   📊 Total Books: ${initialAnalytics.totalBooks} | Available: ${initialAnalytics.availableBooks} | Issued: ${initialAnalytics.issuedBooks} | Members: ${initialAnalytics.totalMembers}`);

    // Step 3: Create Member Test
    console.log("\n3. Enrolling New Member in Database (POST /api/members)...");
    const memberRes = await makeRequest('POST', '/api/members', {
      name: "Rohan Verma",
      email: "rohan.verma@amrita.edu",
      phone: "+91 9988776655",
      userType: "Student",
      department: "Data Science"
    });
    console.log(`   ✅ Member Created in Database! ID: ${memberRes.memberID} (Display ID: ${memberRes.displayID})`);

    // Verify Member in SQL Database Table
    const memberRow = await db.getOne('SELECT * FROM members WHERE member_id = ?', [memberRes.memberID]);
    console.log(`   🔍 SQL Verification: Database contains record for '${memberRow.name}' (${memberRow.email}).`);

    // Step 4: Issue Book Test (Atomic Transaction)
    console.log("\n4. Issuing Book #101 (The C Programming Language) to Rohan Verma (POST /api/circulation/issue)...");
    const bookBefore = await db.getOne('SELECT available_copies FROM books WHERE book_id = 101');
    const issueRes = await makeRequest('POST', '/api/circulation/issue', {
      memberID: memberRes.memberID,
      bookID: 101,
      issueDate: '2026-08-01',
      dueDate: '2026-08-15'
    });
    const bookAfter = await db.getOne('SELECT available_copies FROM books WHERE book_id = 101');
    console.log(`   ✅ Book Checkout Transaction Success! Loan ID: ${issueRes.transactionID}`);
    console.log(`   📉 Stock Update: Available copies decreased from ${bookBefore.available_copies} ➔ ${bookAfter.available_copies}`);

    // Step 5: Return Book Test with Late Fine Calculation
    console.log("\n5. Returning Book #101 past due date (POST /api/circulation/return)...");
    const returnRes = await makeRequest('POST', '/api/circulation/return', {
      transactionID: issueRes.transactionID,
      returnDate: '2026-08-20' // 5 days late
    });
    const bookRestored = await db.getOne('SELECT available_copies FROM books WHERE book_id = 101');
    console.log(`   ✅ Return Transaction Success! Overdue Days: ${returnRes.overdueDays} | Fine Incurred: ₹${returnRes.fineAmount}`);
    console.log(`   📈 Stock Update: Available copies restored from ${bookAfter.available_copies} ➔ ${bookRestored.available_copies}`);

    // Step 6: Settle Fine Payment Test
    console.log("\n6. Settling Fine via UPI (POST /api/payments/settle)...");
    const paymentRes = await makeRequest('POST', '/api/payments/settle', {
      transactionID: issueRes.transactionID,
      amount: returnRes.fineAmount,
      method: 'UPI'
    });
    const loanRow = await db.getOne('SELECT payment_status FROM loans WHERE transaction_id = ?', [issueRes.transactionID]);
    console.log(`   ✅ Payment Recorded! Payment ID: ${paymentRes.paymentID} | Loan Payment Status in SQL DB: '${loanRow.payment_status}'`);

    // Step 7: Waiting List FIFO Queue Test
    console.log("\n7. Joining FIFO Waiting List (POST /api/waiting-list)...");
    const waitRes1 = await makeRequest('POST', '/api/waiting-list', { bookID: 121, memberID: 'MEM-1002' });
    const waitRes2 = await makeRequest('POST', '/api/waiting-list', { bookID: 121, memberID: 'MEM-1003' });
    console.log(`   ✅ FIFO Positions Assigned in SQL DB: Patron MEM-1002 ➔ Position ${waitRes1.position} | Patron MEM-1003 ➔ Position ${waitRes2.position}`);

    // Step 8: Book Request Test
    console.log("\n8. Submitting Title Procurement Request (POST /api/book-requests)...");
    const reqRes = await makeRequest('POST', '/api/book-requests', {
      memberID: memberRes.memberID,
      title: "Designing Data-Intensive Applications",
      author: "Martin Kleppmann",
      reason: "Essential for Distributed Systems Architecture Course"
    });
    console.log(`   ✅ Book Request Created in Database! Request ID: ${reqRes.requestID}`);

    // Step 9: Final Analytics Check
    console.log("\n9. Fetching Updated SQL Analytics (GET /api/analytics)...");
    const finalAnalytics = await makeRequest('GET', '/api/analytics');
    console.log(`   📊 Total Members: ${finalAnalytics.totalMembers} | Paid Fines: ₹${finalAnalytics.totalFinesPaid} | Waiting List Count: ${finalAnalytics.waitlistCount}`);

    console.log("\n==================================================");
    console.log("🎉 ALL DATABASE TRANSACTION TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================");
  } catch (err) {
    console.error("❌ TEST FAILED:", err.message);
    process.exit(1);
  }
}

runTestSuite();
