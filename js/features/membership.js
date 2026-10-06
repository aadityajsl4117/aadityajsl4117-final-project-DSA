/* MEMBERSHIP & PATRON MANAGEMENT FEATURE MODULE */
LuminaLibrary.prototype.renderMembership = function() {
  return `
    <div class="page-title-row">
      <div>
        <h1 class="page-heading">Membership Directory & Patron Management</h1>
        <p class="page-subtext">Manage campus members, biometric verification, complete borrow logs, and profile records</p>
      </div>
      <button class="btn btn-primary" onclick="app.openModal('add-member')">+ Register Biometric Member</button>
    </div>

    <div class="content-card">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Member ID</th>
            <th>Full Name</th>
            <th>Role / Department</th>
            <th>Email Address</th>
            <th>Phone</th>
            <th>Registration Date</th>
            <th>Management Actions</th>
          </tr>
        </thead>
        <tbody>
          ${this.members.map(m => `
            <tr>
              <td><code>${m.displayID || m.memberID}</code></td>
              <td><strong>${m.name}</strong></td>
              <td>
                <span class="badge ${m.userType==='TEACHER'?'badge-primary':(m.userType==='EXTERNAL'?'badge-purple':'badge-muted')}">${m.userType}</span>
                <br><small style="color:var(--text-muted);">${m.department}</small>
              </td>
              <td><strong style="color:var(--accent);">${m.email}</strong></td>
              <td>${m.phone}</td>
              <td>${m.joined}</td>
              <td>
                <div style="display:flex; gap:5px; flex-wrap:wrap;">
                  <button class="btn btn-sm btn-primary" onclick="app.showMemberTrackingDetails('${m.memberID}')">Profile</button>
                  <button class="btn btn-sm" onclick="app.showSingleMemberHistory('${m.memberID}')">Borrow History</button>
                  <button class="btn btn-sm" style="border-color:#cbd5e1;" onclick="app.openEditMemberModal('${m.memberID}')">✏️ Edit</button>
                  <button class="btn btn-sm btn-danger" onclick="app.openDeleteMemberConfirm('${m.memberID}')">Delete</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
};

LuminaLibrary.prototype.handleAddMemberForm = async function(e) {
  e.preventDefault();
  const userType = document.getElementById("nm-type").value;
  const name = document.getElementById("nm-name").value.trim();
  const email = document.getElementById("nm-email").value.trim();
  const phone = document.getElementById("nm-phone").value.trim();
  const department = document.getElementById("nm-dept").value.trim();
  const photoElem = document.getElementById("m-photo-data");
  let photo = photoElem ? photoElem.value : "";

  if (!photo || !photo.startsWith("data:image/")) {
    photo = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80";
  }

  try {
    if (window.LuminaAPI) {
      const res = await window.LuminaAPI.addMember({ name, email, phone, userType, department, photo });
      this.showToast(`Enrolled ${name} successfully (Saved in DB)!`);
      this.sendLibraryEmail({
        member: { name, email },
        subject: "Welcome to Lumina Digital Campus System",
        message: `Dear ${name},\n\nYour biometric membership account has been enrolled under ${userType} role (${department}).\n\nWelcome to Lumina Library System!`,
        status: "REGISTRATION"
      });
      this.closeModal();
      await this.loadState();
      return;
    }
  } catch (err) {
    this.showToast(err.message || "Failed to register member in database", true);
    return;
  }

  // Fallback
  const id = document.getElementById("nm-id") ? document.getElementById("nm-id").value : `MEM-${Math.floor(1000+Math.random()*9000)}`;
  const newMember = {
    memberID: id,
    displayID: id,
    name,
    userType,
    email,
    phone,
    department,
    borrowLimit: userType === 'TEACHER' ? 8 : (userType === 'STUDENT' ? 5 : 2),
    status: "ACTIVE",
    photo: photo,
    joined: this.todayStr
  };
  this.members.push(newMember);
  this.showToast(`Enrolled ${name} successfully!`);
  this.closeModal();
  this.saveState();
  this.render();
};

