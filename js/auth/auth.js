class LuminaAuth {
  constructor() {
    this.SESSION_KEY = "lumina_auth_session";
    this.TOKEN_KEY = "lumina_jwt_token";
  }

  static init() {
    window.auth = new LuminaAuth();
    window.auth.checkSession();
  }

  checkSession() {
    const sessionRaw = localStorage.getItem(this.SESSION_KEY);
    const token = localStorage.getItem(this.TOKEN_KEY);
    const loginOverlay = document.getElementById("login-screen");
    const appContainer = document.querySelector(".app-container");

    if (sessionRaw && token) {
      try {
        const session = JSON.parse(sessionRaw);
        if (session && session.user) {
          if (loginOverlay) loginOverlay.style.display = "none";
          if (appContainer) appContainer.style.display = "flex";
          return true;
        }
      } catch (e) {
        console.warn("Invalid auth session format:", e);
      }
    }

    if (loginOverlay) loginOverlay.style.display = "flex";
    if (appContainer) appContainer.style.display = "none";
    return false;
  }

  async handleLogin(e) {
    if (e) e.preventDefault();
    const userInput = document.getElementById("auth-username");
    const passInput = document.getElementById("auth-password");
    const errorBox = document.getElementById("auth-error");

    const username = userInput ? userInput.value.trim() : "";
    const password = passInput ? passInput.value : "";

    if (!username || !password) {
      if (errorBox) {
        errorBox.textContent = "Please enter both username/email and password.";
        errorBox.style.display = "block";
      }
      return false;
    }

    try {
      if (!window.LuminaAPI) {
        throw new Error("Lumina API Client is not initialized.");
      }

      const res = await window.LuminaAPI.login(username, password);

      if (res && res.success) {
        if (errorBox) errorBox.style.display = "none";
        const sessionData = {
          user: res.user ? res.user.username : username,
          role: res.user ? res.user.role : 'ADMIN',
          loginTime: new Date().toISOString()
        };

        if (res.token) {
          localStorage.setItem(this.TOKEN_KEY, res.token);
        } else {
          localStorage.setItem(this.TOKEN_KEY, `token_${Date.now()}`);
        }
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
        
        const loginOverlay = document.getElementById("login-screen");
        const appContainer = document.querySelector(".app-container");
        if (loginOverlay) loginOverlay.style.display = "none";
        if (appContainer) appContainer.style.display = "flex";

        if (window.app && typeof window.app.loadState === "function") {
          await window.app.loadState();
        }
        return true;
      } else {
        throw new Error(res.error || "Invalid login credentials.");
      }
    } catch (err) {
      if (errorBox) {
        errorBox.textContent = err.message || "Invalid credentials! Please try again.";
        errorBox.style.display = "block";
      }
      return false;
    }
  }

  togglePassword() {
    const passInput = document.getElementById("auth-password");
    const toggleBtn = document.getElementById("auth-toggle-btn");
    if (!passInput) return;

    if (passInput.type === "password") {
      passInput.type = "text";
      if (toggleBtn) toggleBtn.textContent = "👁️";
    } else {
      passInput.type = "password";
      if (toggleBtn) toggleBtn.textContent = "🙈";
    }
  }

  logout() {
    let logoutCall = null;
    if (window.LuminaAPI && typeof window.LuminaAPI.logout === "function") {
      logoutCall = window.LuminaAPI.logout().catch(() => {}); // sent while the token is still attached
    }
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.TOKEN_KEY);

    const loginOverlay = document.getElementById("login-screen");
    const appContainer = document.querySelector(".app-container");
    if (loginOverlay) loginOverlay.style.display = "flex";
    if (appContainer) appContainer.style.display = "none";

    const passInput = document.getElementById("auth-password");
    if (passInput) passInput.value = "";
    const errorBox = document.getElementById("auth-error");
    if (errorBox) errorBox.style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  LuminaAuth.init();
});
