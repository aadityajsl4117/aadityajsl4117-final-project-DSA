/* BIOMETRIC WEBCAM CAMERA SERVICE */
LuminaLibrary.prototype.startLiveCamera = async function(videoElemID) {
  const video = document.getElementById(videoElemID);
  const status = document.getElementById("face-captured-status");
  if (!video) return;

  if (this.currentStream) {
    try { this.currentStream.getTracks().forEach(t => t.stop()); } catch(e){}
    this.currentStream = null;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (status) {
      status.innerText = "Camera requires HTTPS or localhost ❌";
      status.style.color = "var(--danger)";
    }
    return;
  }

  try {
    if (status) {
      status.innerText = "Requesting camera permission... ⏳";
      status.style.color = "var(--warning)";
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });

    this.currentStream = stream;
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    
    await video.play().catch(e => console.warn("Video play exception:", e));

    if (status) {
      status.innerText = "📷 Live camera active — Ready to Snap";
      status.style.color = "var(--success)";
    }
  } catch (err) {
    console.warn("Camera access denied or failed:", err);
    if (status) {
      status.innerText = "Camera permission denied ❌ (Allow access in settings)";
      status.style.color = "var(--danger)";
    }
  }
};

LuminaLibrary.prototype.captureFacePhoto = function(e) {
  if (e) {
    try { e.preventDefault(); e.stopPropagation(); } catch(err){}
  }

  const video = document.getElementById("live-camera-feed");
  const previewImg = document.getElementById("captured-face-preview");
  const status = document.getElementById("face-captured-status");
  const photoInput = document.getElementById("m-photo-data");

  if (!video) {
    if (status) {
      status.innerText = "Camera element missing ❌";
      status.style.color = "var(--danger)";
    }
    return;
  }

  if (!this.currentStream || !video.srcObject) {
    if (status) {
      status.innerText = "Camera not active ❌ (Allow camera access first)";
      status.style.color = "var(--danger)";
    }
    this.showToast("Camera stream is not active. Please allow camera permission first.", true);
    return;
  }

  if (video.readyState < 2) {
    if (status) {
      status.innerText = "Camera is still loading... ⏳";
      status.style.color = "var(--warning)";
    }
    this.showToast("Camera feed is still loading...", true);
    return;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const photoData = canvas.toDataURL("image/jpeg", 0.9);

    if (photoInput) photoInput.value = photoData;

    // Stop camera stream after real frame capture
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }

    // Display actual captured photo in preview
    video.style.display = "none";
    if (previewImg) {
      previewImg.src = photoData;
      previewImg.style.display = "block";
    }

    if (status) {
      status.innerText = "Face Biometric Captured ✅";
      status.style.color = "var(--success)";
    }

    this.showToast("Face Biometric Captured successfully!");
  } catch (err) {
    console.error("Frame capture error:", err);
    if (status) {
      status.innerText = "Frame capture failed ❌";
      status.style.color = "var(--danger)";
    }
  }
};