LuminaLibrary.prototype.openEditMemberModal = function(memberID) {
  const m = this.findMember(memberID);
  if (!m) return;

  const modal = document.getElementById("app-modal");
  const dialog = document.getElementById("modal-content");

  dialog.innerHTML = `
    <div style="padding: 24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h2 style="font-size:1.25rem; font-weight:800;">Edit Member Profile: ${m.name}</h2>
        <span class="badge badge-primary">${m.displayID || m.memberID}</span>
      </div>

      <form onsubmit="app.handleUpdateMemberProfile(event, '${m.memberID}')">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px;">
          <div>
            <label style="font-size:0.75rem; font-weight:700;">Full Legal Name</label>
            <input type="text" id="edit-m-name" value="${m.name}" required style="width:100%; padding:8px; border:1px solid var(--border-strong); border-radius:4px; font-family:var(--font-main);">
          </div>
          <div>
            <label style="font-size:0.75rem; font-weight:700;">Email Address</label>
            <input type="email" id="edit-m-email" value="${m.email}" required style="width:100%; padding:8px; border:1px solid var(--border-strong); border-radius:4px; font-family:var(--font-main);">
          </div>
          <div>
            <label style="font-size:0.75rem; font-weight:700;">Phone Number</label>
            <input type="text" id="edit-m-phone" value="${m.phone}" required style="width:100%; padding:8px; border:1px solid var(--border-strong); border-radius:4px; font-family:var(--font-main);">
          </div>
          <div>
            <label style="font-size:0.75rem; font-weight:700;">Role / User Type</label>
            <select id="edit-m-type" style="width:100%; padding:8px; border:1px solid var(--border-strong); border-radius:4px; font-family:var(--font-main);">
              <option value="STUDENT" ${m.userType==='STUDENT'?'selected':''}>Student (Max 5 Loans)</option>
              <option value="TEACHER" ${m.userType==='TEACHER'?'selected':''}>Teacher (Max 8 Loans)</option>
              <option value="EXTERNAL" ${m.userType==='EXTERNAL'?'selected':''}>External Visitor (Max 2 Loans)</option>
            </select>
          </div>
          <div style="grid-column:span 2;">
            <label style="font-size:0.75rem; font-weight:700;">Department / Organization</label>
            <input type="text" id="edit-m-dept" value="${m.department}" required style="width:100%; padding:8px; border:1px solid var(--border-strong); border-radius:4px; font-family:var(--font-main);">
          </div>
          <div style="grid-column:span 2;">
            <label style="font-size:0.75rem; font-weight:700;">Campus / Residential Address</label>
            <input type="text" id="edit-m-address" value="${m.address || ''}" style="width:100%; padding:8px; border:1px solid var(--border-strong); border-radius:4px; font-family:var(--font-main);">
          </div>
        </div>

        <div style="background:var(--bg-card-subtle); padding:12px; border-radius:var(--radius-sm); font-size:0.8rem; margin-bottom:16px;">
          💡 <em>Any modification will be permanently logged to the Master Audit History with old and new values.</em>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn" onclick="app.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes & Log Audit</button>
        </div>
      </form>
    </div>
  `;
  modal.style.display = "grid";
};

LuminaLibrary.prototype.handleUpdateMemberProfile = async function(e, memberID) {
  e.preventDefault();
  const m = this.findMember(memberID);
  if (!m) return;

  const newName = document.getElementById("edit-m-name").value.trim();
  const newEmail = document.getElementById("edit-m-email").value.trim();
  const newPhone = document.getElementById("edit-m-phone").value.trim();
  const newType = document.getElementById("edit-m-type").value;
  const newDept = document.getElementById("edit-m-dept").value.trim();
  const newAddr = document.getElementById("edit-m-address").value.trim();

  const oldValuesStr = `Name: ${m.name}, Email: ${m.email}, Role: ${m.userType}, Dept: ${m.department}`;
  const newValuesStr = `Name: ${newName}, Email: ${newEmail}, Role: ${newType}, Dept: ${newDept}`;

  // Persist through the REST API; the server writes the field-level old/new audit entry itself
  if (window.LuminaAPI && typeof window.LuminaAPI.updateMember === "function") {
    try {
      await window.LuminaAPI.updateMember(memberID, { name: newName, email: newEmail, phone: newPhone, userType: newType, department: newDept });
      this.showToast(`Member profile for ${newName} updated & logged!`);
      this.closeModal();
      await this.loadState();
      return;
    } catch (err) {
      this.showToast(err.message || "Failed to update member in database", true);
      return;
    }
  }

  m.name = newName;
  m.email = newEmail;
  m.phone = newPhone;
  m.userType = newType;
  m.department = newDept;
  m.address = newAddr;
  m.borrowLimit = newType === 'TEACHER' ? 8 : (newType === 'STUDENT' ? 5 : 2);

  this.logHistory("EDIT_MEMBER", "MEMBERSHIP", {
    memberID: m.memberID,
    memberName: m.name,
    description: `Admin updated profile for member ${m.memberID}.`,
    oldValue: oldValuesStr,
    newValue: newValuesStr
  });

  this.showToast(`Member profile for ${m.name} updated & logged!`);
  this.closeModal();
  this.saveState();
  this.render();
};

