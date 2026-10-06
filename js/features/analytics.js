/* BUSINESS INTELLIGENCE & ANALYTICS FEATURE MODULE */
LuminaLibrary.prototype.renderAnalytics = function() {
  const totalCopies = this.books.reduce((acc, b) => acc + b.copies, 0);
  const availCopies = this.books.reduce((acc, b) => acc + b.available, 0);
  const issuedCopies = totalCopies - availCopies;
  const totalTransactions = this.transactionList.toArray().length;

  return `
    <div class="page-title-row">
      <div>
        <h1 class="page-heading">Library Intelligence & BI Analytics</h1>
        <p class="page-subtext">Real-time circulation trends, subject distributions, and patron rating breakdown</p>
      </div>
      <button class="btn btn-primary" onclick="app.exportHistoryCSV()">📥 Export Raw BI Ledger</button>
    </div>

    <div class="metric-grid" style="margin-bottom:24px;">
      <div class="metric-card"><div class="metric-header"><span class="metric-label">TOTAL CIRCULATION</span><div class="metric-icon-badge">📈</div></div><div class="metric-number">${totalTransactions}</div><div class="metric-desc">Lifetime issue transactions</div></div>
      <div class="metric-card success"><div class="metric-header"><span class="metric-label">SHELF SATURATION</span><div class="metric-icon-badge">📊</div></div><div class="metric-number" style="color:var(--success);">${totalCopies > 0 ? ((availCopies/totalCopies)*100).toFixed(0) : 0}%</div><div class="metric-desc">${availCopies} of ${totalCopies} books ready</div></div>
      <div class="metric-card warning"><div class="metric-header"><span class="metric-label">UTILIZATION RATE</span><div class="metric-icon-badge">⚡</div></div><div class="metric-number" style="color:var(--warning);">${totalCopies > 0 ? ((issuedCopies/totalCopies)*100).toFixed(0) : 0}%</div><div class="metric-desc">${issuedCopies} volumes currently active</div></div>
      <div class="metric-card purple"><div class="metric-header"><span class="metric-label">PATRON FEEDBACK</span><div class="metric-icon-badge">💬</div></div><div class="metric-number" style="color:var(--purple);">${this.feedbacks.length}</div><div class="metric-desc">Total verified submissions</div></div>
      <div class="metric-card danger"><div class="metric-header"><span class="metric-label">OVERDUE INCIDENCE</span><div class="metric-icon-badge">🚨</div></div><div class="metric-number" style="color:var(--danger);">${this.transactionList.toArray().filter(t => t.status==='ISSUED' && this.calculateOverdueDays(t.dueDate)>0).length}</div><div class="metric-desc">Requires desk follow-up</div></div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
      <div class="content-card" style="padding: 20px;"><h3 style="font-size: 0.95rem; font-weight:700; margin-bottom: 16px;">Top 6 Most Borrowed Volumes</h3><div style="height: 250px;"><canvas id="popularChart"></canvas></div></div>
      <div class="content-card" style="padding: 20px;"><h3 style="font-size: 0.95rem; font-weight:700; margin-bottom: 16px;">Collection Discipline Distribution</h3><div style="height: 250px;"><canvas id="categoryChart"></canvas></div></div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
      <div class="content-card" style="padding: 20px;"><h3 style="font-size: 0.95rem; font-weight:700; margin-bottom: 16px;">Patron Star Rating Distribution</h3><div style="height: 220px;"><canvas id="ratingsBreakdownChart"></canvas></div></div>
      <div class="content-card" style="padding: 20px;"><h3 style="font-size: 0.95rem; font-weight:700; margin-bottom: 16px;">Member Type Segmentation</h3><div style="height: 220px;"><canvas id="memberRoleChart"></canvas></div></div>
    </div>
  `;
};

LuminaLibrary.prototype.initAnalyticsCharts = function() {
  setTimeout(() => {
    const popularCanvas = document.getElementById("popularChart");
    if (popularCanvas) {
      if (this.chartInstances.popular && typeof this.chartInstances.popular.destroy === "function") this.chartInstances.popular.destroy();
      const sortedBooks = mergeSort([...this.books], b => -b.borrowCount);
      const topBooks = sortedBooks.slice(0, 6);
      this.chartInstances.popular = new Chart(popularCanvas, {
        type: "bar",
        data: {
          labels: topBooks.map(b => b.title.length > 20 ? b.title.substring(0, 18) + "..." : b.title),
          datasets: [{ label: "Total Borrows", data: topBooks.map(b => b.borrowCount), backgroundColor: "#3b82f6", borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: "#f1f5f9" } }, x: { grid: { display: false } } } }
      });
    }

    const catCanvas = document.getElementById("categoryChart");
    if (catCanvas) {
      if (this.chartInstances.category && typeof this.chartInstances.category.destroy === "function") this.chartInstances.category.destroy();
      const catCounts = {};
      this.books.forEach(b => { catCounts[b.category] = (catCounts[b.category] || 0) + 1; });
      this.chartInstances.category = new Chart(catCanvas, {
        type: "doughnut",
        data: { labels: Object.keys(catCounts), datasets: [{ data: Object.values(catCounts), backgroundColor: ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#64748b"] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right", labels: { boxWidth: 12, font: { size: 11 } } } } }
      });
    }

    const ratingCanvas = document.getElementById("ratingsBreakdownChart");
    if (ratingCanvas) {
      if (this.chartInstances.rating && typeof this.chartInstances.rating.destroy === "function") this.chartInstances.rating.destroy();
      const starCounts = [0, 0, 0, 0, 0];
      this.feedbacks.forEach(f => { if (f.rating >= 1 && f.rating <= 5) starCounts[f.rating - 1]++; });
      this.chartInstances.rating = new Chart(ratingCanvas, {
        type: "bar",
        data: { labels: ["1 Star", "2 Stars", "3 Stars", "4 Stars", "5 Stars"], datasets: [{ label: "Reviews", data: starCounts, backgroundColor: ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#10b981"], borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, stepSize: 1, grid: { color: "#f1f5f9" } }, x: { grid: { display: false } } } }
      });
    }

    const memberRoleCanvas = document.getElementById("memberRoleChart");
    if (memberRoleCanvas) {
      if (this.chartInstances.role && typeof this.chartInstances.role.destroy === "function") this.chartInstances.role.destroy();
      const roleCounts = { STUDENT: 0, TEACHER: 0, EXTERNAL: 0 };
      this.members.forEach(m => { roleCounts[m.userType] = (roleCounts[m.userType] || 0) + 1; });
      this.chartInstances.role = new Chart(memberRoleCanvas, {
        type: "pie",
        data: { labels: ["Students", "Faculty/Teachers", "External Visitors"], datasets: [{ data: [roleCounts.STUDENT, roleCounts.TEACHER, roleCounts.EXTERNAL], backgroundColor: ["#3b82f6", "#8b5cf6", "#f59e0b"] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } } }
      });
    }
  }, 50);
};
