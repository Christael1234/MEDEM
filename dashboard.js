// Dashboard / Control Center — the one page every role lands on after
// signing in. Everything here was pageMarkup-adjacent code that used to
// live inline in app.js's dashboard section; split out 1:1 with no
// behavior changes.
(function () {
  const roles = {
    proprietor: { name: 'Adetola', title: 'Proprietor / Owner', symbol: '♔', brief: 'Own the whole school, without chasing updates.', text: 'Finance, people and academic exceptions are in one decision queue.', action: 'Export management report' },
    principal: { name: 'Bolanle', title: 'Principal', symbol: '◈', brief: 'Keep teaching, learning and standards on track.', text: 'Focus on attendance, result approvals, staff coverage and learning exceptions.', action: 'Review results' },
    bursar: { name: 'Chinwe', title: 'Bursar / Accountant', symbol: '₦', brief: 'Keep every naira visible and reconciled.', text: 'Work from invoices through payments to exceptions without losing the audit trail.', action: 'Start reconciliation' },
    hr: { name: 'Miriam', title: 'HR / Administrator', symbol: '♙', brief: 'Give staff a reliable, well-run place to work.', text: 'Manage documents, leave, attendance and payroll preparation in one staff record.', action: 'Review leave requests' },
    teacher: { name: 'Tunde', title: 'Teacher', symbol: '✎', brief: 'Everything you need for the classes you teach.', text: 'Take attendance, enter marks and keep families informed.', action: 'Take JSS 2A attendance' },
    parent: { name: 'Nneka', title: 'Parent / Guardian', symbol: '♥', brief: 'Stay close to your children’s school life.', text: 'See fees, receipts, attendance, results and notices in one calm place.', action: 'Pay outstanding balance' },
    student: { name: 'Ada', title: 'Student', symbol: '★', brief: 'Know what’s next and keep up with your work.', text: 'Your timetable, assignments, CBT exams and published results are easy to find.', action: 'View today’s timetable' },
    operations: { name: 'Kabiru', title: 'Transport / Library staff', symbol: '⌘', brief: 'Run the service your school relies on.', text: 'Access your assigned operational module with clear daily actions.', action: 'Open transport register' },
    superadmin: { name: 'Femi', title: 'Super Admin', symbol: '⚙', brief: 'Keep the SchoolOS platform healthy and trusted.', text: 'Manage tenants, subscriptions, support and audit monitoring.', action: 'Review platform alerts' },
    compliance: { name: 'Yewande', title: 'Compliance Administrator', symbol: '⚖', brief: 'Keep statutory payroll rules current and compliant.', text: 'Maintain versioned PAYE, pension and NHF rules, and run the compliance review before every payroll release.', action: 'Run compliance review' },
  };
  const rolePermissions = {
    proprietor: { chips: ['Full control, every campus', 'Approve payroll & refunds', 'Manage settings, branding & templates'], restricted: [] },
    principal: { chips: ['Approve & publish results', 'Manage academics, staff, attendance', 'View fee status, finance, payroll, library'], restricted: ['Cannot edit fees or run payroll', 'Fee revenue figures hidden', 'Cannot edit branding or templates'] },
    bursar: { chips: ['Full fees, payments & finance', 'Prepare payroll'], restricted: ['Cannot approve payroll', 'View-only on students, HR'] },
    hr: { chips: ['Full HR & workforce', 'Prepare payroll inputs'], restricted: ['No fee or finance access', 'Cannot approve payroll'] },
    teacher: { chips: ['Assigned classes & subjects only', 'Lessons, resources, assignments & grading', 'Attendance & marks'], restricted: ['Cannot approve or publish results'] },
    parent: { chips: ['Own linked children only', 'Pay fees, view lessons, results & attendance'], restricted: ['No staff, finance or other families’ data'] },
    student: { chips: ['Own records only', 'View lessons & resources', 'Submit assignments, CBT exams'], restricted: ['No communication or admin functions'] },
    operations: { chips: ['Assigned module only', 'Full library within your campus'], restricted: ['Nothing outside the assignment is visible'] },
    superadmin: { chips: ['Manage tenants, plans & billing', 'Platform monitoring & support'], restricted: ['No school records without logged, time-boxed access'] },
    compliance: { chips: ['Manage statutory rule versions', 'Run compliance review'], restricted: ['Cannot prepare, approve or finalise payroll'] },
  };
  const dashboardScopes = { proprietor: ['fees', 'payroll', 'staff', 'students', 'academics', 'finance'], principal: ['fees', 'payroll', 'staff', 'students', 'academics'], bursar: ['fees', 'payroll', 'staff', 'students', 'finance'], hr: ['payroll', 'staff', 'students'], teacher: ['academics', 'students'], parent: [], student: [], operations: [], superadmin: [], compliance: ['payroll'] };
  const revenueRestrictedRoles = new Set(['principal']);
  const dashboardFeesCopy = {
    proprietor: ['₦8.4m is overdue', 'Families have missed payment by more than 30 days.'],
    principal: ['Fees are overdue', 'Flag it to the bursar — revenue figures aren’t shown here.'],
  };
  // Payroll isn't built on the backend yet (CLAUDE.md non-goal for this
  // pass) — this stays the same static mock narrative the dashboard
  // always showed for the "Payroll" attention card.
  const payrollRun = { period: 'August 2026', stage: 'approval' };
  function payrollCardCopyFor(role) {
    const stage = payrollRun.stage, period = payrollRun.period;
    if (role === 'proprietor') {
      if (stage === 'approval') return ['August payroll is ready', 'Awaiting your final approval.'];
      if (stage === 'finalized') return ['Payroll finalised', `${period} is ready for bank export.`];
      if (stage === 'review') return ['Payroll in review', 'Bursar and HR are reviewing before it reaches you.'];
      return ['Payroll draft in progress', `The bursar has started ${period}.`];
    }
    if (role === 'bursar' || role === 'hr') {
      if (stage === 'draft') return ['Payroll draft in progress', `Continue preparing ${period}.`];
      if (stage === 'review') return ['Payroll in review', 'Check the run before submitting for approval.'];
      if (stage === 'approval') return ['Payroll submitted', 'Awaiting the owner’s final approval.'];
      return ['Payroll finalised', `${period} is ready for bank export.`];
    }
    if (role === 'compliance') {
      if (stage === 'finalized') return ['Payroll finalised', `Run a compliance check on ${period}.`];
      return ['Payroll in progress', 'Review statutory deductions before it is finalised.'];
    }
    if (stage === 'finalized') return ['Payroll finalised', `${period} has been paid out.`];
    if (stage === 'approval') return ['Payroll is with the owner', 'Prepared by the bursar, awaiting final approval.'];
    if (stage === 'review') return ['Payroll in review', 'The bursar and HR are checking it before approval.'];
    return ['Payroll in preparation', `The bursar is still working on ${period}.`];
  }
  // Filled in by loadRealDashboardMetrics() once the API responds; null
  // means "not loaded yet" so copy shows a neutral loading state instead
  // of a stale or fabricated number.
  const realDashboardStats = { submittedResults: null };
  function submittedResultsCopy() {
    if (realDashboardStats.submittedResults === null) return 'Loading…';
    const n = realDashboardStats.submittedResults;
    return n ? `${n} result${n === 1 ? '' : 's'} awaiting your approval.` : 'Nothing waiting on you right now.';
  }
  const workspaceCardCopy = {
    proprietor: [['⌂', 'Today’s priority', 'Approve payroll and clear overdue fees.', 'people-and-payroll'], ['✓', 'Action queue', submittedResultsCopy, 'academics'], ['◫', 'Useful reports', 'Share a clear update with your team.', 'reports']],
    principal: [['✎', 'Result approvals', submittedResultsCopy, 'academics'], ['♟', 'Teacher coverage', 'Review assignments and class coverage this term.', 'teachers'], ['✓', 'Attendance exceptions', 'Check classes with repeated absences.', 'attendance']],
    bursar: [['₦', 'Reconciliation queue', '17 bank transfers need a reference.', 'reconciliation'], ['◫', 'Payroll prep', 'Move this month’s payroll through review.', 'payroll'], ['◫', 'Arrears follow-up', '67 families are more than 30 days overdue.', 'arrears']],
    hr: [['♙', 'Leave requests', 'Coming soon — leave tracking isn’t built yet.', 'leave'], ['◫', 'Payroll inputs', 'Prepare salary inputs for this month’s run.', 'payroll'], ['✓', 'Document renewals', 'Coming soon — staff document tracking isn’t built yet.', 'documents']],
    teacher: [['✓', 'Take attendance', 'Mark today’s register for your class.', 'attendance'], ['✎', 'Mark submissions', 'Coming soon — assignment submission tracking isn’t built yet.', 'assignments'], ['▤', 'Your timetable', 'See today’s periods at a glance.', 'timetable']],
    parent: [['♥', 'Fee balance', 'Pay Emeka’s outstanding balance.', 'fees'], ['✓', 'Attendance', 'Check this week’s attendance for your children.', 'attendance'], ['▤', 'Timetable', 'See what your children are studying today.', 'timetable']],
    student: [['✎', 'Assignments', 'Keep up with what’s due this week.', 'assignments'], ['▤', 'Your timetable', 'See today’s classes at a glance.', 'timetable'], ['✓', 'Results', 'Check your latest scores.', 'results']],
  };
  function workspaceCardsFor(role) {
    const cards = workspaceCardCopy[role] || [['⌂', 'Today’s priority', 'Focus on the work that cannot wait.', ''], ['✓', 'Action queue', 'Complete approvals and updates.', ''], ['◫', 'Useful reports', 'Share a clear update with your team.', '']];
    return cards.map((c) => [c[0], c[1], typeof c[2] === 'function' ? c[2]() : c[2], c[3]]);
  }

  function applyDashboardScope(role) {
    const scopes = new Set(dashboardScopes[role] || []);
    const hideRevenue = revenueRestrictedRoles.has(role);
    document.querySelectorAll('[data-scope]').forEach((el) => {
      el.style.display = (scopes.has(el.dataset.scope) && !(hideRevenue && el.dataset.sensitive === 'revenue')) ? '' : 'none';
    });
    const attentionVisible = document.querySelectorAll('.attention-grid [data-scope]:not([style*="display: none"])').length;
    document.querySelector('.attention-section span').textContent = attentionVisible;
    document.querySelector('.attention-section').style.display = attentionVisible ? '' : 'none';
    document.querySelector('.metrics').style.display = document.querySelectorAll('.metric-grid [data-scope]:not([style*="display: none"])').length ? '' : 'none';
    document.querySelector('.lower-grid').style.display = document.querySelectorAll('.lower-grid [data-scope]:not([style*="display: none"])').length ? '' : 'none';
  }
  function applyPrincipalDashboardCopy(role) {
    const urgent = document.querySelector('.attention-card.urgent'), warning = document.querySelector('.attention-card.warning'), neutral = document.querySelector('.attention-card.neutral');
    const feesCopy = dashboardFeesCopy[role] || dashboardFeesCopy.proprietor;
    if (urgent) { urgent.querySelector('h3').textContent = feesCopy[0]; urgent.querySelector('p:not(.tag)').textContent = feesCopy[1]; }
    if (warning) { const p = payrollCardCopyFor(role); warning.querySelector('h3').textContent = p[0]; warning.querySelector('p:not(.tag)').textContent = p[1]; }
    if (neutral) {
      if (role === 'principal' || role === 'proprietor') {
        const n = realDashboardStats.submittedResults;
        neutral.querySelector('h3').textContent = n === null ? 'Loading…' : `${n} result${n === 1 ? '' : 's'} awaiting approval`;
        neutral.querySelector('p:not(.tag)').textContent = submittedResultsCopy();
      } else {
        neutral.querySelector('h3').textContent = 'Coming soon';
        neutral.querySelector('p:not(.tag)').textContent = 'A live academics summary for this role isn’t built yet.';
      }
    }
  }
  function renderDashboard(role) {
    applyDashboardScope(role);
    applyPrincipalDashboardCopy(role);
    const r = roles[role];
    document.getElementById('roleEyebrow').textContent = `Tuesday, 12 August · ${r.title} view`;
    document.getElementById('greeting').textContent = `Good morning, ${r.name}.`;
    document.getElementById('roleSubtitle').textContent = `Your ${r.title.toLowerCase()} workspace is ready.`;
    document.getElementById('roleSymbol').textContent = r.symbol;
    document.getElementById('roleBriefTitle').textContent = r.brief;
    document.getElementById('roleBriefText').textContent = r.text;
    const roleActionBtn = document.getElementById('roleAction');
    roleActionBtn.innerHTML = `${r.action} <span>→</span>`;
    roleActionBtn.removeAttribute('data-pay-child');
    if (role === 'parent') { roleActionBtn.setAttribute('data-pay-child', 'Emeka Okon'); roleActionBtn.removeAttribute('data-toast'); }
    else { roleActionBtn.setAttribute('data-toast', `${r.action} — done`); }
    const perm = rolePermissions[role] || { chips: [], restricted: [] };
    document.getElementById('permissionChips').innerHTML = perm.chips.map((x) => `<span class="permission-chip">${x}</span>`).join('') + perm.restricted.map((x) => `<span class="permission-chip restricted">✕ ${x}</span>`).join('');
    document.getElementById('workspaceTitle').textContent = `${r.title} workspace`;
    document.getElementById('workspaceGrid').innerHTML = workspaceCardsFor(role).map((x) => `<article class="workspace-card"${x[3] ? ` data-goto-page="${x[3]}"` : ''}><div class="workspace-icon">${x[0]}</div><h3>${x[1]}</h3><p>${x[2]}</p></article>`).join('');
  }

  async function loadRealDashboardMetrics() {
    if (!window.SchoolOS.getAccessToken()) return;
    const studentsEl = document.getElementById('dashStudentsCount');
    const staffEl = document.getElementById('dashStaffCount');
    const campusRows = document.getElementById('dashCampusRows');

    let students = [];
    try {
      students = await window.SchoolOS.api('/students');
      if (studentsEl) studentsEl.textContent = students.length.toLocaleString();
    } catch (err) { if (studentsEl) studentsEl.textContent = '—'; }

    if (staffEl) {
      try {
        const staff = await window.SchoolOS.api('/staff-profiles');
        staffEl.textContent = staff.length.toLocaleString();
      } catch (err) { staffEl.textContent = '—'; }
    }

    if (campusRows) {
      try {
        const campuses = await window.SchoolOS.api('/campuses');
        const countByCampus = {};
        students.forEach((s) => { countByCampus[s.campusId] = (countByCampus[s.campusId] || 0) + 1; });
        campusRows.innerHTML = campuses.length ? campuses.map((c) => `<tr><td><span class="dot green"></span>${c.name}</td><td>${countByCampus[c.id] || 0}</td><td>Coming soon</td><td>Coming soon</td></tr>`).join('') : '<tr><td colspan="4">No campuses yet.</td></tr>';
      } catch (err) { campusRows.innerHTML = `<tr><td colspan="4">Could not load campuses (${err.message})</td></tr>`; }
    }

    try {
      const results = await window.SchoolOS.api('/results');
      realDashboardStats.submittedResults = results.filter((r) => r.status === 'SUBMITTED').length;
    } catch (err) { realDashboardStats.submittedResults = 0; }

    const role = window.SchoolOS.getActiveRole();
    applyPrincipalDashboardCopy(role);
    const workspaceGrid = document.getElementById('workspaceGrid');
    if (workspaceGrid) workspaceGrid.innerHTML = workspaceCardsFor(role).map((x) => `<article class="workspace-card"${x[3] ? ` data-goto-page="${x[3]}"` : ''}><div class="workspace-icon">${x[0]}</div><h3>${x[1]}</h3><p>${x[2]}</p></article>`).join('');
  }

  // renderDashboard() sets the greeting from the mock persona name
  // (e.g. always "Ada" for the student role, regardless of who's really
  // signed in). Patch it with the real signed-in user's name — and, for
  // STUDENT accounts specifically, the linked Student record's name,
  // which is the source of truth and can differ from the login account's.
  async function patchGreetingWithRealName(role) {
    const greeting = document.getElementById('greeting');
    if (!greeting) return;
    const user = window.SchoolOS.getUser();
    if (user) greeting.textContent = `Good morning, ${user.firstName}.`;
    if (role === 'student' && user && user.role === 'STUDENT') {
      try {
        const p = await window.SchoolOS.api('/portal/student/me');
        greeting.textContent = `Good morning, ${p.firstName}.`;
      } catch (err) { /* keep the login-account name as a fallback */ }
    }
  }

  function renderForRole(role) {
    renderDashboard(role);
    patchGreetingWithRealName(role);
    loadRealDashboardMetrics();
  }

  window.SchoolOS.ready.then((role) => {
    if (!role) return; // mountShell already redirected to index.html
    window.SchoolOS.onRoleChange = renderForRole;
    renderForRole(role);
  });
})();
