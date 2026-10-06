const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// Same default as before; DATABASE_PATH lets scripts/tests point at a different file (matches server-complete.js)
const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, 'lumina_library.db');
const db = new sqlite3.Database(dbPath);

// Promisified helper methods
db.query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

db.getOne = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

db.execute = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

db.execBatch = (sql) => {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

async function initDB() {
  await db.execute('PRAGMA foreign_keys = ON;');

  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'ADMIN',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS books (
      book_id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      category TEXT NOT NULL,
      isbn TEXT,
      publisher TEXT,
      year INTEGER,
      copies INTEGER DEFAULT 1,
      available_copies INTEGER DEFAULT 1,
      shelf TEXT DEFAULT 'CS-01',
      cover_url TEXT DEFAULT '',
      borrow_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS members (
      member_id TEXT PRIMARY KEY,
      display_id TEXT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      user_type TEXT DEFAULT 'Student',
      department TEXT DEFAULT 'Computer Science',
      photo TEXT DEFAULT '',
      borrow_limit INTEGER DEFAULT 5,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loans (
      transaction_id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      book_id INTEGER NOT NULL,
      book_title TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      return_date TEXT DEFAULT NULL,
      overdue_days INTEGER DEFAULT 0,
      fine_amount REAL DEFAULT 0.0,
      payment_status TEXT DEFAULT 'N/A',
      status TEXT DEFAULT 'ISSUED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(member_id) REFERENCES members(member_id),
      FOREIGN KEY(book_id) REFERENCES books(book_id)
    );

    CREATE TABLE IF NOT EXISTS waiting_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      member_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      status TEXT DEFAULT 'WAITING',
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(book_id) REFERENCES books(book_id),
      FOREIGN KEY(member_id) REFERENCES members(member_id)
    );

    CREATE TABLE IF NOT EXISTS book_requests (
      request_id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      reason TEXT,
      request_date TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      admin_response TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      payment_id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      loan_id TEXT,
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'UPI',
      payment_status TEXT DEFAULT 'COMPLETED',
      payment_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deposits (
      deposit_id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      amount REAL NOT NULL,
      transaction_id TEXT NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS emails (
      email_id TEXT PRIMARY KEY,
      recipient TEXT NOT NULL,
      recipient_name TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'NOTIFICATION',
      status TEXT DEFAULT 'DELIVERED',
      timestamp TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      notification_id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      type TEXT DEFAULT 'GENERAL',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS feedbacks (
      feedback_id TEXT PRIMARY KEY,
      user_name TEXT NOT NULL,
      category TEXT NOT NULL,
      rating INTEGER DEFAULT 5,
      comments TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS history (
      history_id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      member_id TEXT DEFAULT 'N/A',
      member_name TEXT DEFAULT 'System User',
      book_id TEXT DEFAULT 'N/A',
      book_title TEXT DEFAULT 'N/A',
      transaction_id TEXT DEFAULT 'N/A',
      description TEXT NOT NULL,
      old_value TEXT DEFAULT 'N/A',
      new_value TEXT DEFAULT 'N/A',
      status TEXT DEFAULT 'SUCCESS',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await db.execBatch(schema);

  // Seed default users for all roles if users empty
  const userCountRow = await db.getOne('SELECT COUNT(*) AS count FROM users');
  if (!userCountRow || userCountRow.count === 0) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('lumina2026', salt);
    
    const seedUsers = [
      { username: 'admin', email: 'admin@lumina.edu', role: 'ADMIN' },
      { username: 'librarian', email: 'librarian@lumina.edu', role: 'LIBRARIAN' },
      { username: 'student', email: 'student@lumina.edu', role: 'STUDENT' },
      { username: 'faculty', email: 'faculty@lumina.edu', role: 'FACULTY' }
    ];

    for (const u of seedUsers) {
      await db.execute(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [u.username, u.email, hash, u.role]
      );
    }
  }

  // Seed initial books if database is empty
  const bookCountRow = await db.getOne('SELECT COUNT(*) AS count FROM books');
  if (bookCountRow && bookCountRow.count === 0) {
    const seedBooks = [
      { bookID: 101, title: "The C Programming Language", author: "Brian W. Kernighan, Dennis M. Ritchie", category: "Computer Science", isbn: "9780131103627", publisher: "Prentice Hall", year: 1988, copies: 4, available: 4, shelf: "CS-01", borrowCount: 45 },
      { bookID: 102, title: "Introduction to Algorithms", author: "Thomas H. Cormen et al.", category: "Algorithms", isbn: "9780262033848", publisher: "MIT Press", year: 2009, copies: 5, available: 5, shelf: "CS-02", borrowCount: 82 },
      { bookID: 103, title: "Structure and Interpretation of Computer Programs", author: "Harold Abelson, Gerald Jay Sussman", category: "Computer Science", isbn: "9780262510875", publisher: "MIT Press", year: 1996, copies: 3, available: 3, shelf: "CS-03", borrowCount: 19 },
      { bookID: 104, title: "Compilers: Principles, Techniques, and Tools", author: "Alfred V. Aho et al.", category: "Computer Science", isbn: "9780321486813", publisher: "Pearson", year: 2006, copies: 3, available: 3, shelf: "CS-04", borrowCount: 23 },
      { bookID: 105, title: "Computer Organization and Design", author: "David A. Patterson, John L. Hennessy", category: "Computer Science", isbn: "9780124077263", publisher: "Morgan Kaufmann", year: 2013, copies: 4, available: 4, shelf: "CS-05", borrowCount: 51 },
      { bookID: 106, title: "Artificial Intelligence: A Modern Approach", author: "Stuart Russell, Peter Norvig", category: "Artificial Intelligence", isbn: "9780136042594", publisher: "Pearson", year: 2020, copies: 4, available: 4, shelf: "AI-01", borrowCount: 74 },
      { bookID: 107, title: "Deep Learning", author: "Ian Goodfellow, Yoshua Bengio", category: "Artificial Intelligence", isbn: "9780262035613", publisher: "MIT Press", year: 2016, copies: 3, available: 3, shelf: "AI-02", borrowCount: 65 },
      { bookID: 108, title: "Pattern Recognition and Machine Learning", author: "Christopher M. Bishop", category: "Artificial Intelligence", isbn: "9780387310732", publisher: "Springer", year: 2006, copies: 3, available: 3, shelf: "AI-03", borrowCount: 42 },
      { bookID: 109, title: "Reinforcement Learning: An Introduction", author: "Richard S. Sutton, Andrew G. Barto", category: "Artificial Intelligence", isbn: "9780262039246", publisher: "MIT Press", year: 2018, copies: 3, available: 3, shelf: "AI-04", borrowCount: 38 },
      { bookID: 110, title: "Hands-On Machine Learning with Scikit-Learn", author: "Aurélien Géron", category: "Artificial Intelligence", isbn: "9781492032649", publisher: "O'Reilly Media", year: 2019, copies: 5, available: 5, shelf: "AI-05", borrowCount: 95 },
      { bookID: 111, title: "Python for Data Analysis", author: "Wes McKinney", category: "Data Science", isbn: "9781491957660", publisher: "O'Reilly Media", year: 2017, copies: 4, available: 4, shelf: "DS-01", borrowCount: 88 },
      { bookID: 112, title: "Data Science from Scratch", author: "Joel Grus", category: "Data Science", isbn: "9781492041139", publisher: "O'Reilly Media", year: 2019, copies: 4, available: 4, shelf: "DS-02", borrowCount: 56 },
      { bookID: 113, title: "Storytelling with Data", author: "Cole Nussbaumer Knaflic", category: "Data Science", isbn: "9781119002253", publisher: "Wiley", year: 2015, copies: 3, available: 3, shelf: "DS-03", borrowCount: 47 },
      { bookID: 114, title: "Practical Statistics for Data Scientists", author: "Peter Bruce, Andrew Bruce", category: "Data Science", isbn: "9781492072942", publisher: "O'Reilly Media", year: 2020, copies: 3, available: 3, shelf: "DS-04", borrowCount: 39 },
      { bookID: 115, title: "Mining of Massive Datasets", author: "Jure Leskovec, Anand Rajaraman", category: "Data Science", isbn: "9781107077232", publisher: "Cambridge University Press", year: 2014, copies: 2, available: 2, shelf: "DS-05", borrowCount: 28 },
      { bookID: 116, title: "The Web Application Hacker's Handbook", author: "Dafydd Stuttard, Marcus Pinto", category: "Cyber Security", isbn: "9781118026472", publisher: "Wiley", year: 2011, copies: 4, available: 4, shelf: "SEC-01", borrowCount: 71 },
      { bookID: 117, title: "Practical Malware Analysis", author: "Michael Sikorski, Andrew Honig", category: "Cyber Security", isbn: "9781593272906", publisher: "No Starch Press", year: 2012, copies: 3, available: 3, shelf: "SEC-02", borrowCount: 52 },
      { bookID: 118, title: "Hacking: The Art of Exploitation", author: "Jon Erickson", category: "Cyber Security", isbn: "9781593271442", publisher: "No Starch Press", year: 2008, copies: 4, available: 4, shelf: "SEC-03", borrowCount: 68 },
      { bookID: 119, title: "Cryptography and Network Security", author: "William Stallings", category: "Cyber Security", isbn: "9780134444284", publisher: "Pearson", year: 2017, copies: 4, available: 4, shelf: "SEC-04", borrowCount: 44 },
      { bookID: 120, title: "Blue Team Handbook: Incident Response", author: "Don Murdoch", category: "Cyber Security", isbn: "9781500734756", publisher: "CreateSpace", year: 2014, copies: 3, available: 3, shelf: "SEC-05", borrowCount: 31 },
      { bookID: 121, title: "Clean Code", author: "Robert C. Martin", category: "Software Engineering", isbn: "9780132350884", publisher: "Prentice Hall", year: 2008, copies: 3, available: 2, shelf: "SE-01", borrowCount: 112 },
      { bookID: 122, title: "Design Patterns", author: "Erich Gamma, Richard Helm", category: "Software Engineering", isbn: "9780201633610", publisher: "Addison-Wesley", year: 1994, copies: 2, available: 2, shelf: "SE-02", borrowCount: 63 },
      { bookID: 123, title: "The Pragmatic Programmer", author: "Andrew Hunt, David Thomas", category: "Software Engineering", isbn: "9780201616224", publisher: "Addison-Wesley", year: 1999, copies: 4, available: 4, shelf: "SE-03", borrowCount: 78 }
    ];

    for (const b of seedBooks) {
      await db.execute(
        `INSERT INTO books (book_id, title, author, category, isbn, publisher, year, copies, available_copies, shelf, borrow_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [b.bookID, b.title, b.author, b.category, b.isbn, b.publisher, b.year, b.copies, b.available, b.shelf, b.borrowCount]
      );
    }
  }

  // Seed initial members if database is empty
  const memberCountRow = await db.getOne('SELECT COUNT(*) AS count FROM members');
  if (memberCountRow && memberCountRow.count === 0) {
    const seedMembers = [
      { id: "MEM-1001", displayID: "2024-CS-001", name: "Aaditya Jaiswal", email: "aaditya@amrita.edu", phone: "+91 9876543210", userType: "Student", department: "Computer Science", photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80", borrowLimit: 5 },
      { id: "MEM-1002", displayID: "2024-AI-008", name: "Dr. Priya Patel", email: "priya@amrita.edu", phone: "+91 9876543211", userType: "Faculty", department: "Artificial Intelligence", photo: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80", borrowLimit: 10 },
      { id: "MEM-1003", displayID: "2024-DS-014", name: "Amit Kumar", email: "amit@amrita.edu", phone: "+91 9876543212", userType: "Researcher", department: "Data Science", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80", borrowLimit: 8 },
      { id: "MEM-1004", displayID: "2024-SEC-022", name: "Sneha Sharma", email: "sneha@amrita.edu", phone: "+91 9876543213", userType: "Student", department: "Cyber Security", photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80", borrowLimit: 5 }
    ];

    for (const m of seedMembers) {
      await db.execute(
        `INSERT INTO members (member_id, display_id, name, email, phone, user_type, department, photo, borrow_limit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [m.id, m.displayID, m.name, m.email, m.phone, m.userType, m.department, m.photo, m.borrowLimit]
      );
    }
  }

  // Seed default loan if loans empty
  const loanCountRow = await db.getOne('SELECT COUNT(*) AS count FROM loans');
  if (loanCountRow && loanCountRow.count === 0) {
    const todayStr = new Date().toISOString().split('T')[0];
    await db.execute(
      `INSERT INTO loans (transaction_id, member_id, book_id, book_title, issue_date, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['TXN-9001', 'MEM-1001', 121, 'Clean Code', '2026-08-01', '2026-08-15', 'ISSUED']
    );
  }

  // Seed default feedbacks
  const fbkCountRow = await db.getOne('SELECT COUNT(*) AS count FROM feedbacks');
  if (fbkCountRow && fbkCountRow.count === 0) {
    const seedFeedbacks = [
      { feedbackID: "FBK-101", userName: "Aaditya Jaiswal", category: "Resources", rating: 5, comments: "Outstanding textbook collection for systems engineering and computer architecture!", timestamp: "2026-08-22 14:30" },
      { feedbackID: "FBK-102", userName: "Dr. Priya Patel", category: "Facilities", rating: 5, comments: "Seamless hold waitlist notifications and quiet study pods.", timestamp: "2026-08-23 11:15" },
      { feedbackID: "FBK-103", userName: "Amit Kumar", category: "Staff & Service", rating: 4, comments: "Prompt visitor check-in and deposit processing.", timestamp: "2026-08-24 16:45" }
    ];
    for (const f of seedFeedbacks) {
      await db.execute(
        `INSERT INTO feedbacks (feedback_id, user_name, category, rating, comments, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [f.feedbackID, f.userName, f.category, f.rating, f.comments, f.timestamp]
      );
    }
  }

  // Seed 50+ rich dataset books if not already present
  try {
    const { seedRichData } = require('./seed-rich-dataset');
    await seedRichData();
  } catch (err) {
    console.warn("Rich dataset seed notice:", err.message || err);
  }
}

module.exports = { db, initDB };
