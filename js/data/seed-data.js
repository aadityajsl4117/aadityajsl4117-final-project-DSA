/* SEED INITIAL DATA FOR LUMINA LIBRARY CONTROLLER */
LuminaLibrary.prototype.seedInitialData = function() {
  this.books = typeof INITIAL_BOOKS !== "undefined" ? [...INITIAL_BOOKS] : [];
  this.members = typeof INITIAL_MEMBERS !== "undefined" ? [...INITIAL_MEMBERS] : [];

  this.transactionList.append({
    transactionID: "TXN-1005",
    bookID: 130,
    bookTitle: "Database System Concepts",
    memberID: "STU-201",
    memberName: "Aaditya Jaiswal",
    userType: "STUDENT",
    issueDate: "2026-08-20",
    dueDate: "2026-09-08",
    returnDate: null,
    fineAmount: 0,
    paymentStatus: "N/A",
    status: "ISSUED"
  });

  this.transactionList.append({
    transactionID: "TXN-1004",
    bookID: 101,
    bookTitle: "The C Programming Language",
    memberID: "STU-201",
    memberName: "Aaditya Jaiswal",
    userType: "STUDENT",
    issueDate: "2026-08-18",
    dueDate: "2026-09-18",
    returnDate: null,
    fineAmount: 0,
    paymentStatus: "N/A",
    status: "ISSUED"
  });

  this.transactionList.append({
    transactionID: "TXN-1003",
    bookID: 106,
    bookTitle: "Artificial Intelligence: A Modern Approach",
    memberID: "STU-201",
    memberName: "Aaditya Jaiswal",
    userType: "STUDENT",
    issueDate: "2026-08-15",
    dueDate: "2026-09-10",
    returnDate: null,
    fineAmount: 0,
    paymentStatus: "N/A",
    status: "ISSUED"
  });

  this.transactionList.append({
    transactionID: "TXN-1002",
    bookID: 101,
    bookTitle: "The C Programming Language",
    memberID: "STU-201",
    memberName: "Aaditya Jaiswal",
    userType: "STUDENT",
    issueDate: "2026-08-12",
    dueDate: "2026-08-27",
    returnDate: null,
    fineAmount: 0,
    paymentStatus: "N/A",
    status: "ISSUED"
  });

  this.transactionList.append({
    transactionID: "TXN-1001",
    bookID: 101,
    bookTitle: "The C Programming Language",
    memberID: "STU-201",
    memberName: "Aaditya Jaiswal",
    userType: "STUDENT",
    issueDate: "2026-08-10",
    dueDate: "2026-08-25",
    returnDate: "2026-08-25",
    fineAmount: 0,
    paymentStatus: "PAID",
    status: "RETURNED"
  });

  this.reservations[121] = new HoldQueue();
  this.reservations[121].enqueue({
    reservationID: "RES-501",
    bookID: 121,
    bookTitle: "Clean Code",
    memberID: "EXT-401",
    memberName: "Amit Kumar",
    dateJoined: "2026-08-10"
  });
  this.reservations[121].enqueue({
    reservationID: "RES-502",
    bookID: 121,
    bookTitle: "Clean Code",
    memberID: "STU-202",
    memberName: "Rahul Kumar",
    dateJoined: "2026-08-11"
  });
  this.reservations[121].enqueue({
    reservationID: "RES-503",
    bookID: 121,
    bookTitle: "Clean Code",
    memberID: "STU-203",
    memberName: "Sneha Sharma",
    dateJoined: "2026-08-12"
  });

  this.bookRequests = [
    {
      requestID: "REQ-701",
      title: "Designing Data-Intensive Applications (2nd Ed)",
      author: "Martin Kleppmann",
      memberID: "STU-201",
      memberName: "Aaditya Jaiswal",
      memberEmail: "student@univ.edu",
      reason: "Distributed systems course reference",
      dateRequested: "2026-08-20",
      status: "PENDING"
    }
  ];

  this.deposits = [
    { depositID: "DEP-701", memberID: "EXT-401", memberName: "Amit Kumar", amount: 500, datePaid: "2026-08-01", status: "HELD", refundID: null }
  ];

  this.feedbacks = [
    { feedbackID: "FBK-101", userName: "Aaditya Jaiswal", category: "Resources", rating: 5, comments: "Outstanding textbook collection for systems engineering and computer architecture!", timestamp: "2026-08-22 14:30" },
    { feedbackID: "FBK-102", userName: "Dr. Priya Patel", category: "Facilities", rating: 5, comments: "Seamless hold waitlist notifications and quiet study pods.", timestamp: "2026-08-23 11:15" },
    { feedbackID: "FBK-103", userName: "Amit Kumar", category: "Staff & Service", rating: 4, comments: "Prompt visitor check-in and deposit processing.", timestamp: "2026-08-24 16:45" }
  ];

  this.saveState();
};
