// Cross-cutting concerns shared by every SchoolOS page: auth/session
// (was auth-bridge.js), the shell loader (fetches shell.html and injects
// it + this page's own <template id="page-body"> content), role-switcher
// state (persisted in localStorage so it survives a full page reload),
// and the modal system every page's own script builds on.
//
// Detection: a page with #loginForm is the sign-in page (index.html) —
// only the auth/login wiring runs. Every other page has #shell-root and
// gets the full shell mount + auth guard.
(function () {
  const API_BASE = 'http://localhost:3000';
  const TOKEN_KEY = 'schoolos_access_token';
  const REFRESH_KEY = 'schoolos_refresh_token';
  const USER_KEY = 'schoolos_user';
  const ROLE_KEY = 'schoolos_active_role';
  const SESSION_LABEL_KEY = 'schoolos_session_label';
  const TERM_LABEL_KEY = 'schoolos_term_label';

  const ROLE_MAP = {
    SUPER_ADMIN: 'superadmin', PROPRIETOR: 'proprietor', PRINCIPAL: 'principal',
    BURSAR: 'bursar', HR_ADMIN: 'hr', TEACHER: 'teacher', PARENT: 'parent',
    STUDENT: 'student', TRANSPORT_STAFF: 'operations', LIBRARY_STAFF: 'operations',
    OTHER_STAFF: 'operations', COMPLIANCE_ADMIN: 'compliance',
  };
  const ROLE_TITLES = {
    proprietor: 'Proprietor / Owner', principal: 'Principal', bursar: 'Bursar / Accountant',
    hr: 'HR / Administrator', teacher: 'Teacher', parent: 'Parent / Guardian', student: 'Student',
    operations: 'Transport / Library staff', superadmin: 'Super Admin', compliance: 'Compliance Administrator',
  };

  // Per-role nav item lists — identical to the original app.js `navs`
  // object. Item 0 is always "home" for that role and always resolves to
  // dashboard.html; everything else is looked up in SLUG_FILE_MAP.
  const navs = {
    proprietor: ['Dashboard', 'Schools / Campuses', 'Admissions', 'Students', 'Teachers', 'Academics', 'Content Approvals', 'Attendance', 'Fees & payments', 'Finance', 'People & payroll', 'Messages', 'Library', 'Reports', 'Settings'],
    principal: ['Dashboard', 'Admissions', 'Students', 'Academics', 'Lessons', 'Content Approvals', 'Attendance', 'Teachers', 'Timetable', 'Exams & Results', 'Fees', 'Finance', 'Payroll', 'Parents', 'Communication', 'Library', 'Reports', 'Settings'],
    bursar: ['Dashboard', 'Admissions', 'Students', 'Fees', 'Invoices', 'Payments', 'Arrears', 'Reconciliation', 'Expenses', 'Payroll', 'Reports'],
    hr: ['Dashboard', 'Admissions', 'Students', 'Employees', 'Attendance', 'Leave', 'Documents', 'Performance', 'Recruitment', 'Payroll', 'Reports'],
    teacher: ['Dashboard', 'My Classes', 'Lessons', 'Attendance', 'Results', 'Timetable', 'Assignments', 'CBT Exams', 'Messages', 'My Profile'],
    parent: ['Home', 'My Children', 'Lessons', 'Apply for admission', 'Fees', 'Results', 'Attendance', 'Timetable', 'Messages', 'More'],
    student: ['Home', 'Classes', 'Lessons', 'Timetable', 'Assignments', 'CBT Exams', 'Results', 'Attendance', 'Notices', 'Profile'],
    operations: ['Dashboard', 'Transport Routes', 'Vehicles & Drivers', 'Student Manifest', 'Incidents', 'Library', 'Reports'],
    superadmin: ['Platform Dashboard', 'Schools', 'Subscriptions', 'Users', 'Support', 'System Health', 'Integrations', 'Audit Logs', 'Feature Flags', 'Settings'],
    compliance: ['Dashboard', 'Statutory Rules', 'Compliance Review', 'Payroll Audit Trail', 'Reports'],
  };
  const icons = ['⌂', '◉', '▤', '✓', '₦', '▥', '♙', '✦', '◫', '⚙', '⌘'];
  const slug = (v) => v.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // Every nav-item slug (across every role, minus each role's item-0
  // "home" which is hardcoded to dashboard.html) mapped to the page file
  // that owns it. Files not yet built in this pass will 404 until a later
  // split step creates them — see the module-split status doc.
  const SLUG_FILE_MAP = {
    students: 'students.html', admissions: 'students.html#admissions',
    academics: 'academics.html', teachers: 'academics.html#teachers', 'content-approvals': 'academics.html#content-approvals',
    lessons: 'academics.html#lessons', timetable: 'academics.html#timetable', 'exams-and-results': 'academics.html#results',
    results: 'academics.html#results', assignments: 'academics.html#assignments', 'cbt-exams': 'academics.html#cbt-exams',
    'my-classes': 'academics.html#my-classes', 'my-profile': 'academics.html', classes: 'academics.html#classes',
    notices: 'academics.html#notices', profile: 'academics.html#profile',
    attendance: 'attendance.html',
    fees: 'fees.html', 'fees-and-payments': 'fees.html', 'my-children': 'fees.html#my-children',
    'apply-for-admission': 'students.html#admissions', invoices: 'fees.html#invoices', payments: 'fees.html#payments',
    arrears: 'fees.html#arrears', reconciliation: 'fees.html#reconciliation', expenses: 'fees.html#expenses',
    finance: 'finance.html',
    'people-and-payroll': 'people.html', payroll: 'people.html', employees: 'people.html#employees',
    leave: 'people.html#leave', documents: 'people.html#documents', performance: 'people.html#performance',
    recruitment: 'people.html#recruitment', 'payroll-audit-trail': 'people.html#payroll-audit-trail', 'statutory-rules': 'people.html#statutory-rules',
    'compliance-review': 'people.html#compliance-review',
    messages: 'messages.html', communication: 'messages.html', parents: 'messages.html',
    reports: 'reports.html',
    settings: 'settings.html', 'schools-campuses': 'settings.html#schools',
    library: 'operations.html', 'transport-routes': 'operations.html#transport-routes',
    'vehicles-and-drivers': 'operations.html#vehicles-and-drivers', 'student-manifest': 'operations.html#student-manifest', incidents: 'operations.html#incidents',
    schools: 'platform.html#schools', subscriptions: 'platform.html#subscriptions', users: 'platform.html#users',
    support: 'platform.html#support', 'system-health': 'platform.html#system-health', integrations: 'platform.html#integrations',
    'audit-logs': 'platform.html#audit-logs', 'feature-flags': 'platform.html#feature-flags',
    more: 'dashboard.html',
  };
  function fileForSlug(s) { return SLUG_FILE_MAP[s] || 'dashboard.html'; }

  // ---- generic mock-page renderer ----
  // Backs every nav item that has no dedicated module/data source yet
  // (Finance, Employees, Leave, Invoices, all SuperAdmin/Compliance/
  // Transport pages, etc.) — an honest "Coming soon" empty state rather
  // than fabricated KPI numbers and rows. Nothing here should ever look
  // like real data.
  function renderGenericPage(label) {
    const id = slug(label);
    return `<section class="page workspace-page visible" id="${id}"><div class="page-heading"><div><p class="eyebrow">Not built yet</p><h1>${label}</h1><p class="subtitle">No backend module exists for this yet — this isn't showing you fake data.</p></div></div><section class="data-card"><div class="empty-state"><span class="mini-avatar">✓</span><h3>Coming soon</h3><p>${label} hasn't been built on the backend yet (see CLAUDE.md's Phase 2+ scope). When it is, this page will show real data instead.</p></div></section></section>`;
  }

  // ---- auth core (was auth-bridge.js) ----
  function getAccessToken() { return localStorage.getItem(TOKEN_KEY); }
  function getRefreshToken() { return localStorage.getItem(REFRESH_KEY); }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
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
    localStorage.removeItem(ROLE_KEY);
  }
  async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) { clearSession(); return false; }
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    return true;
  }
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
      clearSession();
      location.href = 'index.html';
      throw new Error('Your session expired — please sign in again.');
    }
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      } catch { /* non-JSON error body */ }
      throw new Error(message);
    }
    if (res.status === 204) return null;
    return res.json();
  }
  function logout() { clearSession(); location.href = 'index.html'; }

  function getActiveRole() {
    const stored = localStorage.getItem(ROLE_KEY);
    if (stored && navs[stored]) return stored;
    const user = getUser();
    return (user && ROLE_MAP[user.role]) || 'proprietor';
  }
  function setActiveRole(role) { localStorage.setItem(ROLE_KEY, role); }

  function money(n) { return '₦' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function initialsOf(n) { return n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase(); }

  // ---- modal system ----
  function toast(text) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.append(el); }
    el.textContent = text; el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2400);
  }
  function openModal(html) {
    document.getElementById('modalBox').innerHTML = `<button class="modal-close" data-modal-close>✕</button>${html}`;
    document.getElementById('modalOverlay').style.display = 'flex';
  }
  function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('modalBox').innerHTML = '';
  }
  function fieldHtml(f) {
    if (f.type === 'select') return `<div class="form-field"><label>${f.label}</label><select name="${f.name}">${f.options.map((o) => `<option>${o}</option>`).join('')}</select></div>`;
    if (f.type === 'textarea') return `<div class="form-field"><label>${f.label}</label><textarea name="${f.name}" placeholder="${f.placeholder || ''}"></textarea></div>`;
    if (f.type === 'checkboxes') return `<div class="form-field"><label>${f.label}</label><div class="checkbox-group">${f.options.length ? f.options.map((o) => `<label class="checkbox-option"><input type="checkbox" name="${f.name}" value="${o.value}">${o.label}</label>`).join('') : '<p class="modal-sub" style="margin:0">None yet.</p>'}</div></div>`;
    return `<div class="form-field"><label>${f.label}</label><input name="${f.name}" type="${f.type || 'text'}" placeholder="${f.placeholder || ''}" value="${f.value || ''}"></div>`;
  }
  function formModal({ eyebrow, title, sub, fields, submitLabel, onSubmit }) {
    window.__formSubmit = (e) => {
      e.preventDefault();
      const data = {};
      new FormData(e.target).forEach((v, k) => { data[k] = k in data ? [].concat(data[k], v) : v; });
      onSubmit(data); closeModal();
    };
    openModal(`<p class="eyebrow">${eyebrow}</p><h2>${title}</h2>${sub ? `<p class="modal-sub">${sub}</p>` : ''}<form onsubmit="__formSubmit(event)">${fields.map(fieldHtml).join('')}<div class="modal-upload">📎 Attach a file (optional, demo only)</div><div class="form-actions"><button type="button" class="outline-button" data-modal-close>Cancel</button><button type="submit" class="new-button">${submitLabel}</button></div></form>`);
  }
  function detailModal({ eyebrow, title, sub, rows, footer }) {
    openModal(`<p class="eyebrow">${eyebrow}</p><h2>${title}</h2>${sub ? `<p class="modal-sub">${sub}</p>` : ''}<div class="modal-detail">${rows.map((r) => `<div class="modal-detail-row"><span>${r[0]}</span><strong>${r[1]}</strong></div>`).join('')}</div>${footer || '<div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>'}`);
  }

  // ---- nav rendering ----
  // Some static servers (e.g. `serve`'s clean-URL mode) redirect
  // dashboard.html -> /dashboard, stripping the extension. Normalize it
  // back so active-link matching keeps working either way.
  function currentFile() {
    const last = location.pathname.split('/').pop();
    if (!last) return 'dashboard.html';
    return last.includes('.') ? last : last + '.html';
  }
  function renderNav(role) {
    const nav = document.getElementById('mainNav');
    if (!nav) return;
    const items = navs[role] || navs.proprietor;
    const here = currentFile();
    nav.innerHTML = `<p class="nav-label">${ROLE_TITLES[role]} workspace</p>` + items.map((item, i) => {
      const file = i === 0 ? 'dashboard.html' : fileForSlug(slug(item));
      const active = file.split('#')[0] === here;
      return `<a class="nav-link ${active ? 'active' : ''}" href="${file}"><span>${icons[i % icons.length]}</span>${item}${item === 'Fees & payments' ? '<b>38</b>' : ''}</a>`;
    }).join('');
    const mobileNav = document.getElementById('mobileBottomNav');
    if (mobileNav) {
      const mobile = role === 'parent' || role === 'student';
      mobileNav.innerHTML = mobile ? items.slice(0, 5).map((item, i) => {
        const file = i === 0 ? 'dashboard.html' : fileForSlug(slug(item));
        return `<a class="${file.split('#')[0] === here ? 'active' : ''}" href="${file}"><span>${icons[i]}</span>${item}</a>`;
      }).join('') : '';
    }
  }

  function populateRoleSelect(role) {
    const select = document.getElementById('roleSelect');
    if (!select) return;
    select.innerHTML = Object.entries(ROLE_TITLES).map(([k, title]) => `<option value="${k}">${title}</option>`).join('');
    select.value = role;
    select.addEventListener('change', () => {
      setActiveRole(select.value);
      renderNav(select.value);
      if (typeof window.SchoolOS.onRoleChange === 'function') window.SchoolOS.onRoleChange(select.value);
    });
  }

  // ---- shell mount (module pages only) ----
  async function mountShell() {
    const shellRoot = document.getElementById('shell-root');
    if (!shellRoot) return null;

    if (!getAccessToken() || !getUser()) { location.href = 'index.html'; return null; }

    const html = await fetch('shell.html').then((r) => {
      if (!r.ok) throw new Error('shell.html ' + r.status);
      return r.text();
    });
    shellRoot.innerHTML = html;

    const pageBodyTpl = document.getElementById('page-body');
    const pageSlot = document.getElementById('page-slot');
    if (pageBodyTpl && pageSlot) pageSlot.appendChild(pageBodyTpl.content.cloneNode(true));

    const user = getUser();
    const role = getActiveRole();

    const badge = document.getElementById('sessionBadge');
    if (badge) badge.textContent = `${user.firstName} ${user.lastName} · ${user.role}`;
    const profileName = document.getElementById('profileName');
    if (profileName) profileName.textContent = `${user.firstName} ${user.lastName}`;
    const profileRole = document.getElementById('profileRole');
    if (profileRole) profileRole.textContent = ROLE_TITLES[role] || user.role;
    const profileInitials = document.getElementById('profileInitials');
    if (profileInitials) profileInitials.textContent = initialsOf(`${user.firstName} ${user.lastName}`);

    const yearBtn = document.getElementById('sessionYearBtn');
    if (yearBtn && yearBtn.firstChild) yearBtn.firstChild.textContent = (localStorage.getItem(SESSION_LABEL_KEY) || '2025/2026') + ' ';
    const termBtn = document.getElementById('sessionTermBtn');
    if (termBtn && termBtn.firstChild) termBtn.firstChild.textContent = (localStorage.getItem(TERM_LABEL_KEY) || 'Third term') + ' ';

    populateRoleSelect(role);
    renderNav(role);

    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    const newBtn = document.getElementById('newButton');
    if (newBtn) newBtn.addEventListener('click', () => {
      if (typeof window.SchoolOS.onCreateNew === 'function') window.SchoolOS.onCreateNew();
      else toast('Open a workspace page to create a matching record');
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-modal-close]') || e.target === document.getElementById('modalOverlay')) closeModal();
      const t = e.target.closest('[data-toast]'); if (t) toast(t.dataset.toast);
      const gp = e.target.closest('[data-goto-page]'); if (gp) location.href = fileForSlug(gp.dataset.gotoPage);
      const pc = e.target.closest('[data-pay-child]');
      if (pc) {
        if (typeof window.SchoolOS.onPayChild === 'function') window.SchoolOS.onPayChild(pc.dataset.payChild);
        else toast('Fees module isn’t split into its own page yet — coming soon');
      }
      const modal = e.target.closest('[data-modal]');
      if (modal) { const fn = (window.SchoolOS.modalOpeners || {})[modal.dataset.modal]; if (fn) fn(); }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    return role;
  }

  window.SchoolOS = {
    api, getUser, getAccessToken, logout, getActiveRole, setActiveRole,
    fileForSlug, slug, money, initialsOf, toast, openModal, closeModal, formModal, detailModal,
    renderGenericPage,
    onRoleChange: null, onCreateNew: null, onPayChild: null, modalOpeners: {},
    ready: null,
  };

  // ---- login page (index.html) ----
  function initLoginPage() {
    if (getAccessToken() && getUser()) { location.href = 'dashboard.html'; return; }

    const LOGIN_ROLE_TILES = {
      student: { emailPlaceholder: 'firstname.lastname@greenfield.test', hint: 'Student login — email and password issued when your record was created (password123 by default).' },
      teacher: { emailPlaceholder: 'firstname.lastname@greenfield.test', hint: 'Teacher login — email and password issued when your account was created (password123 by default).' },
      staff: { emailPlaceholder: 'bursar@greenfield.test', hint: 'Bursar, HR, librarian, transport and other operations staff.' },
      admin: { emailPlaceholder: 'proprietor@greenfield.test', hint: 'Proprietor and Principal accounts — full school oversight.' },
    };
    function selectLoginRole(roleKey) {
      const tile = LOGIN_ROLE_TILES[roleKey];
      if (!tile) return;
      document.querySelectorAll('.login-role-card').forEach((card) => card.classList.toggle('selected', card.dataset.role === roleKey));
      const emailInput = document.getElementById('loginEmail');
      if (emailInput) emailInput.placeholder = tile.emailPlaceholder;
      const hint = document.getElementById('loginHint');
      if (hint) hint.textContent = tile.hint;
    }
    document.querySelectorAll('.login-role-card').forEach((card) => card.addEventListener('click', () => selectLoginRole(card.dataset.role)));
    selectLoginRole('student');

    const form = document.getElementById('loginForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const btn = document.getElementById('loginSubmit');
      btn.disabled = true; btn.textContent = 'Signing in…';
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Login failed');
        setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken }, data.user);
        setActiveRole(ROLE_MAP[data.user.role] || 'proprietor');
        location.href = 'dashboard.html';
      } catch (err) {
        const errEl = document.getElementById('loginError');
        if (errEl) errEl.textContent = err.message;
        btn.disabled = false; btn.textContent = 'Sign in';
      }
    });
  }

  if (document.getElementById('loginForm')) {
    initLoginPage();
  } else {
    window.SchoolOS.ready = mountShell();
  }
})();
