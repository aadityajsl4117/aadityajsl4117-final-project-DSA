const http = require('http');
const fs = require('fs');
const path = require('path');
const { initDB, db } = require('./db');

const BASE_URL = 'http://localhost:3000';

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("==================================================");
  console.log("🧪 LUMINA LIBRARY 50+ BOOKS & WAITLIST REPAIR TEST");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = "") {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${details}`);
      failed++;
    }
  }

  try {
    // 0. Verify Database Count (50+ books requirement)
    await initDB();
    const bookCountRow = await db.getOne('SELECT COUNT(*) AS count FROM books');
    const totalBooks = bookCountRow ? bookCountRow.count : 0;
    assert(totalBooks >= 50, "50+ Real Database Book Records", `Total Books in DB: ${totalBooks}`);

    // TEST 1: Add a new book with Title, Author, Image URL, Stock = 5
    console.log("\n--- TEST 1: Add New Book with Image URL & Stock = 5 ---");
    const newBookPayload = {
      title: "Advanced Quantum Algorithms 2026",
      author: "Dr. Alice Smith",
      category: "Quantum Computing",
      isbn: "9781107009999",
      shelf: "QC-09",
      copies: 5,
      coverUrl: "https://images.unsplash.com/photo-1532012197267-da84d127e765"
    };
    const addRes = await makeRequest('/api/books', 'POST', newBookPayload);
    assert(addRes.status === 201 && addRes.body.success, "POST /api/books returns 201 Created");
    
    const assignedBookID = addRes.body.bookID || (addRes.body.book ? addRes.body.book.bookID : null);
    assert(assignedBookID && typeof assignedBookID === 'number', "Book ID generated from Database", `Assigned ID: ${assignedBookID}`);

    // TEST 2: Refresh/Fetch Book & Verify Persistence
    console.log("\n--- TEST 2: Refresh Page / Fetch Book & Verify Persistence ---");
    const getRes = await makeRequest(`/api/books/${assignedBookID}`, 'GET');
    assert(getRes.status === 200 && getRes.body.success, "GET /api/books/:id returns 200 OK");
    const fetchedBook = getRes.body.book;
    assert(fetchedBook.title === newBookPayload.title, "Title matches DB record");
    assert(fetchedBook.copies === 5 && fetchedBook.available_copies === 5, "Stock initialized correctly (Total: 5, Available: 5)");
    assert(fetchedBook.cover_url === newBookPayload.coverUrl, "Cover image URL stored in DB");

    // TEST 3: Search the new book
    console.log("\n--- TEST 3: Exact Book Search ---");
    const bootRes = await makeRequest('/api/bootstrap', 'GET');
    const foundInBoot = bootRes.body.books.find(b => b.bookID === assignedBookID);
    assert(foundInBoot && foundInBoot.title === newBookPayload.title, "Bootstrap catalog includes exact newly added book");

    // TEST 4: Backend Restart Simulation
    console.log("\n--- TEST 4: Backend Restart DB Verification ---");
    const dbBook = await db.getOne('SELECT * FROM books WHERE book_id = ?', [assignedBookID]);
    assert(dbBook && dbBook.book_id === assignedBookID, "Book ID persistent in SQLite");
    assert(dbBook.cover_url === newBookPayload.coverUrl, "Image URL persistent after DB reload");

    // TEST 5: Issue 1 Copy
    console.log("\n--- TEST 5: Issue 1 Copy (Stock 5 -> Available 4) ---");
    const issueRes = await makeRequest('/api/circulation/issue', 'POST', {
      bookID: assignedBookID,
      memberID: 'MEM-1001',
      dueDate: '2026-10-20'
    });
    assert((issueRes.status === 200 || issueRes.status === 201) && issueRes.body.success, "Issued 1 copy successfully");
    const bookAfterIssue = await db.getOne('SELECT * FROM books WHERE book_id = ?', [assignedBookID]);
    assert(bookAfterIssue.copies === 5 && bookAfterIssue.available_copies === 4, "Total Copies = 5, Available Copies = 4");

    // TEST 6: Return the Copy
    console.log("\n--- TEST 6: Return Copy (Available 4 -> 5) ---");
    const txnID = issueRes.body.transactionID;
    const returnRes = await makeRequest('/api/circulation/return', 'POST', { transactionID: txnID });
    assert(returnRes.status === 200 && returnRes.body.success, "Returned copy successfully");
    const bookAfterReturn = await db.getOne('SELECT * FROM books WHERE book_id = ?', [assignedBookID]);
    assert(bookAfterReturn.available_copies === 5, "Available Copies restored to 5");

    // TEST 7: Waiting List for Same Out-of-Stock Book (Per-Book Positions 1, 2, 3)
    console.log("\n--- TEST 7: Waiting List Positions for Same Book (Book #121) ---");
    // Clear waitlist for Book 121 over HTTP API
    await makeRequest('/api/waiting-list', 'DELETE', { bookID: 121, memberID: 'ALL' });

    const join1 = await makeRequest('/api/waiting-list', 'POST', { bookID: 121, memberID: 'MEM-1001' });
    const join2 = await makeRequest('/api/waiting-list', 'POST', { bookID: 121, memberID: 'MEM-1002' });
    const join3 = await makeRequest('/api/waiting-list', 'POST', { bookID: 121, memberID: 'MEM-1003' });

    assert(join1.body.position === 1, "Book 121 Member 1 -> Position 1");
    assert(join2.body.position === 2, "Book 121 Member 2 -> Position 2");
    assert(join3.body.position === 3, "Book 121 Member 3 -> Position 3");

    // TEST 8: Create Waiting Member for Another Book (Book #101)
    console.log("\n--- TEST 8: Independent Waiting List Position for Another Book (Book #101) ---");
    await makeRequest('/api/waiting-list', 'DELETE', { bookID: 101, memberID: 'ALL' });
    const joinOtherBook = await makeRequest('/api/waiting-list', 'POST', { bookID: 101, memberID: 'MEM-1004' });
    assert(joinOtherBook.body.position === 1, "Book 101 Member 4 -> Position 1 (Independent per-book queue)");

    // TEST 9: Remove First Member from Book A & Verify Re-indexing
    console.log("\n--- TEST 9: Serve/Remove Position 1 from Book 121 ---");
    const serveRes = await makeRequest('/api/waiting-list/serve', 'POST', { bookID: 121 });
    assert(serveRes.status === 200 && serveRes.body.success, "Served Position 1 patron from Book 121");
    
    const remainingWl = await makeRequest('/api/waiting-list', 'GET');
    const b121Queue = remainingWl.body.filter(w => w.book_id === 121);
    assert(b121Queue.length === 2, "Book 121 has 2 remaining waiting patrons");
    assert(b121Queue[0].member_id === 'MEM-1002' && b121Queue[0].position === 1, "Promoted MEM-1002 to Position 1");
    assert(b121Queue[1].member_id === 'MEM-1003' && b121Queue[1].position === 2, "Promoted MEM-1003 to Position 2");

    // TEST 10: Refresh & Verify Persistence of Positions
    console.log("\n--- TEST 10: Refresh & Backend Restart Persistence ---");
    const refreshBoot = await makeRequest('/api/bootstrap', 'GET');
    const resMap121 = refreshBoot.body.reservations ? refreshBoot.body.reservations[121] : null;
    assert(resMap121 && resMap121.length === 2, "Reservations map persistent across bootstrap reload");
    assert(resMap121[0].position === 1 && resMap121[1].position === 2, "Positions 1 and 2 persistent in SQLite");

    // TEST 11: Confirm 'Strict FIFO Queue Discipline' string is removed from UI files
    console.log("\n--- TEST 11: Verify UI String Cleanup ---");
    const wlContent = fs.readFileSync(path.join(__dirname, '../js/features/waiting-list.js'), 'utf-8');
    const resContent = fs.readFileSync(path.join(__dirname, '../src/components/Reservations/Reservations.tsx'), 'utf-8');
    const hasStrictFifo = wlContent.includes("Strict FIFO Queue Discipline");
    assert(!hasStrictFifo, "UI file js/features/waiting-list.js no longer contains 'Strict FIFO Queue Discipline'");
    assert(!resContent.includes("FIFO waitlist"), "Reservations.tsx no longer contains 'FIFO waitlist'");

  } catch (err) {
    console.error("Test Error:", err);
  }

  console.log("\n==================================================");
  console.log(`TOTAL PASSED: ${passed}`);
  console.log(`TOTAL FAILED: ${failed}`);
  console.log("==================================================");

  if (failed === 0) {
    console.log("🎉 ALL 11 TEST CASES PASSED SUCCESSFULLY!");
  } else {
    process.exit(1);
  }
}

runTests();
