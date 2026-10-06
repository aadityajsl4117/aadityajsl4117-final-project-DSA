LuminaLibrary.prototype.showMemberTrackingDetails = function(memberID) {
  const m = this.findMember(memberID);
  if (!m) return;
  const myLoans = this.transactionList.toArray().filter(t => t.memberID === memberID);
  const activeCount = myLoans.filter(t => t.status === "ISSUED").length;
  const maxLimit = m.borrowLimit || 5;

  const modal = document.getElementById("app-modal");
  const dialog = document.getElementById("modal-content");

  dialog.innerHTML = `
    <div style="padding: 24px;">
      <div style="font-size:1.25rem; font-weight:800; border-bottom:1px solid var(--border-subtle); padding-bottom:10px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
        <span>Patron Profile: ${m.name}</span>
        <span class="badge badge-primary">${m.userType}</span>
      </div>
      <div style="display:grid; grid-template-columns:1fr 2fr; gap:20px;">
        <div style="text-align:center;">
          <img src="${m.photo || 'https://via.placeholder.com/80'}" style="width:90px; height:90px; border-radius:50%; object-fit:cover; border:2px solid #bfdbfe; margin-bottom:8px;">
          <h3 style="font-size:1.1rem; font-weight:800;">${m.name}</h3>
          <div style="margin-top:10px; font-size:0.8rem; color:var(--text-muted); text-align:left; line-height:1.7;">
            <div><strong>ID:</strong> ${m.displayID || m.memberID}</div>
            <div><strong>Dept:</strong> ${m.department}</div>
            <div><strong>Email:</strong> ${m.email}</div>
            <div><strong>Phone:</strong> ${m.phone}</div>
            <div><strong>Active Loans:</strong> ${activeCount} / ${maxLimit} Max</div>
          </div>
          <div style="margin-top:14px; display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
            <button class="btn btn-sm btn-primary" onclick="app.closeModal(); app.showSingleMemberHistory('${m.memberID}')">Borrow History</button>
            <button class="btn btn-sm" style="border-color:#cbd5e1;" onclick="app.closeModal(); app.openEditMemberModal('${m.memberID}')">✏️ Edit</button>
            <button class="btn btn-sm btn-danger" onclick="app.closeModal(); app.openDeleteMemberConfirm('${m.memberID}')">Delete</button>
          </div>
        </div>
        <div>
          <h4 style="font-size:0.95rem; font-weight:700; margin-bottom:8px;">Recent Borrowing History</h4>
          <table class="custom-table">
            <thead><tr><th>Book Title</th><th>Due Date</th><th>Status</th></tr></thead>
            <tbody>
              ${myLoans.slice(0, 4).map(t => `
                <tr>
                  <td><strong>${t.bookTitle}</strong></td>
                  <td>${t.dueDate}</td>
                  <td><span class="badge ${t.status==='ISSUED'?'badge-warning':'badge-success'}">${t.status}</span></td>
                </tr>
              `).join('') || `<tr><td colspan="3" style="text-align:center;">No loan records.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; margin-top:20px;">
        <button class="btn btn-primary" onclick="app.closeModal()">Close Profile</button>
      </div>
    </div>
  `;
  modal.style.display = "grid";
};
