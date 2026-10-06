const API_BASE_URL = (() => {
    if (typeof window === 'undefined') return 'http://localhost:3000/api';
    return 'https://aadityajsl4117-final-project-dsa.onrender.com/api';
})();

class LuminaAPIClient {
  static getToken() {
    return localStorage.getItem('lumina_jwt_token') || '';
  }

  static async request(endpoint, options = {}) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };

      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
      });

      const data = await res.json();
      if (!res.ok) {
        const httpErr = new Error(data.error || `HTTP ${res.status} Error`);
        httpErr.status = res.status;
        httpErr.data = data; // lets callers show the server's own message (e.g. AI assistant)
        throw httpErr;
      }
      return data;
    } catch (err) {
      console.warn(`API Error [${endpoint}]:`, err.message);
      throw err;
    }
  }

  static async login(username, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  }

  static async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  static async getBootstrap() {
    return this.request('/bootstrap');
  }

  static async addBook(bookData) {
    return this.request('/books', {
      method: 'POST',
      body: JSON.stringify(bookData)
    });
  }

  static async updateBook(bookID, bookData) {
    return this.request(`/books/${bookID}`, {
      method: 'PUT',
      body: JSON.stringify(bookData)
    });
  }

  static async deleteBook(bookID) {
    return this.request(`/books/${bookID}`, {
      method: 'DELETE'
    });
  }

  static async addMember(memberData) {
    return this.request('/members', {
      method: 'POST',
      body: JSON.stringify(memberData)
    });
  }

  static async updateMember(memberID, memberData) {
    return this.request(`/members/${memberID}`, {
      method: 'PUT',
      body: JSON.stringify(memberData)
    });
  }

  static async deactivateMember(memberID) {
    return this.request(`/members/${memberID}`, {
      method: 'DELETE'
    });
  }

  static async issueBook(issueData) {
    return this.request('/circulation/issue', {
      method: 'POST',
      body: JSON.stringify(issueData)
    });
  }

  static async returnBook(returnData) {
    return this.request('/circulation/return', {
      method: 'POST',
      body: JSON.stringify(returnData)
    });
  }

  static async renewBook(renewData) {
    return this.request('/circulation/renew', {
      method: 'POST',
      body: JSON.stringify(renewData)
    });
  }

  static async settlePayment(paymentData) {
    return this.request('/payments/settle', {
      method: 'POST',
      body: JSON.stringify(paymentData)
    });
  }

  static async refundDeposit(depositID) {
    return this.request(`/deposits/${encodeURIComponent(depositID)}/refund`, {
      method: 'POST'
    });
  }

  static async joinWaitingList(waitlistData) {
    return this.request('/waiting-list', {
      method: 'POST',
      body: JSON.stringify(waitlistData)
    });
  }

  static async submitBookRequest(requestData) {
    return this.request('/book-requests', {
      method: 'POST',
      body: JSON.stringify(requestData)
    });
  }

  static async updateBookRequest(requestID, data) {
    return this.request(`/book-requests/${requestID}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  static async sendEmail(emailData) {
    return this.request('/emails/send', {
      method: 'POST',
      body: JSON.stringify(emailData)
    });
  }

  static async sendReminders() {
    return this.request('/reminders/send', { method: 'POST' });
  }

  static async getNotifications() {
    return this.request('/notifications');
  }

  static async markNotificationsRead() {
    return this.request('/notifications/read-all', { method: 'PUT' });
  }

  static async queryAI(query, context = {}) {
    return this.request('/ai/query', {
      method: 'POST',
      body: JSON.stringify({ query, context, sessionId: context && context.sessionId })
    });
  }

  static async confirmAIAction(sessionId, token, decision = 'confirm') {
    return this.request('/ai/confirm', {
      method: 'POST',
      body: JSON.stringify({ sessionId, token, decision })
    });
  }

  static async resetAI(sessionId) {
    return this.request('/ai/reset', { method: 'POST', body: JSON.stringify({ sessionId }) });
  }

  static async getAIStatus() {
    return this.request('/ai/status');
  }

  static async globalSearch(q) {
    return this.request(`/search?q=${encodeURIComponent(q)}`);
  }

  static async getAuditLogs() {
    return this.request('/audit-logs');
  }

  static auditQueryString(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'ALL') qs.set(k, v);
    });
    return qs.toString();
  }

  static async getAudit(params = {}) {
    return this.request(`/audit?${this.auditQueryString(params)}`);
  }

  static async recordAudit(entry) {
    return this.request('/audit', {
      method: 'POST',
      body: JSON.stringify(entry)
    });
  }

  static async exportAudit(params = {}) {
    const headers = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/audit/export?${this.auditQueryString(params)}`, { headers });
    if (!res.ok) throw new Error(`Export failed (HTTP ${res.status})`);
    return res.blob();
  }

  static async submitFeedback(feedbackData) {
    return this.request('/feedbacks', {
      method: 'POST',
      body: JSON.stringify(feedbackData)
    });
  }

  static async joinWaitingList(data) {
    return this.request('/waiting-list', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async cancelWaitingList(data) {
    return this.request('/waiting-list', {
      method: 'DELETE',
      body: JSON.stringify(data)
    });
  }

  static async serveWaitingList(data) {
    return this.request('/waiting-list/serve', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async getAnalytics() {
    return this.request('/analytics');
  }
}

window.LuminaAPI = LuminaAPIClient;