LuminaLibrary.prototype.openDeleteMemberConfirm = function(memberID) {
  const m = this.findMember(memberID);
  if (!m) return;

  const memberTxns = this.transactionList.toArray().filter(t => t.memberID === memberID);
  const activeLoans = memberTxns.filter(t => t.status === "ISSUED");
  const unpaidFines = memberTxns.filter(t => t.paymentStatus === "UNPAID" && Number(t.fineAmount) > 0);
  const heldDeposits = (this.deposits || []).filter(d => d.memberID === memberID && (d.status === "HELD" || d.status === "ACTIVE"));
  const blockerList = [];
  if (activeLoans.length) blockerList.push(`${activeLoans.length} active borrowed book(s) — process the return first (Borrow / Return page)`);
  if (unpaidFines.length) blockerList.push(`an unpaid fine of ₹${unpaidFines.reduce((a, t) => a + Number(t.fineAmount), 0).toFixed(2)} — settle it first (Payments page)`);
  if (heldDeposits.length) blockerList.push(`a held security deposit — process the refund first (Deposits page)`);

  const modal = document.getElementById("app-modal");
  const dialog = document.getElementById("modal-content");

  dialog.innerHTML = `
    <div style="padding: 24px;">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px; color:var(--danger);">
        <span style="font-size:1.8rem;">⚠️</span>
        <h2 style="font-size:1.3rem; font-weight:800;">Confirm Member Account Deletion</h2>
      </div>

      <p style="font-size:0.875rem; color:var(--text-body); line-height:1.6; margin-bottom:16px;">
        You are about to permanently delete <strong>${m.name}</strong> (Member ID: <code>${m.displayID || m.memberID}</code>).
      </p>

      ${blockerList.length > 0 ? `
        <div style="background:var(--danger-bg); border:1px solid #fca5a5; padding:14px; border-radius:var(--radius-sm); margin-bottom:16px;">
          <strong style="color:var(--danger);">Member cannot be deleted yet. Resolve this first:</strong>
          <ul style="font-size:0.8rem; color:#991b1b; margin:6px 0 0 18px;">
            ${blockerList.map(b => `<li>${b}</li>`).join('')}
          </ul>
        </div>
        <div style="display:flex; justify-content:flex-end;">
          <button class="btn btn-primary" onclick="app.closeModal()">Close</button>
        </div>
      ` : `
        <div style="background:var(--bg-card-subtle); border:1px solid var(--border-subtle); padding:14px; border-radius:var(--radius-sm); font-size:0.82rem; margin-bottom:20px;">
          <div><strong>Email:</strong> ${m.email}</div>
          <div><strong>Department:</strong> ${m.department}</div>
          <div><strong>User Type:</strong> ${m.userType}</div>
          <div style="margin-top:6px; color:var(--danger); font-weight:600;">This permanently deletes the member from the database. The action is recorded in Master Audit history.</div>
        </div>

        <div id="delete-member-error" style="display:none; background:var(--danger-bg); border:1px solid #fca5a5; color:#991b1b; padding:12px; border-radius:var(--radius-sm); font-size:0.82rem; margin-bottom:14px;"></div>
        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button class="btn" onclick="app.closeModal()">Cancel</button>
          <button id="confirm-delete-member-btn" class="btn btn-danger" onclick="app.executeDeleteMember('${m.memberID}')">Yes, Delete Member</button>
        </div>
      `}
    </div>
  `;
  modal.style.display = "grid";
};

LuminaLibrary.prototype.executeDeleteMember = async function(memberID) {
  const m = this.findMember(memberID);
  if (!m) return;

  const confirmBtn = document.getElementById("confirm-delete-member-btn");
  const showError = (msg) => {
    const box = document.getElementById("delete-member-error");
    if (box) { box.textContent = msg; box.style.display = "block"; }
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = "Yes, Delete Member"; }
    this.showToast(msg, true);
  };

  // Deleting is ONLY done by the backend/database. There is no browser-only deletion.
  if (!window.LuminaAPI || typeof window.LuminaAPI.deactivateMember !== "function") {
    showError("Cannot reach the database API, so nothing was deleted. Start the server with 'npm start' and open http://localhost:3000.");
    return;
  }
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = "Deleting..."; }

  try {
    const res = await window.LuminaAPI.deactivateMember(memberID);
    if (!res || res.success !== true || res.verified !== true) {
      throw new Error("The server did not confirm the deletion. Restart the server using the latest files (npm start) and try again.");
    }
    // Double-check with the database: the member must no longer exist
    let stillExists = false;
    try { await window.LuminaAPI.request(`/members/${memberID}`); stillExists = true; } catch (e) { stillExists = !(e && e.status === 404); }
    if (stillExists) throw new Error("The member still exists in the database, so the deletion was not completed.");
  } catch (err) {
    let msg = err.message || "Failed to delete member.";
    try {
      const h = await window.LuminaAPI.request('/health');
      if (h && h.success && /did not confirm|not completed|still exists/i.test(msg)) {
        msg += ` Backend is reachable (server v${h.serverVersion || 'unknown'}).`;
      }
    } catch (healthErr) {
      msg = `${msg} The library backend health check is unavailable. Make sure the current Lumina server is running on port 3000.`;
    }
    showError(msg);
    await this.loadState();
    return;
  }

  // Remove any stale browser copy so a refresh or offline fallback cannot show the member again
  try {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (raw) {
      const cache = JSON.parse(raw);
      if (Array.isArray(cache.members)) {
        cache.members = cache.members.filter(x => x.memberID !== memberID);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cache));
      }
    }
  } catch (e) { /* cache is optional */ }

  this.closeModal();
  await this.loadState();
  this.showToast("Member deleted successfully");
};
