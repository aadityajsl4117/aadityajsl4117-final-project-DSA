LuminaLibrary.prototype.openFeedbackModal = function() {
  this.tempRating = 5;
  const modal = document.getElementById("app-modal");
  const dialog = document.getElementById("modal-content");

  dialog.innerHTML = `
    <div style="padding: 24px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
        <div>
          <h2 style="font-size:1.25rem; font-weight:800;">Library Patron Feedback Form</h2>
          <p style="font-size:0.8rem; color:var(--text-muted);">Your review helps improve book procurement and digital services</p>
        </div>
        <div id="modal-feedback-qr" style="background:#ffffff; padding:4px; border-radius:6px; border:1px solid var(--border-subtle);"></div>
      </div>

      <form onsubmit="app.handleFeedbackSubmit(event)">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="font-size:0.75rem; font-weight:700;">Patron Full Name</label>
            <input type="text" id="fbk-name" value="Aaditya Jaiswal" required style="width:100%; padding:8px; border:1px solid var(--border-strong); border-radius:4px; font-family:var(--font-main);">
          </div>
          <div>
            <label style="font-size:0.75rem; font-weight:700;">Feedback Category</label>
            <select id="fbk-category" style="width:100%; padding:8px; border:1px solid var(--border-strong); border-radius:4px; font-family:var(--font-main);">
              <option value="Resources & Books">Resources & Books</option>
              <option value="Facilities & Seating">Facilities & Seating</option>
              <option value="Staff & Desk Service">Staff & Desk Service</option>
              <option value="Digital Portal & AI">Digital Portal & AI</option>
            </select>
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:0.75rem; font-weight:700; display:block; margin-bottom:4px;">Star Rating (1 to 5 Stars)</label>
          <div class="star-rating-box" id="feedback-star-selector">
            <span class="star active" onclick="app.setStarRating(1)">★</span>
            <span class="star active" onclick="app.setStarRating(2)">★</span>
            <span class="star active" onclick="app.setStarRating(3)">★</span>
            <span class="star active" onclick="app.setStarRating(4)">★</span>
            <span class="star active" onclick="app.setStarRating(5)">★</span>
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <label style="font-size:0.75rem; font-weight:700;">Comments & Improvement Suggestions</label>
          <textarea id="fbk-comments" rows="3" placeholder="Share your experience regarding quietness, title availability, reading desk light..." required style="width:100%; padding:8px; border:1px solid var(--border-strong); border-radius:4px; font-family:var(--font-main);"></textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn" onclick="app.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Submit Feedback to Admin</button>
        </div>
      </form>
    </div>
  `;

  setTimeout(() => {
    if (typeof QRCode !== "undefined") {
      const el = document.getElementById("modal-feedback-qr");
      if (el) {
        el.innerHTML = "";
        new QRCode(el, { text: window.location.href + "#feedback", width: 50, height: 50 });
      }
    }
  }, 50);

  modal.style.display = "grid";
};

LuminaLibrary.prototype.setStarRating = function(rating) {
  this.tempRating = rating;
  const stars = document.querySelectorAll("#feedback-star-selector .star");
  stars.forEach((s, idx) => {
    if (idx < rating) s.classList.add("active");
    else s.classList.remove("active");
  });
};

LuminaLibrary.prototype.handleFeedbackSubmit = async function(e) {
  e.preventDefault();
  const userName = document.getElementById("fbk-name").value.trim();
  const category = document.getElementById("fbk-category").value;
  const comments = document.getElementById("fbk-comments").value.trim();

  try {
    if (window.LuminaAPI) {
      await window.LuminaAPI.submitFeedback({ userName, category, rating: this.tempRating, comments });
      this.showToast(`Feedback of ${this.tempRating} Stars recorded (Saved in DB). Thank you!`);
      this.closeModal();
      await this.loadState();
      return;
    }
  } catch (err) {
    this.showToast(err.message || "Failed to submit feedback in database", true);
    return;
  }

  // Fallback
  const now = new Date();
  const timestamp = now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) + ' ' + now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  const newFeedback = {
    feedbackID: `FBK-${Math.floor(100 + Math.random()*900)}`,
    userName,
    category,
    rating: this.tempRating,
    comments,
    timestamp
  };
  this.feedbacks.unshift(newFeedback);
  this.showToast(`Feedback of ${this.tempRating} Stars recorded. Thank you!`);
  this.closeModal();
  this.saveState();
  this.render();
};
