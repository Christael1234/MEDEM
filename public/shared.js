// Cross-cutting concerns shared by every SchoolOS page: auth/session
// (was auth-bridge.js), the shell loader (fetches shell.html and injects
// it + this page's own <template id="page-body"> content), role-switcher
// state (persisted in localStorage so it survives a full page reload),
// and the modal system every page's own script builds on.
//
// Detection: a page with #loginForm is the sign-in page (index.html);
// only the auth/login wiring runs. Every other page has #shell-root and
// gets the full shell mount + auth guard.
(function () {
  // Local dev: frontend and API run on different ports (this file is
  // served from a plain static server, e.g. :5500, hitting the Nest app on
  // :3000). Deployed: the Nest app serves this file itself (see
  // ServeStaticModule in app.module.ts), same origin as the API, so a
  // relative base just works, and needs no CORS between them.
  const isLocalDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const API_BASE = isLocalDev ? 'http://localhost:3000' : '';
  const TOKEN_KEY = 'schoolos_access_token';
  const REFRESH_KEY = 'schoolos_refresh_token';
  const USER_KEY = 'schoolos_user';
  const ROLE_KEY = 'schoolos_active_role';
  const SIDEBAR_COLLAPSED_KEY = 'schoolos_sidebar_collapsed';
  const SESSION_LABEL_KEY = 'schoolos_session_label';
  const TERM_LABEL_KEY = 'schoolos_term_label';
  const BRAND_COLORS_KEY = 'schoolos_brand_colors';

  // Paint any previously-fetched branding immediately, before the shell
  // (or even the rest of this script) finishes loading: avoids a flash of
  // default green/copy on every page navigation, since this is a
  // multi-page app that remounts the shell from scratch each time — and
  // on the login pages, it's the only way a returning browser sees the
  // school's own colors/logo/copy before signing in (see applyBranding's
  // doc comment). mountShell() below still fetches the live values and
  // re-applies (and re-caches) them, this is just the instant-paint step.
  try {
    const cached = JSON.parse(localStorage.getItem(BRAND_COLORS_KEY) || 'null');
    if (cached) applyBranding(cached);
  } catch (err) { /* corrupt cache, ignore; mountShell's live fetch still applies real values */ }

  /** Applies both the CSS-variable colors (every page) and, where the
   * markup for it exists (the login pages only), the tenant's logo and
   * login copy. A brand-new visitor's browser has no cache and no tenant
   * context yet (this is a shared, multi-tenant login URL, not a
   * per-school subdomain) so they see the generic defaults until they
   * sign in once; after that, this tenant's branding is cached and
   * paints instantly on every future visit to either login page. */
  function applyBranding(b) {
    if (b.primaryColor) document.documentElement.style.setProperty('--brand-primary', b.primaryColor);
    if (b.sidebarColor) document.documentElement.style.setProperty('--brand-sidebar', b.sidebarColor);
    const headlineEl = document.getElementById('loginHeadline');
    if (headlineEl && b.loginHeadline) headlineEl.textContent = b.loginHeadline;
    const subtextEl = document.getElementById('loginSubtext');
    if (subtextEl && b.loginSubtext) subtextEl.textContent = b.loginSubtext;
    const markEl = document.getElementById('loginVisualMark');
    if (markEl && b.logoUrl) markEl.innerHTML = `<img src="${b.logoUrl}" alt="School logo">`;
    const nameEl = document.getElementById('schoolSwitcherName');
    if (nameEl && b.name) nameEl.textContent = b.name;
    const avatarEl = document.getElementById('schoolSwitcherAvatar');
    if (avatarEl && b.name) avatarEl.textContent = initialsOf(b.name);
  }

  async function refreshBrandColors() {
    let branding;
    try { branding = await api('/tenants/me/branding'); } catch (err) { return; }
    applyBranding(branding);
    localStorage.setItem(BRAND_COLORS_KEY, JSON.stringify({
      name: branding.name, primaryColor: branding.primaryColor, sidebarColor: branding.sidebarColor,
      logoUrl: branding.logoUrl, loginHeadline: branding.loginHeadline, loginSubtext: branding.loginSubtext,
    }));
  }

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

  // Per-role nav item lists, identical to the original app.js `navs`
  // object. Item 0 is always "home" for that role and always resolves to
  // dashboard.html; everything else is looked up in SLUG_FILE_MAP.
  const navs = {
    proprietor: ['Dashboard', 'Admissions', 'Students', 'Teachers', 'Academics', 'Content Approvals', 'Attendance', 'Fees & payments', 'Finance', 'People & payroll', 'Messages', 'Library', 'Reports', 'Settings', 'Schools / Campuses'],
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
  const slug = (v) => v.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // One icon per concept, keyed by slug, not by position, so the same
  // item always gets the same icon no matter which role's list it's in
  // (a plain per-index cycle previously gave unrelated items matching
  // icons just because they landed at the same array position).
  const ICONS_BY_SLUG = {
    'schools-campuses': 'building-columns', admissions: 'file-signature', 'apply-for-admission': 'file-signature',
    students: 'user-graduate', classes: 'chalkboard', 'my-classes': 'chalkboard', teachers: 'chalkboard-user', academics: 'book',
    'content-approvals': 'stamp', lessons: 'book-open', timetable: 'clock', 'exams-and-results': 'file-lines', results: 'file-lines',
    assignments: 'clipboard-list', 'cbt-exams': 'laptop-code', attendance: 'clipboard-check',
    fees: 'sack-dollar', 'fees-and-payments': 'sack-dollar', invoices: 'file-invoice-dollar', payments: 'credit-card', arrears: 'triangle-exclamation', reconciliation: 'scale-balanced', expenses: 'receipt', finance: 'chart-line', subscriptions: 'rotate',
    'people-and-payroll': 'users', payroll: 'money-check-dollar', employees: 'id-badge', users: 'users', profile: 'circle-user',
    leave: 'plane-departure', documents: 'folder-open', performance: 'chart-simple', recruitment: 'user-plus',
    'payroll-audit-trail': 'scale-balanced', 'statutory-rules': 'gavel', 'compliance-review': 'clipboard-check',
    messages: 'envelope', communication: 'bullhorn', parents: 'people-roof', support: 'headset',
    reports: 'chart-pie', 'audit-logs': 'list-check', settings: 'gear', 'system-health': 'heart-pulse', integrations: 'plug', 'feature-flags': 'toggle-on',
    library: 'books', 'transport-routes': 'bus', 'vehicles-and-drivers': 'bus', incidents: 'triangle-exclamation', notices: 'bell',
    'student-manifest': 'clipboard-list', schools: 'building-columns', 'my-children': 'heart', more: 'ellipsis',
  };
  function iconFor(item, index) {
    if (index === 0) return '<i class="fa-solid fa-house"></i>'; // item 0 always resolves to dashboard.html regardless of label
    const name = ICONS_BY_SLUG[slug(item)];
    return `<i class="fa-solid fa-${name || 'circle'}"></i>`;
  }

  // Every nav-item slug (across every role, minus each role's item-0
  // "home" which is hardcoded to dashboard.html) mapped to the page file
  // that owns it. Files not yet built in this pass will 404 until a later
  // split step creates them; see the module-split status doc.
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
  // Transport pages, etc.), an honest "Coming soon" empty state rather
  // than fabricated KPI numbers and rows. Nothing here should ever look
  // like real data.
  function renderGenericPage(label) {
    const id = slug(label);
    return `<section class="page workspace-page visible" id="${id}"><div class="page-heading"><div><p class="eyebrow">Not built yet</p><h1>${label}</h1><p class="subtitle">No backend module exists for this yet: this isn't showing you fake data.</p></div></div><section class="data-card"><div class="empty-state"><span class="mini-avatar">✓</span><h3>Coming soon</h3><p>${label} hasn't been built on the backend yet (see CLAUDE.md's Phase 2+ scope). When it is, this page will show real data instead.</p></div></section></section>`;
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
      throw new Error('Your session expired. Please sign in again.');
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
    // A void-returning controller method (no explicit @HttpCode) still
    // sends status 200 with an empty body, not 204 — res.json() throws
    // on empty input, which without this looked like the request itself
    // had failed even though the server-side action succeeded. Reading
    // as text first and only parsing when there's something there covers
    // that case for every endpoint, not just the ones hit so far.
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  }
  function logout() { clearSession(); location.href = 'index.html'; }

  // Role is always the signed-in user's real role now that the "Viewing
  // as" switcher is gone. No more honoring a stale localStorage override
  // from earlier testing.
  function getActiveRole() {
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
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fieldHtml(f) {
    if (f.type === 'select') return `<div class="form-field"><label>${f.label}</label><select name="${f.name}">${f.options.map((o) => `<option>${o}</option>`).join('')}</select></div>`;
    if (f.type === 'textarea') return `<div class="form-field"><label>${f.label}</label><textarea name="${f.name}" placeholder="${f.placeholder || ''}">${escapeHtml(f.value)}</textarea></div>`;
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
    openModal(`<p class="eyebrow">${eyebrow}</p><h2>${title}</h2>${sub ? `<p class="modal-sub">${sub}</p>` : ''}<form onsubmit="__formSubmit(event)">${fields.map(fieldHtml).join('')}<div class="form-actions"><button type="button" class="outline-button" data-modal-close>Cancel</button><button type="submit" class="new-button">${submitLabel}</button></div></form>`);
  }
  function detailModal({ eyebrow, title, sub, rows, footer }) {
    openModal(`<p class="eyebrow">${eyebrow}</p><h2>${title}</h2>${sub ? `<p class="modal-sub">${sub}</p>` : ''}<div class="modal-detail">${rows.map((r) => `<div class="modal-detail-row"><span>${r[0]}</span><strong>${r[1]}</strong></div>`).join('')}</div>${footer || '<div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>'}`);
  }

  // ---- academic session / term (topbar) ----
  const TERM_ORDER = ['FIRST', 'SECOND', 'THIRD'];
  const TERM_LABELS = { FIRST: 'First term', SECOND: 'Second term', THIRD: 'Third term' };
  const SESSION_TERM_ROLES = new Set(['PROPRIETOR', 'PRINCIPAL']);

  /** Paints the topbar year/term buttons from real data (falling back to
   * whatever was cached in localStorage from the last successful load, so
   * there's no flash of placeholder text on every page navigation; this
   * is a multi-page app, so the shell remounts from scratch each time). */
  async function refreshSessionTermBadge() {
    let current;
    try { current = await api('/academic-sessions/current'); } catch (err) { return; }
    const yearBtn = document.getElementById('sessionYearBtn');
    const termBtn = document.getElementById('sessionTermBtn');
    const yearLabel = current.session ? current.session.name : 'No session set';
    const termLabel = current.term ? TERM_LABELS[current.term.name] : 'No term set';
    if (yearBtn && yearBtn.firstChild) yearBtn.firstChild.textContent = yearLabel + ' ';
    if (termBtn && termBtn.firstChild) termBtn.firstChild.textContent = termLabel + ' ';
    localStorage.setItem(SESSION_LABEL_KEY, yearLabel);
    localStorage.setItem(TERM_LABEL_KEY, termLabel);
  }

  /** The topbar's session/term picker: for PROPRIETOR/PRINCIPAL this is
   * also where "advance to next term" and "start a new session" live, the
   * one place isCurrent ever flips (AcademicSessionsService.activateTerm).
   * Every other role gets a read-only view of the same current session/term. */
  async function openSessionTermModal() {
    const user = getUser();
    const canManage = user && SESSION_TERM_ROLES.has(user.role);
    openModal('<p class="eyebrow">Academic calendar</p><h2>Session &amp; term</h2><div id="sessionTermModalBody"><p class="modal-sub">Loading…</p></div><div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>');
    const body = document.getElementById('sessionTermModalBody');
    let sessions, current;
    try {
      [sessions, current] = await Promise.all([api('/academic-sessions'), api('/academic-sessions/current')]);
    } catch (err) { body.innerHTML = `<p class="modal-sub">Could not load academic sessions (${err.message})</p>`; return; }

    const currentTermId = current.term ? current.term.id : null;
    const currentSessionId = current.session ? current.session.id : null;

    const nextTermInSameSession = () => {
      if (!current.session || !current.term) return null;
      const idx = TERM_ORDER.indexOf(current.term.name);
      const nextName = TERM_ORDER[idx + 1];
      if (!nextName) return null;
      const session = sessions.find((s) => s.id === current.session.id);
      return session ? (session.terms || []).find((t) => t.name === nextName) : null;
    };
    const next = nextTermInSameSession();

    const summary = `<div class="modal-detail-row"><span>Current session</span><strong>${current.session ? current.session.name : 'None set'}</strong></div><div class="modal-detail-row"><span>Current term</span><strong>${current.term ? TERM_LABELS[current.term.name] : 'None set'}</strong></div>`;

    const actionsHtml = canManage ? `<div class="form-actions" style="margin:10px 0">
      ${next ? `<button class="new-button" id="advanceTermBtn" data-advance-term-id="${next.id}" data-advance-term-label="${TERM_LABELS[next.name]}">Advance to ${TERM_LABELS[next.name]} →</button>` : ''}
      <button class="outline-button" id="startNewSessionBtn">+ Start new session</button>
    </div>` : '';

    const sessionsHtml = sessions.map((s) => {
      const termsHtml = TERM_ORDER.map((name) => {
        const t = (s.terms || []).find((tm) => tm.name === name);
        if (!t) return `<span class="status">${TERM_LABELS[name]}: not created</span>`;
        const isCurrent = t.id === currentTermId;
        const setBtn = canManage && !isCurrent ? `<button type="button" class="outline-button" data-activate-term="${t.id}" data-activate-term-label="${TERM_LABELS[name]} of ${s.name}">Set current</button>` : '';
        return `<span class="status ${isCurrent ? '' : 'pending'}">${TERM_LABELS[name]}${isCurrent ? ' · current' : ''}</span> ${setBtn}`;
      }).join(' ');
      return `<div class="modal-detail-row" style="align-items:flex-start"><span>${s.name}${s.id === currentSessionId ? ' (current)' : ''}</span><span style="text-align:right">${termsHtml}</span></div>`;
    }).join('') || '<p class="modal-sub">No academic sessions created yet.</p>';

    body.innerHTML = `${summary}${actionsHtml}<div class="detail-section"><p class="eyebrow">All sessions</p>${sessionsHtml}</div>`;

    const advanceBtn = document.getElementById('advanceTermBtn');
    if (advanceBtn) advanceBtn.addEventListener('click', () => {
      if (!window.confirm(`Advance to ${advanceBtn.dataset.advanceTermLabel}? This becomes the school's current term immediately.`)) return;
      activateTermAndRefresh(advanceBtn.dataset.advanceTermId);
    });
    const startBtn = document.getElementById('startNewSessionBtn');
    if (startBtn) startBtn.addEventListener('click', openNewSessionModal);

    body.addEventListener('click', (e) => {
      const setBtn = e.target.closest('[data-activate-term]');
      if (!setBtn) return;
      if (!window.confirm(`Set ${setBtn.dataset.activateTermLabel} as the school's current term?`)) return;
      activateTermAndRefresh(setBtn.dataset.activateTerm);
    });
  }

  async function activateTermAndRefresh(termId) {
    try {
      await api(`/terms/${termId}/activate`, { method: 'PATCH' });
      toast('Current term updated');
      refreshSessionTermBadge();
      closeModal();
    } catch (err) { toast(`Could not update the current term (${err.message})`); }
  }

  /** New session + its three terms, created together and the first
   * activated immediately; the only path that gets a brand-new session
   * off the ground, since a session with no current term isn't reachable
   * by "advance to next term" (that only steps within an existing one). */
  function openNewSessionModal() {
    formModal({
      eyebrow: 'Academic calendar', title: 'Start new session',
      sub: 'Creates the session and its three terms, then makes First Term current. You can adjust term dates later if needed.',
      fields: [
        { name: 'name', label: 'Session name', placeholder: 'e.g. 2026/2027' },
        { name: 'sessionStart', label: 'Session start date', type: 'date' },
        { name: 'sessionEnd', label: 'Session end date', type: 'date' },
        { name: 'term1End', label: 'First term ends', type: 'date' },
        { name: 'term2End', label: 'Second term ends', type: 'date' },
      ],
      submitLabel: 'Create & activate',
      onSubmit: async (d) => {
        const name = (d.name || '').trim();
        if (!name || !d.sessionStart || !d.sessionEnd || !d.term1End || !d.term2End) { toast('All fields are required'); return; }
        try {
          const session = await api('/academic-sessions', { method: 'POST', body: JSON.stringify({ name, startDate: d.sessionStart, endDate: d.sessionEnd }) });
          const term1 = await api('/terms', { method: 'POST', body: JSON.stringify({ academicSessionId: session.id, name: 'FIRST', startDate: d.sessionStart, endDate: d.term1End }) });
          await api('/terms', { method: 'POST', body: JSON.stringify({ academicSessionId: session.id, name: 'SECOND', startDate: d.term1End, endDate: d.term2End }) });
          await api('/terms', { method: 'POST', body: JSON.stringify({ academicSessionId: session.id, name: 'THIRD', startDate: d.term2End, endDate: d.sessionEnd }) });
          await api(`/terms/${term1.id}/activate`, { method: 'PATCH' });
          toast(`${name} created and activated`);
          refreshSessionTermBadge();
        } catch (err) { toast(`Could not create session (${err.message})`); }
      },
    });
  }

  // ---- global search (topbar) ----
  // Client-filtered over the same tenant/role-scoped endpoints every page
  // already uses: /students is scoped per role server-side (own children
  // for PARENT, own class for TEACHER, everyone for admin roles), so this
  // is real data throughout, never a mocked result set.
  const STAFF_SEARCH_ROLES = new Set(['PROPRIETOR', 'PRINCIPAL', 'HR_ADMIN', 'BURSAR']);
  function openGlobalSearch() {
    openModal(`<p class="eyebrow">Search</p><h2>Find a student or staff member</h2><div class="form-field"><input type="text" id="globalSearchInput" placeholder="Type a name or admission number…" autocomplete="off"></div><div id="globalSearchResults"><p class="modal-sub">Start typing to search.</p></div><div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>`);
    const input = document.getElementById('globalSearchInput');
    const resultsEl = document.getElementById('globalSearchResults');
    input.focus();
    let debounceTimer;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => runGlobalSearch(input.value.trim(), resultsEl), 250);
    });
  }
  async function runGlobalSearch(query, resultsEl) {
    if (query.length < 2) { resultsEl.innerHTML = '<p class="modal-sub">Type at least 2 characters…</p>'; return; }
    resultsEl.innerHTML = '<p class="modal-sub">Searching…</p>';
    const q = query.toLowerCase();
    const user = getUser();
    const canSearchStaff = user && STAFF_SEARCH_ROLES.has(user.role);
    try {
      const [students, staff] = await Promise.all([
        api('/students').catch(() => []),
        canSearchStaff ? api('/staff-profiles').catch(() => []) : Promise.resolve([]),
      ]);
      const studentMatches = students.filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) || (s.admissionNo || '').toLowerCase().includes(q));
      const staffMatches = staff.filter((s) => `${s.user.firstName} ${s.user.lastName}`.toLowerCase().includes(q));
      if (!studentMatches.length && !staffMatches.length) { resultsEl.innerHTML = '<p class="modal-sub">No matches.</p>'; return; }
      resultsEl.innerHTML = `<div class="guardian-search-results">${[
        ...studentMatches.slice(0, 8).map((s) => `<div class="guardian-search-result-row" data-search-goto="students.html">${s.firstName} ${s.lastName} · Student · ${s.admissionNo}</div>`),
        ...staffMatches.slice(0, 8).map((s) => `<div class="guardian-search-result-row" data-search-goto="academics.html#teachers">${s.user.firstName} ${s.user.lastName} · Staff</div>`),
      ].join('')}</div>`;
    } catch (err) { resultsEl.innerHTML = `<p class="modal-sub">Could not search (${err.message})</p>`; }
  }

  // ---- notifications ----
  function initNotifications() {
    const btn = document.getElementById('notificationBtn');
    const panel = document.getElementById('notifPanel');
    const badge = document.getElementById('notifBadge');
    if (!btn || !panel) return;
    let items = [];
    let loaded = false;

    function renderBadge() {
      const unread = items.filter((n) => !n.readAt).length;
      if (badge) badge.hidden = unread === 0;
    }
    function renderPanel() {
      const head = '<p class="notif-panel-head">Notifications</p>';
      if (!items.length) { panel.innerHTML = head + '<p class="notif-empty">You\'re all caught up.</p>'; return; }
      panel.innerHTML = head + items.slice(0, 25).map((n) => `<button type="button" class="notif-item ${n.readAt ? '' : 'unread'}" data-notif-id="${n.id}"><strong>${n.title}</strong><span>${n.body}</span><small>${new Date(n.createdAt).toLocaleString()}</small></button>`).join('');
    }
    async function load() {
      try { items = await api('/notifications/me'); } catch (err) { items = []; }
      loaded = true;
      renderBadge();
      renderPanel();
    }
    function open() {
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      if (!loaded) load(); else renderPanel();
    }
    function close() {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panel.hidden) open(); else close();
    });
    panel.addEventListener('click', async (e) => {
      const item = e.target.closest('[data-notif-id]');
      if (!item) return;
      const notif = items.find((n) => n.id === item.dataset.notifId);
      if (notif && !notif.readAt) {
        try {
          await api(`/notifications/${notif.id}/read`, { method: 'PATCH' });
          notif.readAt = new Date().toISOString();
          renderBadge();
          renderPanel();
        } catch (err) { toast(`Could not mark as read (${err.message})`); }
      }
    });
    document.addEventListener('click', (e) => {
      if (!panel.hidden && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });

    load();
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
  // Admissions, Fees/billing, Schools/Campuses, and People & payroll have
  // no real backend behind them yet (each is still a hardcoded mock array;
  // see students.js's admissions kanban, settings.js's campus list,
  // people.js's payroll run), left out of the sidebar entirely for now
  // rather than shown as a dead/blurred link.
  const HIDDEN_SLUGS = new Set([
    'admissions', 'apply-for-admission',
    'fees', 'fees-and-payments', 'invoices', 'payments', 'arrears', 'reconciliation', 'expenses',
    'schools-campuses',
    'people-and-payroll', 'payroll', 'employees', 'leave', 'documents', 'performance',
    'recruitment', 'payroll-audit-trail', 'statutory-rules', 'compliance-review',
    'library',
  ]);

  function renderNav(role) {
    const nav = document.getElementById('mainNav');
    if (!nav) return;
    const items = (navs[role] || navs.proprietor).filter((item) => !HIDDEN_SLUGS.has(slug(item)));
    const here = currentFile();
    nav.innerHTML = `<p class="nav-label">${ROLE_TITLES[role]} workspace</p>` + items.map((item, i) => {
      const file = i === 0 ? 'dashboard.html' : fileForSlug(slug(item));
      const active = file.split('#')[0] === here;
      const label = `<span>${iconFor(item, i)}</span><span class="nav-label-text">${item}</span>`;
      return `<a class="nav-link ${active ? 'active' : ''}" href="${file}" title="${item}">${label}</a>`;
    }).join('');
    const mobileNav = document.getElementById('mobileBottomNav');
    if (mobileNav) {
      const mobile = role === 'parent' || role === 'student';
      mobileNav.innerHTML = mobile ? items.slice(0, 5).map((item, i) => {
        const file = i === 0 ? 'dashboard.html' : fileForSlug(slug(item));
        return `<a class="${file.split('#')[0] === here ? 'active' : ''}" href="${file}"><span>${iconFor(item, i)}</span>${item}</a>`;
      }).join('') : '';
    }
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

    // PROPRIETOR/PRINCIPAL show generically as "Admin" everywhere a name
    // is displayed (sidebar, topbar badge, dashboard greeting), not by
    // personal first/last name — every other role still shows by name.
    const displayName = (user.role === 'PROPRIETOR' || user.role === 'PRINCIPAL') ? 'Admin' : `${user.firstName} ${user.lastName}`;
    const badge = document.getElementById('sessionBadge');
    if (badge) badge.textContent = `${displayName} · ${user.role}`;
    const profileName = document.getElementById('profileName');
    if (profileName) profileName.textContent = displayName;
    const profileRole = document.getElementById('profileRole');
    if (profileRole) profileRole.textContent = ROLE_TITLES[role] || user.role;
    const profileInitials = document.getElementById('profileInitials');
    if (profileInitials) profileInitials.textContent = initialsOf(displayName);

    const yearBtn = document.getElementById('sessionYearBtn');
    if (yearBtn && yearBtn.firstChild) yearBtn.firstChild.textContent = (localStorage.getItem(SESSION_LABEL_KEY) || '—') + ' ';
    const termBtn = document.getElementById('sessionTermBtn');
    if (termBtn && termBtn.firstChild) termBtn.firstChild.textContent = (localStorage.getItem(TERM_LABEL_KEY) || '—') + ' ';
    if (yearBtn || termBtn) refreshSessionTermBadge();
    if (yearBtn) yearBtn.addEventListener('click', openSessionTermModal);
    if (termBtn) termBtn.addEventListener('click', openSessionTermModal);
    refreshBrandColors();

    renderNav(role);

    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Collapsed state persists across reloads/pages so it doesn't reset
    // every time the shell remounts (every navigation, since this is a
    // multi-page app, not an SPA).
    const appShell = document.querySelector('.app-shell');
    const collapseBtn = document.getElementById('sidebarCollapseBtn');
    if (appShell && collapseBtn) {
      const applyCollapsed = (collapsed) => {
        appShell.classList.toggle('sidebar-collapsed', collapsed);
        const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
        collapseBtn.title = label;
        collapseBtn.setAttribute('aria-label', label);
        collapseBtn.innerHTML = collapsed ? '<i class="fa-solid fa-chevron-right"></i>' : '<i class="fa-solid fa-chevron-left"></i>';
      };
      applyCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
      collapseBtn.addEventListener('click', () => {
        const collapsed = !appShell.classList.contains('sidebar-collapsed');
        applyCollapsed(collapsed);
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
      });
    }

    const searchBtn = document.getElementById('topbarSearchBtn');
    if (searchBtn) searchBtn.addEventListener('click', openGlobalSearch);

    initNotifications();

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-modal-close]') || e.target === document.getElementById('modalOverlay')) closeModal();
      const t = e.target.closest('[data-toast]'); if (t) toast(t.dataset.toast);
      const gp = e.target.closest('[data-goto-page]'); if (gp) location.href = fileForSlug(gp.dataset.gotoPage);
      const sg = e.target.closest('[data-search-goto]'); if (sg) location.href = sg.dataset.searchGoto;
      const pc = e.target.closest('[data-pay-child]');
      if (pc) {
        if (typeof window.SchoolOS.onPayChild === 'function') window.SchoolOS.onPayChild(pc.dataset.payChild);
        else toast('Fees module isn’t split into its own page yet: coming soon');
      }
      const modal = e.target.closest('[data-modal]');
      if (modal) { const fn = (window.SchoolOS.modalOpeners || {})[modal.dataset.modal]; if (fn) fn(); }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    // A sidebar link to a different section of the SAME html file (e.g.
    // academics.html#teachers while already on academics.html) only
    // changes the URL hash; the browser doesn't reload the document, so
    // it never fires. Each page's own script picks its active tab from
    // location.hash exactly once, at load time, so without this the
    // sidebar looks like it "does nothing" for same-file links. Reloading
    // on hashchange makes every such link behave like a real navigation.
    window.addEventListener('hashchange', () => location.reload());

    return role;
  }

  window.SchoolOS = {
    api, getUser, getAccessToken, logout, getActiveRole, setActiveRole,
    fileForSlug, slug, money, initialsOf, escapeHtml, toast, openModal, closeModal, formModal, detailModal,
    renderGenericPage, refreshBrandColors,
    onRoleChange: null, onCreateNew: null, onPayChild: null, modalOpeners: {},
    ready: null,
  };

  // ---- login page (index.html) ----
  function initLoginPage() {
    if (getAccessToken() && getUser()) { location.href = 'dashboard.html'; return; }

    const LOGIN_ROLE_TILES = {
      student: { emailPlaceholder: 'firstname.lastname@greenfield.test', hint: 'Student login: email and password issued when your record was created (password123 by default).' },
      parent: { emailPlaceholder: 'firstname.lastname@greenfield.test', hint: 'Parent login: email and password issued when your guardian record was created (password123 by default).' },
      staff: { emailPlaceholder: 'teacher@greenfield.test', hint: 'Teachers, bursar, HR, librarian, transport and other operations staff: email and password issued when your account was created.' },
      admin: { emailPlaceholder: 'proprietor@greenfield.test', hint: 'Proprietor and Principal accounts: full school oversight.' },
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
    const firstCard = document.querySelector('.login-role-card');
    if (firstCard) selectLoginRole(firstCard.dataset.role);

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
