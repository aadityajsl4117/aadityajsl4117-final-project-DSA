/* BOOK CATALOG & BST MANAGEMENT FEATURE MODULE */
LuminaLibrary.prototype.renderCatalog = function() {
  return `
    <div class="page-title-row">
      <div>
        <h1 class="page-heading">Library Book Repository (${this.books.length} Titles)</h1>
        <p class="page-subtext">Comprehensive catalog indexed with Binary Search Tree (BST) & Array</p>
      </div>
      <button class="btn btn-primary" onclick="app.openModal('add-book')">+ Add New Title</button>
    </div>

    <div class="catalog-grid">
      ${this.books.map(b => {
        const coverUrl = this.getBookCover(b);
        return `
          <div class="book-card-box">
            <div>
              <div class="book-info-row">
                <img src="${coverUrl}" class="book-thumb" alt="${b.title}" onerror="this.src='${this.defaultPlaceholder}'">
                <div class="book-details">
                  <div>
                    <span class="badge badge-muted" style="margin-bottom: 4px;">ID: #${b.bookID}</span>
                    <h4>${b.title}</h4>
                    <span class="author-name">${b.author}</span>
                  </div>
                  <div style="font-size: 0.73rem; color: var(--text-muted); margin-top: 6px;">
                    <span>${b.category}</span> • <strong>Shelf ${b.shelf}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div style="border-top: 1px solid var(--border-subtle); padding-top: 12px; display: flex; justify-content: space-between; align-items: center;">
              <span class="badge ${b.available > 0 ? 'badge-success' : 'badge-danger'}">
                ${b.available > 0 ? `${b.available} of ${b.copies} In Stock` : 'Out of Stock'}
              </span>
              <div style="display:flex; gap:6px;">
                <button class="btn btn-sm" onclick="app.showBookDetails(${b.bookID})">Details</button>
                <button class="btn btn-sm" style="border-color:#cbd5e1;" onclick="app.openEditBookModal(${b.bookID})">✏️ Edit</button>
                <button class="btn btn-sm" style="border-color:#fca5a5; color:var(--danger);" onclick="app.handleDeleteBook(${b.bookID})">🗑️ Delete</button>
                <button class="btn btn-sm" onclick="app.showSingleBookHistory(${b.bookID})">History</button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
};

/** Live feedback under the Book ID box while typing (the server still has the final say) */
LuminaLibrary.prototype.checkBookIDHint = function(value) {
  const hint = document.getElementById("nb-id-hint");
  if (!hint) return;
  const text = String(value || "").trim();
  const next = (this.books || []).reduce((m, b) => Math.max(m, Number(b.bookID) || 0), 100) + 1;
  hint.style.color = "var(--text-muted)";
  if (!text) { hint.textContent = `Type your own ID, or leave empty to auto-assign #${next}.`; return; }
  if (!/^\d{1,9}$/.test(text) || parseInt(text, 10) < 1) { hint.style.color = "var(--danger)"; hint.textContent = "Use a whole number, 1 or higher."; return; }
  const used = (this.books || []).find(b => b.bookID === parseInt(text, 10));
  if (used) { hint.style.color = "var(--danger)"; hint.textContent = `#${text} is already used by "${used.title}". Choose another.`; return; }
  hint.style.color = "#15803d";
  hint.textContent = `✔ #${text} is free.`;
};

LuminaLibrary.prototype.handleAddBookForm = async function(e) {
  e.preventDefault();
  const title = document.getElementById("nb-title").value.trim();
  const author = document.getElementById("nb-author").value.trim();
  const category = document.getElementById("nb-cat").value.trim();
  const isbn = document.getElementById("nb-isbn").value.trim();
  const shelf = document.getElementById("nb-shelf").value.trim();
  const copies = parseInt(document.getElementById("nb-copies").value);
  const coverUrl = document.getElementById("nb-coverurl").value.trim();
  const idText = (document.getElementById("nb-id").value || "").trim();   // empty = auto-assign

  if (idText && (!/^\d{1,9}$/.test(idText) || parseInt(idText, 10) < 1)) {
    this.showToast("Book ID must be a whole number (1 or higher), or leave it empty.", true);
    return;
  }

  try {
    if (window.LuminaAPI) {
      const payload = { title, author, category, isbn, shelf, copies, coverUrl, publisher: "University Press", year: 2026 };
      if (idText) payload.bookID = parseInt(idText, 10);
      const res = await window.LuminaAPI.addBook(payload);
      const assignedID = res.bookID || (res.book ? (res.book.bookID || res.book.book_id) : null);
      this.showToast(`Title '${title}' added with Book ID #${assignedID || ''}!`);
      this.closeModal();
      await this.loadState();
      return;
    }
  } catch (err) {
    this.showToast(err.message || "Failed to add book to database", true);
    return;
  }

  // Fallback
  const id = idText ? parseInt(idText, 10) : Math.floor(100 + Math.random() * 900);
  if (this.books.some(b => b.bookID === id)) { this.showToast(`Book ID #${id} is already in use.`, true); return; }
  const newBook = { bookID: id, title, author, category, isbn, copies, available: copies, shelf, coverUrl };
  this.books.unshift(newBook);
  this.bookBST.rebuild(this.books);
  this.showToast(`Title '${title}' added!`);
  this.closeModal();
  this.saveState();
  this.render();
};

