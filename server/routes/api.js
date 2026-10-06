const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../db');

// Helper date utilities
function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return new Date(dateStr);
}

function calculateOverdueDays(dueDateStr, returnDateStr = getTodayStr()) {
  const due = parseLocalDate(dueDateStr);
  const ret = parseLocalDate(returnDateStr);
  const diffTime = ret.getTime() - due.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

// Backend identity/health endpoint. This is served by the same API router
// used by the compatibility launcher, so the browser can verify the active backend.
router.get('/health', (req, res) => {
  return res.json({
    success: true,
    serverVersion: 10,
    memberDelete: 'hard-delete-verified',
    database: 'sqlite',
    pid: process.pid
  });
});

// 1. AUTHENTICATION API
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await db.getOne(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username.trim(), username.trim().toLowerCase()]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    return res.json({
      success: true,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login API Error:', err);
    return res.status(500).json({ error: 'Database authentication error' });
  }
});

// 2. FULL DATABASE BOOTSTRAP API
router.get('/bootstrap', async (req, res) => {
  try {
    const books = await db.query('SELECT * FROM books ORDER BY book_id ASC');
    const members = await db.query('SELECT * FROM members ORDER BY name ASC');
    const loans = await db.query('SELECT * FROM loans ORDER BY created_at DESC');
    const waitlist = await db.query('SELECT * FROM waiting_list WHERE status = "WAITING" ORDER BY book_id ASC, position ASC');
    const bookRequests = await db.query('SELECT * FROM book_requests ORDER BY created_at DESC');
    const payments = await db.query('SELECT * FROM payments ORDER BY created_at DESC');
    const deposits = await db.query('SELECT * FROM deposits ORDER BY created_at DESC');
    const emails = await db.query('SELECT * FROM emails ORDER BY created_at DESC');
    const notifications = await db.query('SELECT * FROM notifications ORDER BY created_at DESC');
    const feedbacks = await db.query('SELECT * FROM feedbacks ORDER BY created_at DESC');
    const history = await db.query('SELECT * FROM history ORDER BY created_at DESC');

    // Group waitlist by book_id
    const reservationsMap = {};
    for (const w of waitlist) {
      if (!reservationsMap[w.book_id]) reservationsMap[w.book_id] = [];
      reservationsMap[w.book_id].push({
        memberID: w.member_id,
        position: w.position,
        timestamp: w.requested_at,
        id: w.id
      });
    }

    const memberMap = {};
    members.forEach(m => memberMap[m.member_id] = m);

    return res.json({
      books: books.map(b => ({
        bookID: b.book_id,
        title: b.title,
        author: b.author,
        category: b.category,
        isbn: b.isbn,
        publisher: b.publisher,
        year: b.year,
        copies: b.copies,
        available: b.available_copies,
        shelf: b.shelf,
        coverUrl: b.cover_url,
        borrowCount: b.borrow_count
      })),
      members: members.map(m => ({
        memberID: m.member_id,
        displayID: m.display_id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        userType: m.user_type,
        department: m.department,
        photo: m.photo,
        borrowLimit: m.borrow_limit,
        status: m.status
      })),
      transactions: loans.map(l => ({
        transactionID: l.transaction_id,
        memberID: l.member_id,
        memberName: memberMap[l.member_id] ? memberMap[l.member_id].name : 'Patron',
        bookID: l.book_id,
        bookTitle: l.book_title,
        issueDate: l.issue_date,
        dueDate: l.due_date,
        returnDate: l.return_date,
        overdueDays: l.overdue_days,
        fineAmount: l.fine_amount,
        paymentStatus: l.payment_status,
        status: l.status
      })),
      reservations: reservationsMap,
      bookRequests: bookRequests.map(r => ({
        requestID: r.request_id,
        memberID: r.member_id,
        title: r.title,
        author: r.author,
        reason: r.reason,
        requestDate: r.request_date,
        status: r.status,
        adminResponse: r.admin_response
      })),
      payments: payments.map(p => ({
        paymentID: p.payment_id,
        transactionID: p.transaction_id,
        memberID: p.member_id,
        loanID: p.loan_id,
        amount: p.amount,
        paymentMethod: p.payment_method,
        paymentStatus: p.payment_status,
        paymentDate: p.payment_date
      })),
      deposits: deposits.map(d => ({
        depositID: d.deposit_id,
        memberID: d.member_id,
        amount: d.amount,
        transactionID: d.transaction_id,
        status: d.status,
        date: d.date
      })),
      outbox: emails.map(e => ({
        emailID: e.email_id,
        recipient: e.recipient,
        recipientName: e.recipient_name,
        type: e.type,
        subject: e.subject,
        body: e.message,
        timestamp: e.timestamp,
        status: e.status
      })),
      notifications: notifications.map(n => ({
        notificationID: n.notification_id,
        memberID: n.member_id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: Boolean(n.is_read)
      })),
      feedbacks: feedbacks.map(f => ({
        feedbackID: f.feedback_id,
        userName: f.user_name,
        category: f.category,
        rating: f.rating,
        comments: f.comments,
        timestamp: f.timestamp
      })),
      history: history.map(h => ({
        historyID: h.history_id,
        timestamp: h.timestamp,
        action: h.action,
        module: h.module,
        memberID: h.member_id,
        memberName: h.member_name,
        bookID: h.book_id,
        bookTitle: h.book_title,
        transactionID: h.transaction_id,
        description: h.description,
        oldValue: h.old_value,
        newValue: h.new_value,
        status: h.status
      }))
    });
  } catch (err) {
    console.error('Bootstrap API Error:', err);
    return res.status(500).json({ error: 'Database load failed' });
  }
});

