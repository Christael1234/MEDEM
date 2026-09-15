// Bridges this static prototype to the real SchoolOS API. Loaded before
// app.js: sets up real auth (login/refresh/logout) and exposes window.SchoolOSApi
// for pages that fetch live data (see loadRealStudents() in app.js).
// Everything else in app.js remains the original mock UI: fees, finance,
// payroll and HR aren't built on the backend yet (see CLAUDE.md non-goals).
(function () {
  const API_BASE = 'http://localhost:3000';
  const TOKEN_KEY = 'schoolos_access_token';
  const REFRESH_KEY = 'schoolos_refresh_token';
  const USER_KEY = 'schoolos_user';

  const ROLE_MAP = {
    SUPER_ADMIN: 'superadmin',
    PROPRIETOR: 'proprietor',
    PRINCIPAL: 'principal',
    BURSAR: 'bursar',
    HR_ADMIN: 'hr',
    TEACHER: 'teacher',
    PARENT: 'parent',
    STUDENT: 'student',
    TRANSPORT_STAFF: 'operations',
    LIBRARY_STAFF: 'operations',
    OTHER_STAFF: 'operations',
    COMPLIANCE_ADMIN: 'compliance',
  };

  // Login-page role tiles. Purely a UX affordance: prefills the email
  // field and shows a hint; the account's real role (from the JWT) is
  // always what actually decides access, never the tile that was clicked.
  const LOGIN_ROLE_TILES = {
    student: {
      emailPlaceholder: 'firstname.lastname@greenfield.test',
      hint: 'Student login: email and password issued when your record was created (password123 by default).',
    },
    teacher: {
      emailPlaceholder: 'firstname.lastname@greenfield.test',
      hint: 'Teacher login: email and password issued when your account was created (password123 by default).',
    },
    staff: {
      emailPlaceholder: 'bursar@greenfield.test',
      hint: 'Bursar, HR, librarian, transport and other operations staff.',
    },
    admin: {
      emailPlaceholder: 'proprietor@greenfield.test',
      hint: 'Proprietor and Principal accounts: full school oversight.',
    },
  };

  function getAccessToken() {
    return localStorage.getItem(TOKEN_KEY);
  }
  function getRefreshToken() {
    return localStorage.getItem(REFRESH_KEY);
  }
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  }
  function setSession(tokens, user) {
    localStorage.setItem(TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearSession();
      return false;
    }
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    return true;
  }

  /** Authenticated fetch wrapper: attaches the access token, retries once
   * through a refresh on 401, and throws with the API's error message on
   * any other non-2xx response. */
  async function api(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let res = await fetch(`${API_BASE}${path}`, Object.assign({}, options, { headers }));

    if (res.status === 401 && getRefreshToken()) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        headers.Authorization = `Bearer ${getAccessToken()}`;
        res = await fetch(`${API_BASE}${path}`, Object.assign({}, options, { headers }));
      }
    }

    if (res.status === 401) {
      showLogin('Your session expired. Please sign in again.');
    }

    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      } catch {
        // ignore, non-JSON error body
      }
      throw new Error(message);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  function showLogin(message) {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.style.display = 'flex';
    const err = document.getElementById('loginError');
    if (err) err.textContent = message || '';
  }
  function hideLogin() {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  function applyLoggedInUser(user) {
    const badge = document.getElementById('sessionBadge');
    if (badge) badge.textContent = `${user.firstName} ${user.lastName} · ${user.role}`;

    const mapped = ROLE_MAP[user.role] || 'proprietor';
    const roleSelect = document.getElementById('roleSelect');
    if (roleSelect) roleSelect.value = mapped;
    // changeRole() already triggers loadRealStudents()/loadRealStudentPortalData()
    // internally, so nothing further needed here for that.
    if (typeof window.changeRole === 'function') window.changeRole(mapped);

    // changeRole() re-renders the Home page greeting from the mock persona
    // object (e.g. "Ada Okon" for every student), overwriting it with the
    // real logged-in user's name here.
    const greeting = document.getElementById('greeting');
    if (greeting) greeting.textContent = `Good morning, ${user.firstName}.`;
  }

  async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginSubmit');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken }, data.user);
      hideLogin();
      applyLoggedInUser(data.user);
    } catch (err) {
      showLogin(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  }

  function handleLogout() {
    clearSession();
    showLogin();
  }

  /** Clicking a role tile just steers the login form: prefills the email
   * placeholder and hint text for that role. It never bypasses auth. */
  function selectLoginRole(roleKey) {
    const tile = LOGIN_ROLE_TILES[roleKey];
    if (!tile) return;

    document.querySelectorAll('.login-role-card').forEach((card) => {
      card.classList.toggle('selected', card.dataset.role === roleKey);
    });

    const emailInput = document.getElementById('loginEmail');
    if (emailInput) emailInput.placeholder = tile.emailPlaceholder;
    const hint = document.getElementById('loginHint');
    if (hint) hint.textContent = tile.hint;
  }

  window.SchoolOSApi = { api, getUser, getAccessToken, logout: handleLogout };

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    if (form) form.addEventListener('submit', handleLogin);
    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    document.querySelectorAll('.login-role-card').forEach((card) => {
      card.addEventListener('click', () => selectLoginRole(card.dataset.role));
    });
    selectLoginRole('student');

    const user = getUser();
    if (user && getAccessToken()) {
      hideLogin();
      applyLoggedInUser(user);
    } else {
      showLogin();
    }
  });
})();