LuminaLibrary.prototype.showBookDetails = function(bookID) {
  const bstSearch = this.bookBST.search(bookID);
  const book = bstSearch ? bstSearch.book : this.findBook(bookID);
  if (!book) return;

  const modal = document.getElementById("app-modal");
  const dialog = document.getElementById("modal-content");
  const queue = this.reservations[book.bookID];
  const waitCount = queue ? queue.size() : 0;
  const coverUrl = this.getBookCover(book);

  dialog.innerHTML = `
    <div style="padding:24px;">
      <div style="display:flex; gap:20px;">
        <img src="${coverUrl}" style="width:110px; height:160px; object-fit:cover; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);" onerror="this.src='${this.defaultPlaceholder}'">
        <div style="flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <span class="badge badge-muted">Book ID: #${book.bookID}</span>
              <h2 style="font-size:1.3rem; font-weight:800; margin-top:4px;">${book.title}</h2>
              <p style="font-size:0.85rem; color:var(--text-muted);">${book.author}</p>
            </div>
            <span class="badge ${book.available > 0 ? 'badge-success' : 'badge-danger'}">
              ${book.available > 0 ? `${book.available} Available` : 'Out of Stock'}
            </span>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px; background:var(--bg-card-subtle); padding:12px; border-radius:var(--radius-sm); font-size:0.8rem;">
            <div><strong>Category:</strong> ${book.category}</div>
            <div><strong>Shelf Location:</strong> <code>${book.shelf}</code></div>
            <div><strong>ISBN:</strong> ${book.isbn}</div>
            <div><strong>Publisher / Year:</strong> ${book.publisher || 'Academic'} (${book.year || '2024'})</div>
            <div><strong>Total Holdings:</strong> ${book.copies} Copies</div>
            <div><strong>Lifetime Borrows:</strong> ${book.borrowCount || 0} Loans</div>
          </div>
        </div>
      </div>

      <div style="margin-top:16px; background:#eff6ff; border:1px solid #bfdbfe; padding:12px; border-radius:var(--radius-sm); font-size:0.78rem;">
        ⚡ <strong>Binary Search Tree (BST) Metric:</strong> Located via <code>BookBST.search(${book.bookID})</code> in <strong>${bstSearch ? bstSearch.hops : 1} hop(s)</strong> with time complexity <strong>O(log n)</strong>.
        ${waitCount > 0 ? `<br><strong style="color:var(--danger);">Hold Waitlist:</strong> ${waitCount} patrons currently waiting in FIFO queue.` : ''}
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
        ${book.available > 0 ? `
          <button class="btn btn-primary" onclick="app.closeModal(); app.openModal('issue-book', { bookID: ${book.bookID} })">Issue Book Now</button>
        ` : `
          <button class="btn btn-primary" onclick="app.closeModal(); app.openModal('user-book-request', { title: '${book.title}' })">Join Waitlist</button>
        `}
        <button class="btn" onclick="app.closeModal()">Close</button>
      </div>
    </div>
  `;
  modal.style.display = "grid";
};

LuminaLibrary.prototype.handleCopiesInputChange = function(initialCopies, initialAvailable) {
  const copiesInput = document.getElementById("edit-b-copies");
  const availInput = document.getElementById("edit-b-available");
  if (!copiesInput || !availInput) return;
  const newCopies = parseInt(copiesInput.value);
  const issued = Math.max(0, initialCopies - initialAvailable);
  if (!isNaN(newCopies) && newCopies >= issued) {
    availInput.value = newCopies - issued;
  }
};