// 3. BOOKS CRUD API
router.post('/books', async (req, res) => {
  try {
    const { title, author, category, isbn, publisher, year, copies, shelf, coverUrl } = req.body;
    if (!title || !author) {
      return res.status(400).json({ error: 'Book Title and Author are required' });
    }

    const maxIDRow = await db.getOne('SELECT MAX(book_id) AS maxID FROM books');
    const newBookID = (maxIDRow && maxIDRow.maxID ? maxIDRow.maxID : 100) + 1;
    const copiesNum = parseInt(copies) || 1;

    await db.execute(
      `INSERT INTO books (book_id, title, author, category, isbn, publisher, year, copies, available_copies, shelf, cover_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newBookID, title, author, category || 'General', isbn || '', publisher || '', parseInt(year) || 2026, copiesNum, copiesNum, shelf || 'CS-01', coverUrl || '']
    );

    // Audit log
    const nowStr = new Date().toLocaleString();
    await db.execute(
      `INSERT INTO history (history_id, timestamp, action, module, book_id, book_title, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [`HIS-${Math.floor(1000 + Math.random()*9000)}`, nowStr, 'ADD_BOOK', 'CATALOG', newBookID, title, `Added new title '${title}' with ${copiesNum} copies.`]
    );

    return res.json({ success: true, bookID: newBookID });
  } catch (err) {
    console.error('Add Book Error:', err);
    return res.status(500).json({ error: 'Failed to insert book record' });
  }
});

router.put('/books/:id', async (req, res) => {
  try {
    const bookID = parseInt(req.params.id);
    const { title, author, category, isbn, shelf, copies, available, coverUrl } = req.body;

    const existing = await db.getOne('SELECT * FROM books WHERE book_id = ?', [bookID]);
    if (!existing) return res.status(404).json({ error: 'Book not found' });

    await db.execute(
      `UPDATE books SET title = ?, author = ?, category = ?, isbn = ?, shelf = ?, copies = ?, available_copies = ?, cover_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE book_id = ?`,
      [title, author, category, isbn, shelf, parseInt(copies), parseInt(available), coverUrl, bookID]
    );

    const nowStr = new Date().toLocaleString();
    await db.execute(
      `INSERT INTO history (history_id, timestamp, action, module, book_id, book_title, description, old_value, new_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`HIS-${Math.floor(1000 + Math.random()*9000)}`, nowStr, 'UPDATE_BOOK', 'CATALOG', bookID, title, `Updated details for '${title}'.`, `Copies: ${existing.copies}`, `Copies: ${copies}`]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('Update Book Error:', err);
    return res.status(500).json({ error: 'Failed to update book record' });
  }
});

router.delete('/books/:id', async (req, res) => {
  try {
    const bookID = parseInt(req.params.id);
    const existing = await db.getOne('SELECT * FROM books WHERE book_id = ?', [bookID]);
    if (!existing) return res.status(404).json({ error: 'Book not found' });

    await db.execute('DELETE FROM books WHERE book_id = ?', [bookID]);

    const nowStr = new Date().toLocaleString();
    await db.execute(
      `INSERT INTO history (history_id, timestamp, action, module, book_id, book_title, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [`HIS-${Math.floor(1000 + Math.random()*9000)}`, nowStr, 'DELETE_BOOK', 'CATALOG', bookID, existing.title, `Deleted book #${bookID} (${existing.title}).`]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('Delete Book Error:', err);
    return res.status(500).json({ error: 'Failed to delete book record' });
  }
});

// 4. MEMBERS CRUD API
router.post('/members', async (req, res) => {
  try {
    const { name, email, phone, userType, department, photo } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Member name and email are required' });
    }

    const memberID = `MEM-${Math.floor(1000 + Math.random()*9000)}`;
    const displayID = `2026-${(department || 'CS').substring(0,3).toUpperCase()}-${Math.floor(100 + Math.random()*900)}`;
    const limit = (userType === 'Faculty') ? 10 : (userType === 'Researcher' ? 8 : 5);

    await db.execute(
      `INSERT INTO members (member_id, display_id, name, email, phone, user_type, department, photo, borrow_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberID, displayID, name, email, phone || '', userType || 'Student', department || 'Computer Science', photo || '', limit]
    );

    const nowStr = new Date().toLocaleString();
    await db.execute(
      `INSERT INTO history (history_id, timestamp, action, module, member_id, member_name, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [`HIS-${Math.floor(1000 + Math.random()*9000)}`, nowStr, 'ADD_MEMBER', 'MEMBERSHIP', memberID, name, `Enrolled patron ${name} (${userType}).`]
    );

    return res.json({ success: true, memberID, displayID });
  } catch (err) {
    console.error('Add Member Error:', err);
    return res.status(500).json({ error: 'Failed to create member record' });
  }
});


// Member lookup used by the real frontend delete verification flow.
router.get('/members/:id', async (req, res) => {
  try {
    const key = String(req.params.id || '').trim();
    const member = await db.getOne(
      'SELECT * FROM members WHERE member_id = ? OR display_id = ?',
      [key, key]
    );
    if (!member) return res.status(404).json({ success: false, error: 'Member not found' });
    return res.json({
      success: true,
      member: {
        memberID: member.member_id,
        displayID: member.display_id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        userType: member.user_type,
        department: member.department,
        photo: member.photo,
        borrowLimit: member.borrow_limit,
        status: member.status
      }
    });
  } catch (err) {
    console.error('Get Member Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load member record' });
  }
});

// REAL MEMBER DELETE: canonical member deletion API.
// Books/catalog records are never deleted by this operation.
router.delete('/members/:id', async (req, res) => {
  const key = String(req.params.id || '').trim();
  if (!key) return res.status(400).json({ success: false, error: 'Member ID is required' });

  try {
    const target = await db.getOne(
      'SELECT * FROM members WHERE member_id = ? OR display_id = ?',
      [key, key]
    );
    if (!target) return res.status(404).json({ success: false, error: 'Member not found' });
    const memberID = target.member_id;

    // Keep the existing safety rules: active loans, unpaid fines, and held deposits
    // must be resolved before the member can be deleted.
    const active = await db.getOne(
      "SELECT COUNT(*) AS cnt FROM loans WHERE member_id = ? AND status = 'ISSUED'",
      [memberID]
    );
    const fines = await db.getOne(
      "SELECT COUNT(*) AS cnt, COALESCE(SUM(fine_amount), 0) AS total FROM loans WHERE member_id = ? AND payment_status = 'UNPAID' AND fine_amount > 0",
      [memberID]
    );
    const held = await db.getOne(
      "SELECT COUNT(*) AS cnt FROM deposits WHERE member_id = ? AND status IN ('HELD', 'ACTIVE')",
      [memberID]
    );

    const blockers = [];
    if (active && active.cnt > 0) blockers.push(`${active.cnt} active loan${active.cnt === 1 ? '' : 's'}`);
    if (fines && fines.cnt > 0) blockers.push(`an unpaid fine of ₹${Number(fines.total).toFixed(2)}`);
    if (held && held.cnt > 0) blockers.push('a security deposit that has not been refunded');
    if (blockers.length) {
      return res.status(409).json({
        success: false,
        blockers,
        error: `Member cannot be deleted because this member has ${blockers.join(' and ')}. Resolve ${blockers.length === 1 ? 'it' : 'them'} first.`
      });
    }

    // Use a real SQLite transaction so the member cannot be half-deleted.
    await db.execBatch('BEGIN TRANSACTION');
    try {
      const waitingBooks = await db.query(
        "SELECT DISTINCT book_id FROM waiting_list WHERE member_id = ? AND status = 'WAITING'",
        [memberID]
      );
      const delWait = await db.execute('DELETE FROM waiting_list WHERE member_id = ?', [memberID]);

      // Re-number remaining queues for affected books.
      for (const row of waitingBooks) {
        const queue = await db.query(
          "SELECT id FROM waiting_list WHERE book_id = ? AND status = 'WAITING' ORDER BY position ASC, requested_at ASC, id ASC",
          [row.book_id]
        );
        for (let i = 0; i < queue.length; i++) {
          await db.execute('UPDATE waiting_list SET position = ? WHERE id = ?', [i + 1, queue[i].id]);
        }
      }

      const delReq = await db.execute('DELETE FROM book_requests WHERE member_id = ?', [memberID]);
      const delNotes = await db.execute('DELETE FROM notifications WHERE member_id = ?', [memberID]);
      const delLoans = await db.execute(
        "DELETE FROM loans WHERE member_id = ? AND status != 'ISSUED'",
        [memberID]
      );

      const del = await db.execute('DELETE FROM members WHERE member_id = ?', [memberID]);
      if (del.changes !== 1) throw new Error('Member row was not deleted');

      await db.execute(
        `INSERT INTO history (history_id, timestamp, action, module, member_id, member_name, description, old_value, new_value, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `HIS-DEL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          new Date().toLocaleString(),
          'DELETE_MEMBER', 'MEMBERSHIP', memberID, target.name,
          `Deleted member ${target.name} (${memberID}).`,
          `Member: ${target.name} (${target.status || 'ACTIVE'})`,
          'Deleted', 'SUCCESS'
        ]
      );

      await db.execBatch('COMMIT');

      const stillThere = await db.getOne('SELECT member_id FROM members WHERE member_id = ?', [memberID]);
      if (stillThere) {
        return res.status(500).json({ success: false, error: 'Member still exists after deletion.' });
      }

      return res.json({
        success: true,
        verified: true,
        memberID,
        message: 'Member deleted successfully',
        cleaned: {
          waitingList: delWait.changes,
          bookRequests: delReq.changes,
          notifications: delNotes.changes,
          finishedLoans: delLoans.changes
        }
      });
    } catch (err) {
      try { await db.execBatch('ROLLBACK'); } catch (_) {}
      throw err;
    }
  } catch (err) {
    console.error('Delete Member Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete member. No changes were made.' });
  }
});

