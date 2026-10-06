LuminaLibrary.prototype.renderReviewStars = function(rating) {
  let starsHtml = "";
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      starsHtml += '<span class="star active" style="color:var(--warning);">★</span>';
    } else {
      starsHtml += '<span class="star" style="color:var(--text-subtle);">★</span>';
    }
  }
  return starsHtml;
};