LuminaLibrary.prototype.openEditBookModal = async function(bookID) {
  let b = this.findBook(bookID);

  if (window.LuminaAPI) {
    try {
      const res = await window.LuminaAPI.request(`/books/${bookID}`);
      if (res && res.book) {
        const bk = res.book;
        b = {
          bookID: bk.book_id || bk.bookID || bookID,
          title: bk.title,
          author: bk.author,
          category: bk.category,
          isbn: bk.isbn || '',
          publisher: bk.publisher || '',
          year: bk.year || '',
          copies: bk.copies,
          available: bk.available_copies !== undefined ? bk.available_copies : bk.available,
          shelf: bk.shelf || '',
          coverUrl: bk.cover_url || bk.coverUrl || '',
          borrowCount: bk.borrow_count || 0
        };
      }
    } catch(e) {}
  }

  if (!b) return;

  const modal = document.getElementById("app-modal");
  const dialog = document.getElementById("modal-content");

  const initialCopies = b.copies || 0;
  const initialAvailable = b.available !== undefined ? b.available : 0;
  const issued = Math.max(0, initialCopies - initialAvailable);

  dialog.innerHTML = `
    <div style="padding: 24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h2 style="font-size:1.25rem; font-weight:800;">Edit Book Details: ${b.title}</h2>
        <span class="badge badge-primary">ID: #${b.bookID}</span>
      </div>

      <form onsubmit="app.handleUpdateBook(event, ${b.bookID})">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div><label style="font-size:0.75rem; font-weight:700;">Book ID</label><input type="number" id="edit-b-id" value="${b.bookID}" readonly style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px; background:var(--bg-card-subtle);"></div>
          <div>
            <label style="font-size:0.75rem; font-weight:700;">Total Copies</label>
            <input type="number" id="edit-b-copies" value="${b.copies}" min="1" required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;" oninput="app.handleCopiesInputChange(${initialCopies}, ${initialAvailable})">
          </div>
          <div style="grid-column:span 2;"><label style="font-size:0.75rem; font-weight:700;">Title</label><input type="text" id="edit-b-title" value="${b.title}" required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;"></div>
          <div style="grid-column:span 2;"><label style="font-size:0.75rem; font-weight:700;">Author</label><input type="text" id="edit-b-author" value="${b.author}" required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;"></div>
          <div><label style="font-size:0.75rem; font-weight:700;">Category</label><input type="text" id="edit-b-cat" value="${b.category}" required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;"></div>
          <div><label style="font-size:0.75rem; font-weight:700;">ISBN</label><input type="text" id="edit-b-isbn" value="${b.isbn || ''}" style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;"></div>
          <div><label style="font-size:0.75rem; font-weight:700;">Shelf Location</label><input type="text" id="edit-b-shelf" value="${b.shelf || 'SE-01'}" required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;"></div>
          <div>
            <label style="font-size:0.75rem; font-weight:700;">Available Copies</label>
            <input type="number" id="edit-b-available" value="${b.available}" min="0" required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;">
          </div>
          
          <div style="grid-column:span 2;">
            <label style="font-size:0.75rem; font-weight:700;">Cover Image URL (Optional - Leave blank for default placeholder)</label>
            <input type="url" id="edit-b-coverurl" value="${b.coverUrl || ''}" placeholder="https://example.com/cover.jpg" style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;">
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
          <button type="button" class="btn" onclick="app.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">SAVE</button>
        </div>
      </form>
    </div>
  `;
  modal.style.display = "grid";
};

LuminaLibrary.prototype.handleUpdateBook = async function(e, bookID) {
  e.preventDefault();
  let b = this.findBook(bookID);

  const newTitle = document.getElementById("edit-b-title").value.trim();
  const newAuthor = document.getElementById("edit-b-author").value.trim();
  const newCat = document.getElementById("edit-b-cat").value.trim();
  const newIsbn = document.getElementById("edit-b-isbn").value.trim();
  const newShelf = document.getElementById("edit-b-shelf").value.trim();
  const newCopies = parseInt(document.getElementById("edit-b-copies").value);
  const newAvail = parseInt(document.getElementById("edit-b-available").value);
  const newCoverUrl = document.getElementById("edit-b-coverurl").value.trim();

  const currentCopies = b ? (b.copies || 0) : 0;
  const currentAvailable = b ? (b.available !== undefined ? b.available : (b.available_copies || 0)) : 0;
  const issuedCopies = Math.max(0, currentCopies - currentAvailable);

  if (!isNaN(newCopies) && newCopies < issuedCopies) {
    this.showToast("Total copies cannot be less than currently issued copies.", true);
    return;
  }

  try {
    if (window.LuminaAPI) {
      await window.LuminaAPI.updateBook(bookID, {
        title: newTitle,
        author: newAuthor,
        category: newCat,
        isbn: newIsbn,
        shelf: newShelf,
        copies: newCopies,
        available: newAvail,
        coverUrl: newCoverUrl
      });
      this.showToast(`Updated '${newTitle}' in database!`);
      this.closeModal();
      await this.loadState();
      return;
    }
  } catch (err) {
    this.showToast(err.message || "Failed to update book in database", true);
    return;
  }

  // Fallback
  if (b) {
    b.title = newTitle;
    b.author = newAuthor;
    b.category = newCat;
    b.isbn = newIsbn;
    b.shelf = newShelf;
    b.copies = newCopies;
    b.available = newAvail;
    b.coverUrl = newCoverUrl;
  }

  this.showToast(`Updated '${newTitle}' successfully!`);
  this.closeModal();
  this.saveState();
  this.render();
};

LuminaLibrary.prototype.handleDeleteBook = async function(bookID) {
  const b = this.findBook(bookID);
  const title = b ? b.title : `#${bookID}`;
  const confirmed = confirm(`Are you sure you want to delete Book #${bookID} ('${title}') from the library repository database?`);
  if (!confirmed) return;

  try {
    if (window.LuminaAPI) {
      await window.LuminaAPI.deleteBook(bookID);
      this.showToast(`Deleted Book #${bookID} ('${title}') from database!`);
      await this.loadState();
      return;
    }
  } catch (err) {
    this.showToast(err.message || "Failed to delete book from database", true);
    return;
  }

  // Fallback
  this.books = this.books.filter(bk => bk.bookID !== parseInt(bookID));
  if (this.bookBST) this.bookBST.rebuild(this.books);
  this.showToast(`Deleted Book #${bookID} successfully!`);
  this.saveState();
  this.render();
};