// 5. ATOMIC CIRCULATION API (ISSUE & RETURN TRANSACTIONS)
router.post('/circulation/issue', async (req, res) => {
  try {
    const { memberID, bookID, issueDate, dueDate } = req.body;
    if (!memberID || !bookID) {
      return res.status(400).json({ error: 'Member ID and Book ID are required' });
    }

    const member = await db.getOne('SELECT * FROM members WHERE member_id = ? OR display_id = ?', [memberID, memberID]);
    if (!member) {
      return res.status(404).json({ error: 'Member not found in database' });
    }

    const book = await db.getOne('SELECT * FROM books WHERE book_id = ?', [parseInt(bookID)]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found in database' });
    }

    if (book.available_copies <= 0) {
      return res.status(400).json({ error: `'${book.title}' is currently out of stock` });
    }

    const activeLoans = await db.getOne(
      'SELECT COUNT(*) AS count FROM loans WHERE member_id = ? AND status = "ISSUED"',
      [member.member_id]
    );
    if (activeLoans.count >= member.borrow_limit) {
      return res.status(400).json({ error: `Borrowing limit of ${member.borrow_limit} books reached for ${member.name}` });
    }

    const transactionID = `TXN-${Math.floor(1000 + Math.random()*9000)}`;
    const nowStr = new Date().toLocaleString();

    // 1. Insert Loan Record
    await db.execute(
      `INSERT INTO loans (transaction_id, member_id, book_id, book_title, issue_date, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, 'ISSUED')`,
      [transactionID, member.member_id, book.book_id, book.title, issueDate || getTodayStr(), dueDate]
    );

    // 2. Decrement Book Available Copies
    await db.execute(
      `UPDATE books SET available_copies = available_copies - 1, borrow_count = borrow_count + 1 WHERE book_id = ?`,
      [book.book_id]
    );

    // 3. Log Audit
    await db.execute(
      `INSERT INTO history (history_id, timestamp, action, module, member_id, member_name, book_id, book_title, transaction_id, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`HIS-${Math.floor(1000 + Math.random()*9000)}`, nowStr, 'ISSUE_BOOK', 'CIRCULATION', member.member_id, member.name, book.book_id, book.title, transactionID, `Issued '${book.title}' to ${member.name} (Due: ${dueDate}).`]
    );

    return res.json({ success: true, transactionID });
  } catch (err) {
    console.error('Issue Transaction Error:', err);
    return res.status(500).json({ error: 'Database transaction failed during book checkout' });
  }
});

router.post('/circulation/return', async (req, res) => {
  try {
    const { transactionID, returnDate } = req.body;
    if (!transactionID) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const loan = await db.getOne('SELECT * FROM loans WHERE transaction_id = ?', [transactionID]);
    if (!loan) {
      return res.status(404).json({ error: 'Loan transaction not found' });
    }

    if (loan.status === 'RETURNED') {
      return res.status(400).json({ error: 'Book already returned' });
    }

    const retDateStr = returnDate || getTodayStr();
    const overdueDays = calculateOverdueDays(loan.due_date, retDateStr);
    const fineAmount = overdueDays * 5.0; // ₹5.00 / day
    const paymentStatus = fineAmount > 0 ? 'UNPAID' : 'N/A';

    // 1. Update Loan Status
    await db.execute(
      `UPDATE loans SET return_date = ?, overdue_days = ?, fine_amount = ?, payment_status = ?, status = 'RETURNED'
       WHERE transaction_id = ?`,
      [retDateStr, overdueDays, fineAmount, paymentStatus, transactionID]
    );

    // 2. Increment Book Available Copies
    await db.execute(
      `UPDATE books SET available_copies = available_copies + 1 WHERE book_id = ?`,
      [loan.book_id]
    );

    // 3. Process FIFO Waiting List if any patron is waiting for this book
    const nextHold = await db.getOne(
      `SELECT * FROM waiting_list WHERE book_id = ? AND status = 'WAITING' ORDER BY position ASC LIMIT 1`,
      [loan.book_id]
    );
    if (nextHold) {
      await db.execute(
        `UPDATE waiting_list SET status = 'GRANTED' WHERE id = ?`,
        [nextHold.id]
      );
      // Shift remaining positions
      await db.execute(
        `UPDATE waiting_list SET position = position - 1 WHERE book_id = ? AND status = 'WAITING' AND position > ?`,
        [loan.book_id, nextHold.position]
      );
    }

    // 4. Log Audit
    const member = await db.getOne('SELECT * FROM members WHERE member_id = ?', [loan.member_id]);
    const nowStr = new Date().toLocaleString();
    await db.execute(
      `INSERT INTO history (history_id, timestamp, action, module, member_id, member_name, book_id, book_title, transaction_id, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`HIS-${Math.floor(1000 + Math.random()*9000)}`, nowStr, 'RETURN_BOOK', 'CIRCULATION', loan.member_id, member ? member.name : loan.member_id, loan.book_id, loan.book_title, transactionID, `Returned '${loan.book_title}'. ${overdueDays > 0 ? `Overdue ${overdueDays} days, Fine: ₹${fineAmount}.` : 'Returned on schedule.'}`]
    );

    return res.json({ success: true, overdueDays, fineAmount, paymentStatus });
  } catch (err) {
    console.error('Return Transaction Error:', err);
    return res.status(500).json({ error: 'Database transaction failed during book return' });
  }
});

