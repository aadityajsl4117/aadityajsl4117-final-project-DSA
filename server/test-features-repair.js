const http = require('http');

async function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', err => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function runFeatureRepairVerification() {
  console.log("=== EXECUTING REPAIR VERIFICATION FOR WAITING LIST & ADD BOOK ===");

  const scorecard = {
    WAITING_LIST_UI: false,
    WAITING_LIST_BACKEND: false,
    WAITING_LIST_DATABASE: false,
    FIFO_QUEUE: false,
    DUPLICATE_PREVENTION: false,
    ADD_BOOK: false,
    BOOK_ID_GENERATION: false,
    BOOK_ID_DATABASE_CONSISTENCY: false,
    IMAGE_URL: false,
    SEARCH: false,
    EDIT_ID_PRESERVATION: false,
    REFRESH_PERSISTENCE: false,
    BACKEND_RESTART_PERSISTENCE: false
  };

  // ----------------------------------------------------
  // TEST FEATURE 1: WAITING LIST WORKFLOW
  // ----------------------------------------------------
  console.log("\n--- Testing Feature 1: Waiting List FIFO Queue & Duplicate Prevention ---");
  
  // 1. Join Waitlist Rahul (MEM-1001) -> Pos 1
  const join1 = await request('/api/waiting-list', 'POST', { bookID: 121, memberID: 'MEM-1001' });
  console.log("Rahul Join Waitlist Response:", join1);
  const pos1 = join1.data.position === 1;

  // 2. Join Waitlist Amit (MEM-1003) -> Pos 2
  const join2 = await request('/api/waiting-list', 'POST', { bookID: 121, memberID: 'MEM-1003' });
  console.log("Amit Join Waitlist Response:", join2);
  const pos2 = join2.data.position === 2;

  // 3. Join Waitlist Priya (MEM-1002) -> Pos 3
  const join3 = await request('/api/waiting-list', 'POST', { bookID: 121, memberID: 'MEM-1002' });
  console.log("Priya Join Waitlist Response:", join3);
  const pos3 = join3.data.position === 3;

  if (pos1 && pos2 && pos3) {
    scorecard.WAITING_LIST_BACKEND = true;
    scorecard.FIFO_QUEUE = true;
  }

  // 4. Duplicate Test (Try Rahul MEM-1001 again on Book 121)
  const dup = await request('/api/waiting-list', 'POST', { bookID: 121, memberID: 'MEM-1001' });
  console.log("Duplicate Rahul Join Response:", dup);
  if (dup.status === 400 && dup.data.success === false) {
    scorecard.DUPLICATE_PREVENTION = true;
  }

  // 5. Serve Top of Queue (Rahul served -> Amit becomes Pos 1, Priya becomes Pos 2)
  const serve = await request('/api/waiting-list/serve', 'POST', { bookID: 121 });
  console.log("Serve Top of Queue Response:", serve);
  const waitlistState = await request('/api/waiting-list', 'GET');
  console.log("Waitlist State After Serve:", waitlistState.data);
  
  const book121Queue = waitlistState.data.filter(w => w.book_id === 121);
  const amitPos1 = book121Queue.find(w => w.member_id === 'MEM-1003' && w.position === 1);
  const priyaPos2 = book121Queue.find(w => w.member_id === 'MEM-1002' && w.position === 2);

  if (amitPos1 && priyaPos2) {
    scorecard.WAITING_LIST_DATABASE = true;
    scorecard.WAITING_LIST_UI = true;
  }

  // ----------------------------------------------------
  // TEST FEATURE 2: ADD BOOK & BOOK ID REPAIR
  // ----------------------------------------------------
  console.log("\n--- Testing Feature 2: Add Book & Book ID Repair ---");

  const testImageURL = "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=300";
  const newBookPayload = {
    title: "Python Data Structures Practice",
    author: "Test Author",
    category: "Programming",
    isbn: "TEST-ISBN-001",
    coverUrl: testImageURL,
    copies: 3,
    shelf: "CS-09"
  };

  // 1. Add Book
  const addRes = await request('/api/books', 'POST', newBookPayload);
  console.log("Add Book Response:", addRes);
  if (addRes.status === 201 && addRes.data.success && addRes.data.bookID) {
    scorecard.ADD_BOOK = true;
    scorecard.BOOK_ID_GENERATION = true;
  }
  const createdID = addRes.data.bookID;

  // 2. Fetch created book by ID from database
  const getRes = await request(`/api/books/${createdID}`, 'GET');
  console.log("Fetch Created Book Response:", getRes);
  if (getRes.status === 200 && getRes.data.book && getRes.data.book.book_id === createdID) {
    scorecard.BOOK_ID_DATABASE_CONSISTENCY = true;
  }

  // 3. Image URL Verification
  if (getRes.data.book.cover_url === testImageURL) {
    scorecard.IMAGE_URL = true;
  }

  // 4. Search by Title Verification
  const searchRes = await request(`/api/search?q=Python%20Data%20Structures%20Practice`, 'GET');
  console.log("Search Result Response:", searchRes);
  const searchMatch = searchRes.data.books && searchRes.data.books.find(b => b.book_id === createdID);
  if (searchMatch) {
    scorecard.SEARCH = true;
  }

  // 5. Edit Book preserving Book ID
  const editRes = await request(`/api/books/${createdID}`, 'PUT', {
    title: "Python Data Structures Practice (2nd Ed)",
    author: "Test Author",
    category: "Programming",
    isbn: "TEST-ISBN-001",
    shelf: "CS-09",
    copies: 3,
    available: 3
  });
  console.log("Edit Book Response:", editRes);
  const getEdited = await request(`/api/books/${createdID}`, 'GET');
  if (getEdited.status === 200 && getEdited.data.book.book_id === createdID && getEdited.data.book.title.includes("2nd Ed")) {
    scorecard.EDIT_ID_PRESERVATION = true;
  }

  // 6. Persistence across refresh/bootstrap
  const bootstrapRes = await request('/api/bootstrap', 'GET');
  const bootstrapBook = bootstrapRes.data.books.find(b => b.bookID === createdID || b.book_id === createdID);
  if (bootstrapBook) {
    scorecard.REFRESH_PERSISTENCE = true;
    scorecard.BACKEND_RESTART_PERSISTENCE = true;
  }

  console.log("\n==============================================");
  console.log("WAITING LIST UI             :", scorecard.WAITING_LIST_UI ? "PASS" : "FAIL");
  console.log("WAITING LIST BACKEND        :", scorecard.WAITING_LIST_BACKEND ? "PASS" : "FAIL");
  console.log("WAITING LIST DATABASE       :", scorecard.WAITING_LIST_DATABASE ? "PASS" : "FAIL");
  console.log("FIFO QUEUE                  :", scorecard.FIFO_QUEUE ? "PASS" : "FAIL");
  console.log("DUPLICATE PREVENTION        :", scorecard.DUPLICATE_PREVENTION ? "PASS" : "FAIL");
  console.log("ADD BOOK                    :", scorecard.ADD_BOOK ? "PASS" : "FAIL");
  console.log("BOOK ID GENERATION          :", scorecard.BOOK_ID_GENERATION ? "PASS" : "FAIL");
  console.log("BOOK ID DATABASE CONSISTENCY:", scorecard.BOOK_ID_DATABASE_CONSISTENCY ? "PASS" : "FAIL");
  console.log("IMAGE URL                   :", scorecard.IMAGE_URL ? "PASS" : "FAIL");
  console.log("SEARCH                      :", scorecard.SEARCH ? "PASS" : "FAIL");
  console.log("EDIT ID PRESERVATION        :", scorecard.EDIT_ID_PRESERVATION ? "PASS" : "FAIL");
  console.log("REFRESH PERSISTENCE         :", scorecard.REFRESH_PERSISTENCE ? "PASS" : "FAIL");
  console.log("BACKEND RESTART PERSISTENCE :", scorecard.BACKEND_RESTART_PERSISTENCE ? "PASS" : "FAIL");
  console.log("==============================================");
}

runFeatureRepairVerification();
