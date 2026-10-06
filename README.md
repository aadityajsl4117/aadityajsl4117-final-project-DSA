<<<<<<< HEAD
# final-project-DSA
=======
# 📚 Lumina Library — Enterprise Library Management System

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Database: SQLite](https://img.shields.io/badge/Database-SQLite3-blue)](https://www.sqlite.org/)
[![AI Engine](https://img.shields.io/badge/AI-Librarian_Engine-purple)](/api/ai/query)

An enterprise-grade, full-stack **Library Management System** built with Node.js, Express, SQLite3, HTML5, CSS3, and modern JavaScript. Lumina Library features **real-time REST API database synchronization**, **natural language Librarian AI assistant**, **dynamic fine calculation & UPI QR settlement**, **automated EmailJS & background reminder dispatches**, and **built-in Data Structures & Algorithms (DSA)** implementations.

---

## ✨ Features & System Modules

1. **📊 Executive Dashboard**: Real-time KPI statistics for total books, active members, loans, overdue charges, and settled revenue.
2. **📖 Book Catalog Repository**: Complete catalog management indexed with a **Binary Search Tree (BST)** for O(log n) searches and in-order traversal display.
3. **👥 Membership Directory**: Patron enrollment, biometric camera photo capture, role assignment (Student/Faculty), and soft deactivation.
4. **🔄 Borrow & Issue Return Desk**: Atomic checkouts, return processing, automatic late fine calculation (₹5.00/day), and loan custody timelines.
5. **⏳ FIFO Waiting List Queue**: Priority reservation queue for out-of-stock titles managed via a First-In-First-Out (FIFO) queue data structure.
6. **📥 Book Request Pipeline**: Procurement workflow for requesting unavailable titles, tracking status (Pending, Ordered, Arrived), and notifying members upon delivery.
7. **💳 Fines & Payment Settlement**: Idempotent fine settlement supporting Cash and dynamic UPI QR code payments with instant receipt generation.
8. **✉️ Real-Time Email Dispatch**: Audit outbox tracking registration receipts, return notices, and batch overdue alerts via EmailJS / REST backend.
9. **🔔 Notifications & Reminders**: Automated background reminders for near-due and overdue loans.
10. **🤖 AI Librarian Assistant**: Natural language catalog discovery assistant powered by real-time SQLite database lookups without hallucinating stock or authors.
11. **🔍 Global Search & Filtering**: Multi-attribute cross-table search across titles, authors, categories, ISBNs, and member IDs.
12. **🛡️ Master Audit History**: Append-only ledger of every login (incl. failures), logout, catalog/member edit (with old ➔ new values), checkout, return, renewal, deposit, fine payment, waitlist and book-request event. Searchable, filterable (module / action / result / date range), paginated, and exportable to CSV from the Audit page.
13. **📈 Dynamic Analytics**: Real-time SQL aggregations and metric visualizations.

---

## 🧩 Data Structures & Algorithms (DSA) Implementations

Lumina Library incorporates foundational computer science data structures:

* **Binary Search Tree (`BookBST`)**: Indexes books by `book_id` for $O(\log n)$ search efficiency and in-order traversal catalog rendering.
* **Linked List (`BorrowHistoryLinkedList`)**: Manages transaction custody histories for chronological iteration.
* **FIFO Queue (`HoldQueue`)**: Manages priority waiting list reservations for out-of-stock titles.
* **LIFO Stack (`UndoStack`)**: Manages administrative undo operations for checkouts and registration reversals.
* **Merge Sort**: Orders catalog titles and search results.

---

## 🛠️ Tech Stack & Prerequisites

* **Runtime**: [Node.js](https://nodejs.org/) (v18+ recommended)
* **Backend Framework**: Express.js
* **Database**: SQLite3 (`server/lumina_library.db`)
* **Security & Auth**: Bcrypt.js, JSON Web Tokens (JWT)
* **Frontend**: HTML5, CSS3 (Modern Flexbox/Grid, Responsive Mobile Hamburger Menu), Vanilla ES6 JavaScript

---

## 🚀 Quick Start Guide

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/lumina-library.git
cd lumina-library
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Default `.env` configuration:
```env
PORT=3000
HOST=0.0.0.0
DATABASE_PATH=server/lumina_library.db
JWT_SECRET=lumina-secret-key-2026-enterprise
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=admin@lumina.edu
EMAIL_PASSWORD=your_secure_password
EMAIL_FROM=noreply@lumina.edu
```

### 4. Start the Application
```bash
npm start
```

Access the application in your browser at:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🧪 Automated E2E Verification & Test Suite

The project includes automated verification test scripts that validate all backend endpoints and full frontend-backend integration:

```bash
# Run complete test suite (Backend 21/21 PASS + Frontend Integration 15/15 PASS)
npm test

# Run backend unit & REST API tests only
npm run test:backend

# Run frontend-backend integration flow tests only
npm run test:integration
```

---

## 📡 REST API Endpoint Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticates user credentials & returns JWT token |
| `POST` | `/api/auth/logout` | Logs out active session |
| `GET` | `/api/bootstrap` | Retrieves full system initial state (Books, Members, Loans, Waitlists, Payments, Audit Logs) |
| `GET` | `/api/books` | Fetches book catalog |
| `POST` | `/api/books` | Adds new book to database |
| `PUT` | `/api/books/:id` | Updates book record |
| `DELETE` | `/api/books/:id` | Deletes book record |
| `GET` | `/api/members` | Fetches patron members list |
| `POST` | `/api/members` | Registers new member |
| `PUT` | `/api/members/:id` | Updates member details |
| `DELETE` | `/api/members/:id` | Soft-deactivates member account |
| `POST` | `/api/circulation/issue` | Issues book loan transaction |
| `POST` | `/api/circulation/return` | Processes book return & calculates fines |
| `POST` | `/api/circulation/renew` | Extends active loan due date |
| `POST` | `/api/payments/settle` | Settles overdue charges via Cash / UPI QR |
| `POST` | `/api/waiting-list` | Registers FIFO queue position for hold reservation |
| `POST` | `/api/book-requests` | Submits book purchase request |
| `POST` | `/api/emails/send` | Dispatches & logs email delivery |
| `POST` | `/api/reminders/send` | Triggers batch overdue reminder notices |
| `POST` | `/api/ai/query` | Executes natural language catalog assistant query |
| `GET` | `/api/analytics` | Computes dynamic live SQL aggregate metrics |
| `GET` | `/api/search` | Cross-table global search |
| `GET` | `/api/audit-logs` | Retrieves security audit trail |

---

## 🌐 Deployment Instructions

### Deploy to Render / Railway / Fly.io / Heroku

1. Push your code to GitHub (see instructions below).
2. Create a new Web Service on your deployment provider and connect your GitHub repository.
3. Set **Build Command**: `npm install`
4. Set **Start Command**: `npm start`
5. Add environment variables (`PORT`, `JWT_SECRET`, etc.) in the dashboard settings.
6. Deploy! The server will bind to `0.0.0.0:${PORT}` and serve the entire application on **ONE Public URL**.

---

## 📤 GitHub Push Instructions

Run the following commands in your terminal to push this project to GitHub:

```bash
# 1. Initialize Git repository
git init

# 2. Add all project files
git add .

# 3. Create initial commit
git commit -m "Initial commit: Complete Lumina Library System with SQLite, AI, and DSA"

# 4. Rename main branch
git branch -M main

# 5. Link your GitHub remote repository (replace URL with your repository link)
git remote add origin https://github.com/YOUR_USERNAME/lumina-library.git

# 6. Push to GitHub
git push -u origin main
```

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.


---

## 🛡️ Audit Module Notes

| Item | Detail |
|------|--------|
| API | `GET /api/audit` (search, `module`, `action`, `status`, `from`, `to`, `page`, `limit`), `GET /api/audit/export` (CSV of current filter), `POST /api/audit` (browser-originated events), `GET /api/audit-logs` (legacy flat list) |
| Writes | All server events go through one `logAudit()` helper that never breaks the business operation if logging fails |
| Immutability | No update/delete endpoints exist for audit rows |
| Tests | `npm run test:audit` (backend, throw-away DB) · `python3 server/test-audit-ui.py` (browser, needs Playwright) |
| Clean-up | `npm run audit:cleanup` (dry run) / `npm run audit:cleanup:apply` removes automated-test rows and normalises old timestamps |

> Run automated tests against a copy of the database (`DATABASE_PATH=/tmp/copy.db`) so they do not add rows to the real audit ledger.


---

## 🤖 AI Library Assistant (Claude + live database)

```
Chat UI -> POST /api/ai/query -> session memory + intent detection
        -> Claude (tool use)  [or clearly-labelled "basic mode" if Claude is unavailable]
        -> READ-ONLY library tools -> live SQLite -> natural reply + live book cards
Actions (waiting list / book request): Claude only PROPOSES -> user clicks Confirm
        -> POST /api/ai/confirm -> re-validated write -> read back (verified) -> audit log
```

| Item | Detail |
|------|--------|
| Setup | Put `ANTHROPIC_API_KEY=...` in `.env` (see `.env.example`). Server-side only; never sent to the browser. Optional: `ANTHROPIC_MODEL`, `ANTHROPIC_TIMEOUT_MS`, `AI_RATE_MAX` (messages/min per chat, default 30) |
| Without a key | Basic mode: rule-based, still grounded in the live database, labelled "Basic mode" in the chat |
| Code | `server/ai/` - `index.js` (routes), `claude.js` (Messages API + tool loop), `tools.js` (read tools, proposals, confirmed actions, authorization), `search.js` (typo-tolerant retrieval), `intent.js`, `session.js`, `fallback.js`, `guard.js` |
| Guards | Stock numbers and listed titles in Claude's text are re-checked against the database before the user sees them |
| Tests | `npm run test:ai` (HTTP end-to-end, own servers, mock Anthropic API) - `npm run test:ai:ui` (real browser, needs Playwright and a free port 3000) |

> The catalog stores no description / keywords / subject / reading-level fields, so the assistant cannot search or answer by those and says so.


---

## 🧹 Starting fresh: clean all data, keep the books

```bash
npm run cleanup:all          # dry run - shows exactly what would happen, changes nothing
npm run cleanup:all:apply    # stop the server first; makes a backup copy, then cleans
```

| Kept | Deleted |
|------|---------|
| **books** (every catalog field, proven by a before/after checksum), **users** (sign-in accounts), `system_config` (the "already initialised" marker - without it the server would re-create its demo data) | members, loans, payments, deposits, waiting list, book requests, feedback, emails, notifications, audit log |

Book counters tied to the deleted loans are reset: `available_copies` = total copies, `borrow_count` = 0 (add `--keep-borrow-counts` to keep the old numbers). The clean-up runs as one all-or-nothing transaction and rolls back if the book catalog would change. To undo, stop the server and copy the backup file (`lumina_library.db.BEFORE-CLEANUP-<time>`) over `server/lumina_library.db`.

**Tests never use your data.** `npm run test-db -- /tmp/demo.db` builds a throw-away demo database (55 books, 10 members, loans...) for the browser tests and for the older suites that expect a running server (`DATABASE_PATH=/tmp/demo.db npm start`).
>>>>>>> 8039139 (Libray Managemnt system)
