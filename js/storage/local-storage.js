LuminaLibrary.prototype.loadState = async function() {
  try {
    if (window.LuminaAPI) {
      const data = await window.LuminaAPI.getBootstrap();
      if (data && data.books) {
        this.books = data.books || [];
        this.members = data.members || [];
        
        // Load into BorrowHistoryLinkedList DSA structure
        if (this.transactionList && typeof this.transactionList.loadFromArray === 'function') {
          this.transactionList.loadFromArray(data.transactions || []);
        }

        this.bookRequests = data.bookRequests || [];
        this.payments = data.payments || [];
        this.deposits = data.deposits || [];
        this.feedbacks = data.feedbacks || [];
        this.outbox = data.outbox || [];
        this.history = data.history || [];

        // Load into HoldQueue FIFO DSA structures
        this.reservations = {};
        if (data.reservations) {
          Object.keys(data.reservations).forEach(bID => {
            const q = new HoldQueue();
            (data.reservations[bID] || []).forEach(item => q.enqueue(item));
            this.reservations[bID] = q;
          });
        }

        // Rebuild Binary Search Tree (BST) DSA structure
        if (this.bookBST && typeof this.bookBST.rebuild === 'function') {
          this.bookBST.rebuild(this.books);
        }

        this.updateBadgeCounts();
        this.render();
        return true;
      }
    }
  } catch (e) {
    console.error("Backend REST API loadState error:", e.message || e);
  }

  // Fallback to LocalStorage cache if API is offline
  try {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.books && data.books.length > 0) {
        this.books = data.books;
        this.members = data.members || [];
        if (this.transactionList && typeof this.transactionList.loadFromArray === 'function') {
          this.transactionList.loadFromArray(data.transactions || []);
        }
        this.bookRequests = data.bookRequests || [];
        this.deposits = data.deposits || [];
        this.feedbacks = data.feedbacks || [];
        this.outbox = data.outbox || [];
        this.history = data.history || [];
        this.sentReminders = data.sentReminders || {};

        this.reservations = {};
        if (data.reservations) {
          Object.keys(data.reservations).forEach(k => {
            const q = new HoldQueue();
            (data.reservations[k] || []).forEach(item => q.enqueue(item));
            this.reservations[k] = q;
          });
        }
        if (this.bookBST && typeof this.bookBST.rebuild === 'function') {
          this.bookBST.rebuild(this.books);
        }
        this.updateBadgeCounts();
        this.render();
        return true;
      }
    }
  } catch (e) {
    console.warn("Storage Load Error, resetting defaults:", e);
  }

  if (typeof this.seedInitialData === 'function') {
    this.seedInitialData();
  }
};

LuminaLibrary.prototype.saveState = function() {
  try {
    const serializedQueues = {};
    if (this.reservations) {
      Object.keys(this.reservations).forEach(k => {
        if (this.reservations[k] && typeof this.reservations[k].toArray === 'function') {
          serializedQueues[k] = this.reservations[k].toArray();
        }
      });
    }

    const payload = {
      books: this.books,
      members: this.members,
      transactions: this.transactionList ? this.transactionList.toArray() : [],
      reservations: serializedQueues,
      bookRequests: this.bookRequests,
      deposits: this.deposits,
      feedbacks: this.feedbacks,
      outbox: this.outbox,
      history: this.history,
      sentReminders: this.sentReminders || {}
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error("Storage Save Error:", e);
  }
};