// 6. FINE PAYMENT API
router.post('/payments/settle', async (req, res) => {
  try {
    const { transactionID, amount, method } = req.body;
    if (!transactionID) return res.status(400).json({ error: 'Transaction ID is required' });

    const loan = await db.getOne('SELECT * FROM loans WHERE transaction_id = ?', [transactionID]);
    if (!loan) return res.status(404).json({ error: 'Loan transaction not found' });

    if (loan.payment_status === 'PAID') {
      return res.json({ success: true, message: 'Payment already settled for this loan' });
    }

    const payID = `PAY-${Math.floor(1000 + Math.random()*9000)}`;
    const payAmount = parseFloat(amount) || loan.fine_amount || (calculateOverdueDays(loan.due_date) * 5.0);

    await db.execute(
      `INSERT INTO payments (payment_id, transaction_id, member_id, loan_id, amount, payment_method, payment_status, payment_date)
       VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED', ?)`,
      [payID, transactionID, loan.member_id, transactionID, payAmount, method || 'UPI', getTodayStr()]
    );

    await db.execute(
      `UPDATE loans SET payment_status = 'PAID', fine_amount = 0.0 WHERE transaction_id = ?`,
      [transactionID]
    );

    const member = await db.getOne('SELECT * FROM members WHERE member_id = ?', [loan.member_id]);
    const memberName = member ? member.name : (loan.member_name || loan.member_id);
    const nowStr = new Date().toLocaleString();

    await db.execute(
      `INSERT INTO history (history_id, timestamp, action, module, member_id, member_name, transaction_id, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [`HIS-${Math.floor(1000 + Math.random()*9000)}`, nowStr, 'FINE_PAYMENT', 'PAYMENTS', loan.member_id, memberName, transactionID, `Settled fine ₹${payAmount.toFixed(2)} via ${method || 'UPI'} for loan #${transactionID}.`]
    );

    return res.json({ success: true, paymentID: payID });
  } catch (err) {
    console.error('Payment Error:', err);
    return res.status(500).json({ error: 'Failed to record fine payment' });
  }
});

