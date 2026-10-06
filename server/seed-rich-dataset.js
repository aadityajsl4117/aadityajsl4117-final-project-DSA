const { db } = require('./db');

async function seedRichData() {
  console.log("==================================================");
  console.log("📦 SEEDING 50+ NEW BOOKS & 5 RICH MEMBER RECORDS");
  console.log("==================================================\n");

  const newBooks = [
    { bookID: 153, title: "Designing Distributed Systems", author: "Brendan Burns", category: "Cloud & DevOps", isbn: "9781491983645", publisher: "O'Reilly Media", year: 2018, copies: 5, available: 5, shelf: "CLOUD-01", borrowCount: 76 },
    { bookID: 154, title: "Kubernetes Patterns", author: "Bilgin Ibryam, Roland Huß", category: "Cloud & DevOps", isbn: "9781492050285", publisher: "O'Reilly Media", year: 2019, copies: 4, available: 4, shelf: "CLOUD-02", borrowCount: 62 },
    { bookID: 155, title: "Site Reliability Engineering", author: "Betsy Beyer et al.", category: "Cloud & DevOps", isbn: "9781491929124", publisher: "O'Reilly Media", year: 2016, copies: 5, available: 5, shelf: "CLOUD-03", borrowCount: 94 },
    { bookID: 156, title: "Terraform: Up & Running", author: "Yevgeniy Brikman", category: "Cloud & DevOps", isbn: "9781492046905", publisher: "O'Reilly Media", year: 2019, copies: 4, available: 4, shelf: "CLOUD-04", borrowCount: 51 },
    { bookID: 157, title: "Docker Deep Dive", author: "Nigel Poulton", category: "Cloud & DevOps", isbn: "9781916585256", publisher: "Independently Published", year: 2020, copies: 6, available: 6, shelf: "CLOUD-05", borrowCount: 88 },
    { bookID: 158, title: "Rust Programming Language", author: "Steve Klabnik, Carol Nichols", category: "Programming", isbn: "9781718503106", publisher: "No Starch Press", year: 2023, copies: 5, available: 5, shelf: "PR-05", borrowCount: 93 },
    { bookID: 159, title: "Programming in Go", author: "Mark Summerfield", category: "Programming", isbn: "9780321774637", publisher: "Addison-Wesley", year: 2012, copies: 4, available: 4, shelf: "PR-06", borrowCount: 57 },
    { bookID: 160, title: "Effective TypeScript", author: "Dan Vanderkam", category: "Programming", isbn: "9781492053743", publisher: "O'Reilly Media", year: 2019, copies: 4, available: 4, shelf: "PR-07", borrowCount: 79 },
    { bookID: 161, title: "Fullstack React", author: "Anthony Accomazzo et al.", category: "Web Development", isbn: "9780991344628", publisher: "Fullstack.io", year: 2020, copies: 4, available: 4, shelf: "WEB-01", borrowCount: 85 },
    { bookID: 162, title: "Node.js Design Patterns", author: "Mario Casciaro, Luciano Mammino", category: "Web Development", isbn: "9781839214110", publisher: "Packt Publishing", year: 2020, copies: 5, available: 5, shelf: "WEB-02", borrowCount: 72 },
    { bookID: 163, title: "Building Microservices", author: "Sam Newman", category: "Software Engineering", isbn: "9781492034025", publisher: "O'Reilly Media", year: 2021, copies: 5, available: 5, shelf: "SE-05", borrowCount: 110 },
    { bookID: 164, title: "Domain-Driven Design", author: "Eric Evans", category: "Software Engineering", isbn: "9780321125217", publisher: "Addison-Wesley", year: 2003, copies: 3, available: 3, shelf: "SE-06", borrowCount: 68 },
    { bookID: 165, title: "Working Effectively with Legacy Code", author: "Michael Feathers", category: "Software Engineering", isbn: "9780131177055", publisher: "Prentice Hall", year: 2004, copies: 4, available: 4, shelf: "SE-07", borrowCount: 54 },
    { bookID: 166, title: "Code Complete 2nd Edition", author: "Steve McConnell", category: "Software Engineering", isbn: "9780735619678", publisher: "Microsoft Press", year: 2004, copies: 5, available: 5, shelf: "SE-08", borrowCount: 97 },
    { bookID: 167, title: "Software Engineering at Google", author: "Titus Winters, Tom Manshreck", category: "Software Engineering", isbn: "9781492082798", publisher: "O'Reilly Media", year: 2020, copies: 4, available: 4, shelf: "SE-09", borrowCount: 89 },
    { bookID: 168, title: "Generative Deep Learning", author: "David Foster", category: "Artificial Intelligence", isbn: "9781098134181", publisher: "O'Reilly Media", year: 2023, copies: 4, available: 4, shelf: "AI-06", borrowCount: 102 },
    { bookID: 169, title: "Natural Language Processing with Transformers", author: "Lewis Tunstall et al.", category: "Artificial Intelligence", isbn: "9781098136796", publisher: "O'Reilly Media", year: 2022, copies: 4, available: 4, shelf: "AI-07", borrowCount: 91 },
    { bookID: 170, title: "Computer Vision: Algorithms and Applications", author: "Richard Szeliski", category: "Artificial Intelligence", isbn: "9781848829343", publisher: "Springer", year: 2022, copies: 3, available: 3, shelf: "AI-08", borrowCount: 48 },
    { bookID: 171, title: "Speech and Language Processing", author: "Daniel Jurafsky, James H. Martin", category: "Artificial Intelligence", isbn: "9780131873216", publisher: "Pearson", year: 2021, copies: 3, available: 3, shelf: "AI-09", borrowCount: 43 },
    { bookID: 172, title: "Probabilistic Machine Learning", author: "Kevin P. Murphy", category: "Artificial Intelligence", isbn: "9780262046824", publisher: "MIT Press", year: 2022, copies: 4, available: 4, shelf: "AI-10", borrowCount: 56 },
    { bookID: 173, title: "Feature Engineering for Machine Learning", author: "Alice Zheng, Amanda Casari", category: "Data Science", isbn: "9781491953242", publisher: "O'Reilly Media", year: 2018, copies: 4, available: 4, shelf: "DS-06", borrowCount: 65 },
    { bookID: 174, title: "Data Governance: The Definitive Guide", author: "Evren Eryurek et al.", category: "Data Science", isbn: "9781492063490", publisher: "O'Reilly Media", year: 2021, copies: 3, available: 3, shelf: "DS-07", borrowCount: 38 },
    { bookID: 175, title: "Advanced Analytics with Spark", author: "Sandy Ryza et al.", category: "Data Science", isbn: "9781491958865", publisher: "O'Reilly Media", year: 2017, copies: 4, available: 4, shelf: "DS-08", borrowCount: 52 },
    { bookID: 176, title: "Building Data Science Teams", author: "DJ Patil", category: "Data Science", isbn: "9781449316236", publisher: "O'Reilly Media", year: 2011, copies: 3, available: 3, shelf: "DS-09", borrowCount: 41 },
    { bookID: 177, title: "Big Data: Principles and Best Practices", author: "Nathan Marz, James Warren", category: "Data Science", isbn: "9781617290343", publisher: "Manning", year: 2015, copies: 4, available: 4, shelf: "DS-10", borrowCount: 60 },
    { bookID: 178, title: "Zero Trust Networks", author: "Evan Gilman, Doug Barth", category: "Cyber Security", isbn: "9781491962190", publisher: "O'Reilly Media", year: 2017, copies: 4, available: 4, shelf: "SEC-06", borrowCount: 74 },
    { bookID: 179, title: "Threat Modeling: Designing for Security", author: "Adam Shostack", category: "Cyber Security", isbn: "9781118809990", publisher: "Wiley", year: 2014, copies: 3, available: 3, shelf: "SEC-07", borrowCount: 49 },
    { bookID: 180, title: "Network Security Essentials", author: "William Stallings", category: "Cyber Security", isbn: "9780134527338", publisher: "Pearson", year: 2016, copies: 4, available: 4, shelf: "SEC-08", borrowCount: 58 },
    { bookID: 181, title: "Social Engineering: The Science of Human Hacking", author: "Christopher Hadnagy", category: "Cyber Security", isbn: "9781119433385", publisher: "Wiley", year: 2018, copies: 4, available: 4, shelf: "SEC-09", borrowCount: 82 },
    { bookID: 182, title: "Black Hat Python", author: "Justin Seitz, Tim Arnold", category: "Cyber Security", isbn: "9781718501126", publisher: "No Starch Press", year: 2021, copies: 5, available: 5, shelf: "SEC-10", borrowCount: 96 },
    { bookID: 183, title: "Modern Database Systems", author: "Won Kim", category: "Databases", isbn: "9780201590982", publisher: "ACM Press", year: 1995, copies: 3, available: 3, shelf: "DB-05", borrowCount: 33 },
    { bookID: 184, title: "Database Reliability Engineering", author: "Laine Campbell, Charity Majors", category: "Databases", isbn: "9781491925942", publisher: "O'Reilly Media", year: 2017, copies: 4, available: 4, shelf: "DB-06", borrowCount: 67 },
    { bookID: 185, title: "Cassandra: The Definitive Guide", author: "Jeff Carpenter, Eben Hewitt", category: "Databases", isbn: "9781491933664", publisher: "O'Reilly Media", year: 2020, copies: 3, available: 3, shelf: "DB-07", borrowCount: 44 },
    { bookID: 186, title: "MongoDB: The Definitive Guide", author: "Shannon Bradshaw et al.", category: "Databases", isbn: "9781491954461", publisher: "O'Reilly Media", year: 2019, copies: 4, available: 4, shelf: "DB-08", borrowCount: 71 },
    { bookID: 187, title: "PostgreSQL: Up and Running", author: "Regina Obe, Leo Hsu", category: "Databases", isbn: "9781491963418", publisher: "O'Reilly Media", year: 2017, copies: 4, available: 4, shelf: "DB-09", borrowCount: 59 },
    { bookID: 188, title: "Probabilistic Robotics", author: "Sebastian Thrun et al.", category: "Robotics", isbn: "9780262201629", publisher: "MIT Press", year: 2005, copies: 3, available: 3, shelf: "ROB-01", borrowCount: 39 },
    { bookID: 189, title: "Introduction to Autonomous Mobile Robots", author: "Roland Siegwart et al.", category: "Robotics", isbn: "9780262015356", publisher: "MIT Press", year: 2011, copies: 3, available: 3, shelf: "ROB-02", borrowCount: 35 },
    { bookID: 190, title: "Modern Robotics: Mechanics, Planning, and Control", author: "Kevin M. Lynch, Frank C. Park", category: "Robotics", isbn: "9781107156302", publisher: "Cambridge University Press", year: 2017, copies: 4, available: 4, shelf: "ROB-03", borrowCount: 47 },
    { bookID: 191, title: "Quantum Computation and Quantum Information", author: "Michael A. Nielsen, Isaac L. Chuang", category: "Quantum Computing", isbn: "9781107002173", publisher: "Cambridge University Press", year: 2010, copies: 4, available: 4, shelf: "QC-01", borrowCount: 58 },
    { bookID: 192, title: "Quantum Computing for Computer Scientists", author: "Noson S. Yanofsky, Mirco A. Mannucci", category: "Quantum Computing", isbn: "9780521879965", publisher: "Cambridge University Press", year: 2008, copies: 3, available: 3, shelf: "QC-02", borrowCount: 42 },
    { bookID: 193, title: "Computer Graphics: Principles and Practice", author: "John F. Hughes et al.", category: "Computer Science", isbn: "9780321399526", publisher: "Addison-Wesley", year: 2013, copies: 3, available: 3, shelf: "CS-06", borrowCount: 50 },
    { bookID: 194, title: "Distributed Systems: Concepts and Design", author: "George Coulouris et al.", category: "Computer Science", isbn: "9780132143011", publisher: "Pearson", year: 2011, copies: 4, available: 4, shelf: "CS-07", borrowCount: 66 },
    { bookID: 195, title: "System Design Interview", author: "Alex Xu", category: "Software Engineering", isbn: "9798664653403", publisher: "Independently Published", year: 2020, copies: 6, available: 6, shelf: "SE-10", borrowCount: 135 },
    { bookID: 196, title: "System Design Interview Volume 2", author: "Alex Xu, Sahn Lam", category: "Software Engineering", isbn: "9798533604024", publisher: "Independently Published", year: 2022, copies: 6, available: 6, shelf: "SE-11", borrowCount: 128 },
    { bookID: 197, title: "Grokking Algorithms", author: "Aditya Bhargava", category: "Algorithms", isbn: "9781617292231", publisher: "Manning", year: 2016, copies: 5, available: 5, shelf: "CS-08", borrowCount: 115 },
    { bookID: 198, title: "Clean Architecture", author: "Robert C. Martin", category: "Software Engineering", isbn: "9780134494166", publisher: "Prentice Hall", year: 2017, copies: 4, available: 4, shelf: "SE-12", borrowCount: 104 },
    { bookID: 199, title: "The DevOps Handbook", author: "Gene Kim, Jez Humble", category: "Cloud & DevOps", isbn: "9781942788003", publisher: "IT Revolution Press", year: 2016, copies: 5, available: 5, shelf: "CLOUD-06", borrowCount: 92 },
    { bookID: 200, title: "Continuous Delivery", author: "Jez Humble, David Farley", category: "Cloud & DevOps", isbn: "9780321601910", publisher: "Addison-Wesley", year: 2010, copies: 4, available: 4, shelf: "CLOUD-07", borrowCount: 78 },
    { bookID: 201, title: "High Performance Browser Networking", author: "Ilya Grigorik", category: "Networking", isbn: "9781449344764", publisher: "O'Reilly Media", year: 2013, copies: 4, available: 4, shelf: "NW-03", borrowCount: 61 },
    { bookID: 202, title: "Designing Data-Intensive Systems", author: "Martin Kleppmann", category: "Databases", isbn: "9781449373320", publisher: "O'Reilly Media", year: 2017, copies: 4, available: 4, shelf: "DB-10", borrowCount: 88 }
  ];

  let addedBooks = 0;
  for (const b of newBooks) {
    const existing = await db.getOne('SELECT * FROM books WHERE book_id = ?', [b.bookID]);
    if (!existing) {
      await db.execute(
        `INSERT INTO books (book_id, title, author, category, isbn, publisher, year, copies, available_copies, shelf, borrow_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [b.bookID, b.title, b.author, b.category, b.isbn, b.publisher, b.year, b.copies, b.available, b.shelf, b.borrowCount]
      );
      addedBooks++;
    }
  }
  console.log(`✅ Added ${addedBooks} new books to database (Total Books: ${newBooks.length + 52})`);

  const newMembers = [
    { id: "MEM-1005", displayID: "ROB-2026-012", name: "Vikramaditya Rao", email: "vikram.rao@univ.edu", phone: "+91 98765 43214", userType: "Student", department: "Robotics & Automation", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80", borrowLimit: 5 },
    { id: "MEM-1006", displayID: "FAC-2026-088", name: "Ananya Deshmukh", email: "ananya.deshmukh@univ.edu", phone: "+91 98765 43215", userType: "Faculty", department: "Artificial Intelligence", photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80", borrowLimit: 8 },
    { id: "MEM-1007", displayID: "SEC-2026-041", name: "Rohan Verma", email: "rohan.verma@univ.edu", phone: "+91 98765 43216", userType: "Student", department: "Cyber Security", photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80", borrowLimit: 5 },
    { id: "MEM-1008", displayID: "RES-2026-009", name: "Kavya Nambiar", email: "kavya.nambiar@univ.edu", phone: "+91 98765 43217", userType: "Researcher", department: "Quantum Computing", photo: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80", borrowLimit: 5 },
    { id: "MEM-1009", displayID: "DS-2026-033", name: "Siddharth Menon", email: "siddharth.menon@univ.edu", phone: "+91 98765 43218", userType: "Student", department: "Data Science", photo: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80", borrowLimit: 5 }
  ];

  let addedMembers = 0;
  for (const m of newMembers) {
    const existing = await db.getOne('SELECT * FROM members WHERE member_id = ?', [m.id]);
    if (!existing) {
      await db.execute(
        `INSERT INTO members (member_id, display_id, name, email, phone, user_type, department, photo, borrow_limit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [m.id, m.displayID, m.name, m.email, m.phone, m.userType, m.department, m.photo, m.borrowLimit]
      );
      addedMembers++;
    }
  }
  console.log(`✅ Added ${addedMembers} new member profiles`);

  // Seed Loans for new members (including active overdue loans)
  const sampleLoans = [
    { txnID: 'TXN-9005', memberID: 'MEM-1005', bookID: 195, title: 'System Design Interview', issue: '2026-09-25', due: '2026-10-09', status: 'ISSUED' },
    { txnID: 'TXN-9006', memberID: 'MEM-1006', bookID: 168, title: 'Generative Deep Learning', issue: '2026-09-20', due: '2026-10-04', status: 'ISSUED' },
    { txnID: 'TXN-9009', memberID: 'MEM-1009', bookID: 111, title: 'Python for Data Analysis', issue: '2026-09-28', due: '2026-10-12', status: 'ISSUED' },
    { txnID: 'TXN-9010', memberID: 'MEM-1005', bookID: 153, title: 'Designing Distributed Systems', issue: '2026-08-10', due: '2026-08-24', status: 'ISSUED' },
    { txnID: 'TXN-9011', memberID: 'MEM-1007', bookID: 178, title: 'Zero Trust Networks', issue: '2026-08-15', due: '2026-08-29', status: 'ISSUED' },
    { txnID: 'TXN-9012', memberID: 'MEM-1008', bookID: 191, title: 'Quantum Computation and Quantum Information', issue: '2026-08-20', due: '2026-09-03', status: 'ISSUED' }
  ];

  for (const l of sampleLoans) {
    const ex = await db.getOne('SELECT * FROM loans WHERE transaction_id = ?', [l.txnID]);
    if (!ex) {
      await db.execute(
        `INSERT INTO loans (transaction_id, member_id, book_id, book_title, issue_date, due_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [l.txnID, l.memberID, l.bookID, l.title, l.issue, l.due, l.status]
      );
    }
  }

  // Seed Deposits
  const depEx = await db.getOne('SELECT * FROM deposits WHERE deposit_id = "DEP-201"');
  if (!depEx) {
    await db.execute(
      `INSERT INTO deposits (deposit_id, member_id, amount, transaction_id, status, date)
       VALUES ('DEP-201', 'MEM-1005', 500.0, 'TXN-9005', 'ACTIVE', '2026-09-25')`
    );
  }

  // Seed Book Requests
  const reqEx = await db.getOne('SELECT * FROM book_requests WHERE request_id = "REQ-701"');
  if (!reqEx) {
    await db.execute(
      `INSERT INTO book_requests (request_id, member_id, title, author, reason, request_date, status)
       VALUES ('REQ-701', 'MEM-1006', 'LLM Engineering in Production', 'Chip Huyen', 'Needed for Advanced AI Research', '2026-09-26', 'PENDING')`
    );
  }

  // Seed Feedbacks
  const fbkEx = await db.getOne('SELECT * FROM feedbacks WHERE feedback_id = "FBK-201"');
  if (!fbkEx) {
    await db.execute(
      `INSERT INTO feedbacks (feedback_id, user_name, category, rating, comments, timestamp)
       VALUES ('FBK-201', 'Siddharth Menon', 'Services', 5, 'Incredible digital library search and AI catalog chatbot!', '2026-09-28 16:30')`
    );
  }

  console.log("\n==================================================");
  console.log("🎉 RICH DATASET SEEDED SUCCESSFULLY!");
  console.log("==================================================");
}

module.exports = { seedRichData };

if (require.main === module) {
  seedRichData().catch(err => {
    console.error("❌ Seed Error:", err);
    process.exit(1);
  });
}
