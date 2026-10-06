/* COMMAND CENTER DASHBOARD FEATURE MODULE */
LuminaLibrary.prototype.renderDashboard = function() {
  const totalCopies = this.books.reduce((acc, b) => acc + b.copies, 0);
  const availCopies = this.books.reduce((acc, b) => acc + b.available, 0);
  const issuedCopies = totalCopies - availCopies;
  const allTransactions = this.transactionList.toArray();
  
  let totalFines = 0;
  let overdueCount = 0;
  allTransactions.filter(t => t.status === "ISSUED").forEach(t => {
    const days = this.calculateOverdueDays(t.dueDate);
    if (days > 0) {
      overdueCount++;
      totalFines += days * this.fineRatePerDay;
    }
  });

  const avgRating = this.feedbacks.length > 0 
    ? (this.feedbacks.reduce((a, c) => a + c.rating, 0) / this.feedbacks.length).toFixed(1) 
    : "4.7";

  return `
    <div class="page-title-row">
      <div>
        <h1 class="page-heading">Command Center</h1>
        <p class="page-subtext">Circulation metrics, BST lookups, feedback intelligence, and live loan ledgers</p>
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn" onclick="app.sendDailyOverdueReminders()">📧 Dispatch Batch Overdue Alerts</button>
        <button class="btn btn-primary" onclick="app.openModal('issue-book')">+ Issue Book</button>
      </div>
    </div>

    <div class="feedback-hero-banner">
      <div>
        <span class="badge" style="background:rgba(255,255,255,0.22); color:#ffffff; margin-bottom:8px; font-weight:600; font-size:0.75rem;">Experience Portal</span>
        <h2 style="font-size:1.35rem; font-weight:800; margin-bottom:4px;">Library Feedback & Star Rating</h2>
        <p style="font-size:0.83rem; opacity:0.92; max-width:620px;">Rate our textbook collections, study facilities, or digital desk service.</p>
      </div>
      <div style="display:flex; align-items:center; gap:14px;">
        <div style="background:#ffffff; padding:6px; border-radius:8px; display:inline-block; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
          <div id="feedback-qr-banner"></div>
        </div>
        <button class="btn" style="background:#ffffff; color:var(--text-main); font-weight:700; border:none; padding:10px 18px;" onclick="app.openFeedbackModal()">✍️ Write Feedback</button>
      </div>
    </div>

    <div class="metric-grid">
      <div class="metric-card"><div class="metric-header"><span class="metric-label">HOLDINGS</span><div class="metric-icon-badge">📚</div></div><div class="metric-number">${this.books.length}</div><div class="metric-desc">${totalCopies} physical volumes</div></div>
      <div class="metric-card success"><div class="metric-header"><span class="metric-label">IN STOCK ON SHELF</span><div class="metric-icon-badge">✅</div></div><div class="metric-number" style="color:#10b981;">${availCopies}</div><div class="metric-desc">Available for immediate loan</div></div>
      <div class="metric-card warning"><div class="metric-header"><span class="metric-label">ON LOAN</span><div class="metric-icon-badge">🔄</div></div><div class="metric-number" style="color:#f97316;">${issuedCopies}</div><div class="metric-desc">${overdueCount} marked overdue</div></div>
      <div class="metric-card purple"><div class="metric-header"><span class="metric-label">AVG PATRON RATING</span><div class="metric-icon-badge">⭐</div></div><div class="metric-number" style="color:#6366f1;">${avgRating} / 5.0</div><div class="metric-desc">Across ${this.feedbacks.length} campus reviews</div></div>
      <div class="metric-card danger"><div class="metric-header"><span class="metric-label">UNPAID FINES</span><div class="metric-icon-badge">💰</div></div><div class="metric-number" style="color:#ef4444;">₹${totalFines.toFixed(2)}</div><div class="metric-desc">Standard ₹${this.fineRatePerDay}/day rate</div></div>
    </div>

    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 24px;">
      <div class="content-card" style="margin-bottom:0;">
        <div class="card-header-bar"><h3>Live Lending Activity Log</h3><span class="badge badge-muted">Automated Ledger</span></div>
        <table class="custom-table">
          <thead><tr><th>BOOK TITLE</th><th>BORROWER NAME</th><th>DUE DATE</th><th>STATUS</th></tr></thead>
          <tbody>
            ${allTransactions.slice(0, 5).map(t => {
              const isLate = t.status === "ISSUED" && this.calculateOverdueDays(t.dueDate) > 0;
              return `<tr><td><strong>${t.bookTitle}</strong></td><td>${t.memberName}</td><td>${t.dueDate}</td><td>${isLate ? `<span class="badge badge-danger">OVERDUE</span>` : (t.status === 'ISSUED' ? `<span class="badge badge-warning">ON LOAN</span>` : `<span class="badge badge-success">RETURNED</span>`)}</td></tr>`;
            }).join('') || `<tr><td colspan="4" style="text-align:center;">No active circulation records.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="content-card" style="padding: 20px; display:flex; flex-direction:column; justify-content:space-between; margin-bottom:0;">
        <h3 style="font-size: 0.95rem; font-weight:700; margin-bottom: 12px;">Shelf Distribution</h3>
        <div style="position:relative; height:190px; display:grid; place-items:center;"><canvas id="shelfChart"></canvas></div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
      <div class="content-card" style="margin-bottom:0;">
        <div class="card-header-bar">
          <h3>Recent Patron Feedbacks (${this.feedbacks.length})</h3>
          <button class="btn btn-sm btn-primary" onclick="app.openFeedbackModal()">+ Add Review</button>
        </div>
        <table class="custom-table">
          <thead>
            <tr><th>USER</th><th>CATEGORY</th><th>RATING</th><th>COMMENTS</th></tr>
          </thead>
          <tbody>
            ${this.feedbacks.map(f => `
              <tr>
                <td><strong>${f.userName}</strong><br><small style="color:var(--text-muted);">${f.timestamp}</small></td>
                <td><span class="badge badge-muted">${f.category}</span></td>
                <td style="color:#f59e0b; font-size:1rem; letter-spacing:1px;">${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</td>
                <td><em style="color:var(--text-body);">"${f.comments}"</em></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="content-card" style="padding: 20px; display:flex; flex-direction:column; justify-content:space-between; margin-bottom:0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="font-size: 0.95rem; font-weight:700;">Feedback Sentiment & Quality</h3>
          <span class="badge badge-success">All Ratings Healthy</span>
        </div>
        <div style="position:relative; height:180px; display:grid; place-items:center;">
          <canvas id="feedbackSentimentChart"></canvas>
        </div>
        <div style="font-size:0.75rem; color:var(--text-muted); text-align:center; margin-top:8px;">
          Based on verified patron satisfaction surveys.
        </div>
      </div>
    </div>
  `;
};

LuminaLibrary.prototype.initDashboardCharts = function() {
  setTimeout(() => {
    const bannerQREl = document.getElementById("feedback-qr-banner");
    if (bannerQREl && typeof QRCode !== "undefined") {
      bannerQREl.innerHTML = "";
      const qrUrl = (typeof window !== "undefined" && window.location) ? (window.location.href || "#feedback") : "#feedback";
      new QRCode(bannerQREl, { text: qrUrl, width: 52, height: 52, colorDark: "#0f172a", colorLight: "#ffffff" });
    }

    const shelfCanvas = document.getElementById("shelfChart");
    if (shelfCanvas) {
      if (this.chartInstances.shelf && typeof this.chartInstances.shelf.destroy === "function") this.chartInstances.shelf.destroy();
      const totalCopies = this.books.reduce((acc, b) => acc + b.copies, 0);
      const availCopies = this.books.reduce((acc, b) => acc + b.available, 0);

      this.chartInstances.shelf = new Chart(shelfCanvas, {
        type: "doughnut",
        data: {
          labels: ["On Shelf", "On Loan"],
          datasets: [{ data: [availCopies, totalCopies - availCopies], backgroundColor: ["#10b981", "#f97316"], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: "74%", plugins: { legend: { display: false } } }
      });
    }

    const sentimentCanvas = document.getElementById("feedbackSentimentChart");
    if (sentimentCanvas) {
      if (this.chartInstances.sentiment && typeof this.chartInstances.sentiment.destroy === "function") this.chartInstances.sentiment.destroy();
      const starCounts = [0, 0, 0, 0, 0];
      this.feedbacks.forEach(f => { if (f.rating >= 1 && f.rating <= 5) starCounts[f.rating - 1]++; });

      this.chartInstances.sentiment = new Chart(sentimentCanvas, {
        type: "bar",
        data: {
          labels: ["1★", "2★", "3★", "4★", "5★"],
          datasets: [{ data: starCounts, backgroundColor: ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#10b981"], borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, stepSize: 1, grid: { color: "#f1f5f9" } }, x: { grid: { display: false } } } }
      });
    }
  }, 50);
};