// 7. WAITING LIST FIFO API (WITH DUPLICATE CHECK)
router.post('/waiting-list', async (req, res) => {
  try {
    const { bookID, memberID } = req.body;
    if (!bookID || !memberID) return res.status(400).json({ error: 'Book ID and Member ID are required' });

    const existing = await db.getOne(
      'SELECT * FROM waiting_list WHERE book_id = ? AND member_id = ? AND status = "WAITING"',
      [parseInt(bookID), memberID]
    );
    if (existing) {
      return res.status(400).json({ error: 'Patron is already on the waiting list for this title' });
    }

    const countRow = await db.getOne(
      'SELECT COUNT(*) AS count FROM waiting_list WHERE book_id = ? AND status = "WAITING"',
      [parseInt(bookID)]
    );
    const position = (countRow ? countRow.count : 0) + 1;

    const resObj = await db.execute(
      `INSERT INTO waiting_list (book_id, member_id, position, status) VALUES (?, ?, ?, 'WAITING')`,
      [parseInt(bookID), memberID, position]
    );

    return res.json({ success: true, id: resObj.lastID, position });
  } catch (err) {
    console.error('Waitlist Error:', err);
    return res.status(500).json({ error: 'Failed to join waiting list' });
  }
});

// 8. BOOK REQUESTS API (WITH STATUS UPDATE)
router.post('/book-requests', async (req, res) => {
  try {
    const { memberID, title, author, reason } = req.body;
    if (!title || !author) return res.status(400).json({ error: 'Title and Author are required' });

    const reqID = `REQ-${Math.floor(1000 + Math.random()*9000)}`;
    await db.execute(
      `INSERT INTO book_requests (request_id, member_id, title, author, reason, request_date, status)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
      [reqID, memberID || 'MEM-1001', title, author, reason || '', getTodayStr()]
    );

    return res.json({ success: true, requestID: reqID });
  } catch (err) {
    console.error('Book Request Error:', err);
    return res.status(500).json({ error: 'Failed to save title request' });
  }
});

router.put('/book-requests/:id', async (req, res) => {
  try {
    const reqID = req.params.id;
    const { status, adminResponse } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });

    await db.execute(
      `UPDATE book_requests SET status = ?, admin_response = ? WHERE request_id = ?`,
      [status, adminResponse || '', reqID]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('Update Request Error:', err);
    return res.status(500).json({ error: 'Failed to update book request' });
  }
});

// 9. DEPOSITS API
router.post('/deposits', async (req, res) => {
  try {
    const { memberID, amount, transactionID, status, date } = req.body;
    if (!memberID || !amount) return res.status(400).json({ error: 'Member ID and amount required' });

    const depID = `DEP-${Math.floor(1000 + Math.random()*9000)}`;
    await db.execute(
      `INSERT INTO deposits (deposit_id, member_id, amount, transaction_id, status, date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [depID, memberID, parseFloat(amount), transactionID || `TXN-${Math.floor(1000+Math.random()*9000)}`, status || 'ACTIVE', date || getTodayStr()]
    );

    return res.json({ success: true, depositID: depID });
  } catch (err) {
    console.error('Deposit Error:', err);
    return res.status(500).json({ error: 'Failed to save deposit record' });
  }
});

// 10. EMAILS API
router.post('/emails', async (req, res) => {
  try {
    const { recipient, recipientName, subject, message, type, status } = req.body;
    if (!recipient || !subject) return res.status(400).json({ error: 'Recipient and subject required' });

    const emlID = `EML-${Math.floor(1000 + Math.random()*9000)}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    await db.execute(
      `INSERT INTO emails (email_id, recipient, recipient_name, subject, message, type, status, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [emlID, recipient, recipientName || recipient, subject, message || '', type || 'NOTIFICATION', status || 'DELIVERED', timestamp]
    );

    return res.json({ success: true, emailID: emlID });
  } catch (err) {
    console.error('Email Log Error:', err);
    return res.status(500).json({ error: 'Failed to log email record' });
  }
});

// 11. NOTIFICATIONS API
router.put('/notifications/:id/read', async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read = 1 WHERE notification_id = ?', [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update notification' });
  }
});

router.put('/notifications/read-all', async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read = 1');
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// 12. FEEDBACK API
router.post('/feedbacks', async (req, res) => {
  try {
    const { userName, category, rating, comments } = req.body;
    if (!userName || !comments) return res.status(400).json({ error: 'Name and comments required' });

    const fbkID = `FBK-${Math.floor(100 + Math.random()*900)}`;
    const nowStr = new Date().toLocaleString();

    await db.execute(
      `INSERT INTO feedbacks (feedback_id, user_name, category, rating, comments, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fbkID, userName, category || 'Resources', parseInt(rating) || 5, comments, nowStr]
    );

    return res.json({ success: true, feedbackID: fbkID });
  } catch (err) {
    console.error('Feedback Error:', err);
    return res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// 13. LIVE SQL ANALYTICS API
router.get('/analytics', async (req, res) => {
  try {
    const totalBooks = await db.getOne('SELECT SUM(copies) AS val FROM books');
    const availBooks = await db.getOne('SELECT SUM(available_copies) AS val FROM books');
    const activeLoans = await db.getOne('SELECT COUNT(*) AS val FROM loans WHERE status = "ISSUED"');
    const totalMembers = await db.getOne('SELECT COUNT(*) AS val FROM members');
    const totalFinesPaid = await db.getOne('SELECT SUM(amount) AS val FROM payments');
    const totalFinesPending = await db.getOne('SELECT SUM(fine_amount) AS val FROM loans WHERE payment_status = "UNPAID"');
    const waitlistCount = await db.getOne('SELECT COUNT(*) AS val FROM waiting_list WHERE status = "WAITING"');
    const pendingRequests = await db.getOne('SELECT COUNT(*) AS val FROM book_requests WHERE status = "PENDING"');

    return res.json({
      totalBooks: totalBooks.val || 0,
      availableBooks: availBooks.val || 0,
      issuedBooks: (totalBooks.val || 0) - (availBooks.val || 0),
      activeLoans: activeLoans.val || 0,
      totalMembers: totalMembers.val || 0,
      totalFinesPaid: totalFinesPaid.val || 0,
      totalFinesPending: totalFinesPending.val || 0,
      waitlistCount: waitlistCount.val || 0,
      pendingRequests: pendingRequests.val || 0
    });
  } catch (err) {
    console.error('Analytics Error:', err);
    return res.status(500).json({ error: 'Failed to compute live analytics' });
  }
});

module.exports = router;
