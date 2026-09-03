// Attendance module — real data throughout. Three role variants: teacher
// (take today's register), overview (proprietor/principal/HR/bursar/etc.
// — every class's latest register), self (student's own history / parent's
// per-child history).
(function () {
  function pageAttendanceTeacherReal(label) {
    return `<section class="page workspace-page visible" id="attendance"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Take today's register for your classes.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Class</th><th>Latest register</th><th></th></tr></thead><tbody id="realTeacherAttendanceBody"><tr><td colspan="3">Loading…</td></tr></tbody></table></section></section>`;
  }
  async function loadRealTeacherAttendance() {
    const tbody = document.getElementById('realTeacherAttendanceBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="3">Loading…</td></tr>';
    try {
      const arms = await window.SchoolOS.api('/portal/teacher/class-arms');
      if (!arms.length) { tbody.innerHTML = '<tr><td colspan="3">You are not assigned to any class yet.</td></tr>'; return; }
      const rows = await Promise.all(arms.map(async (a) => {
        let note = 'No register yet';
        try {
          const records = await window.SchoolOS.api('/attendance?classArmId=' + a.id);
          if (records.length) {
            const latestDate = records[0].date;
            const sameDay = records.filter((r) => r.date === latestDate);
            const present = sameDay.filter((r) => r.status === 'PRESENT').length;
            note = `${new Date(latestDate).toDateString()} · ${present}/${sameDay.length} present`;
          }
        } catch (err) { /* leave the default note */ }
        return `<tr><td>${a.schoolClassName} · ${a.armName}</td><td>${note}</td><td class="row-action"><button class="new-button" data-take-real-attendance="${a.id}">Take attendance</button></td></tr>`;
      }));
      tbody.innerHTML = rows.join('');
    } catch (err) { tbody.innerHTML = `<tr><td colspan="3">Could not load classes (${err.message})</td></tr>`; }
  }
  async function openTakeRealAttendanceModal(classArmId) {
    let students = [], term;
    try {
      students = await window.SchoolOS.api('/students?classArmId=' + classArmId);
      const sessions = await window.SchoolOS.api('/academic-sessions');
      const session = sessions.find((s) => s.isCurrent) || sessions[0];
      if (!session) { window.SchoolOS.toast('No academic session found'); return; }
      const terms = await window.SchoolOS.api('/academic-sessions/' + session.id + '/terms');
      term = terms.find((t) => t.isCurrent) || terms[0];
      if (!term) { window.SchoolOS.toast('No term found for the current session'); return; }
    } catch (err) { window.SchoolOS.toast(`Could not load roster (${err.message})`); return; }
    if (!students.length) { window.SchoolOS.toast('No students in this class yet'); return; }

    const rowsHtml = students.map((s, i) => `<div class="attendance-row"><span class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(s.firstName + ' ' + s.lastName)}</span>${s.firstName} ${s.lastName}</span><div class="attendance-toggle"><label><input type="radio" name="status-${i}" value="PRESENT" checked>Present</label><label><input type="radio" name="status-${i}" value="LATE">Late</label><label><input type="radio" name="status-${i}" value="ABSENT">Absent</label></div></div>`).join('');
    window.SchoolOS.openModal(`<p class="eyebrow">Attendance</p><h2>Take attendance · ${term.name}</h2><form onsubmit="__realAttendanceSubmit(event)"><div class="attendance-list">${rowsHtml}</div><div class="form-actions"><button type="button" class="outline-button" data-modal-close>Cancel</button><button type="submit" class="new-button">Save attendance</button></div></form>`);

    window.__realAttendanceSubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const entries = students.map((s, i) => ({ studentId: s.id, status: fd.get('status-' + i) }));
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        await window.SchoolOS.api('/attendance/bulk', { method: 'POST', body: JSON.stringify({ classArmId, termId: term.id, date: new Date().toISOString().slice(0, 10), entries }) });
        window.SchoolOS.closeModal();
        window.SchoolOS.toast('Attendance saved');
        loadRealTeacherAttendance();
      } catch (err) { window.SchoolOS.toast(`Could not save attendance (${err.message})`); btn.disabled = false; btn.textContent = 'Save attendance'; }
    };
  }

  function pageAttendanceOverviewReal(label) {
    return `<section class="page workspace-page visible" id="attendance"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Latest register per class.</p></div></div><div class="screen-kpis"><article class="screen-kpi"><p>Classes tracked</p><strong id="attendanceOverviewClassCount">—</strong><small>Live count</small></article><article class="screen-kpi"><p>School attendance today</p><strong>Coming soon</strong><small>No aggregation built yet</small></article><article class="screen-kpi"><p>Flagged absentees</p><strong>Coming soon</strong><small>No flagging logic built yet</small></article></div><section class="data-card"><table class="data-table"><thead><tr><th>Class</th><th>Latest register</th></tr></thead><tbody id="realAttendanceOverviewBody"><tr><td colspan="2">Loading…</td></tr></tbody></table></section></section>`;
  }
  async function loadRealAttendanceOverview() {
    const tbody = document.getElementById('realAttendanceOverviewBody');
    const countEl = document.getElementById('attendanceOverviewClassCount');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="2">Loading…</td></tr>';
    try {
      const classes = await window.SchoolOS.api('/classes');
      const arms = classes.flatMap((c) => (c.arms || []).map((a) => ({ id: a.id, label: c.name + ' · ' + a.name })));
      if (countEl) countEl.textContent = arms.length;
      if (!arms.length) { tbody.innerHTML = '<tr><td colspan="2">No classes yet.</td></tr>'; return; }
      const rows = await Promise.all(arms.map(async (a) => {
        let note = 'No register yet';
        try {
          const records = await window.SchoolOS.api('/attendance?classArmId=' + a.id);
          if (records.length) {
            const latestDate = records[0].date;
            const sameDay = records.filter((r) => r.date === latestDate);
            const present = sameDay.filter((r) => r.status === 'PRESENT').length;
            note = `${new Date(latestDate).toDateString()} · ${present}/${sameDay.length} present`;
          }
        } catch (err) { /* leave the default note */ }
        return `<tr><td>${a.label}</td><td>${note}</td></tr>`;
      }));
      tbody.innerHTML = rows.join('');
    } catch (err) { tbody.innerHTML = `<tr><td colspan="2">Could not load classes (${err.message})</td></tr>`; }
  }

  function pageAttendanceSelf(label, role) {
    if (role === 'student') {
      return `<section class="page workspace-page visible" id="attendance"><div class="page-heading"><div><p class="eyebrow">Attendance</p><h1>${label}</h1><p class="subtitle">Live from the API — your attendance history.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Date</th><th>Status</th><th>Notes</th></tr></thead><tbody id="realStudentAttendanceBody"><tr><td colspan="3">Loading…</td></tr></tbody></table></section></section>`;
    }
    return `<section class="page workspace-page visible" id="attendance"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Attendance history for your children.</p></div></div><div id="realParentAttendanceBlocks"><p class="modal-sub">Loading…</p></div></section>`;
  }
  async function loadRealStudentAttendance() {
    const body = document.getElementById('realStudentAttendanceBody');
    if (!body || !window.SchoolOS.getAccessToken()) return;
    const user = window.SchoolOS.getUser();
    if (!user || user.role !== 'STUDENT') { body.innerHTML = '<tr><td colspan="3">Sign in as a real student account to see live data.</td></tr>'; return; }
    body.innerHTML = '<tr><td colspan="3">Loading…</td></tr>';
    try {
      const records = await window.SchoolOS.api('/portal/student/attendance');
      body.innerHTML = records.length ? records.map((r) => `<tr><td>${new Date(r.date).toDateString()}</td><td><span class="status ${r.status !== 'PRESENT' ? 'pending' : ''}">${r.status}</span></td><td>${r.correctionReason || '—'}</td></tr>`).join('') : '<tr><td colspan="3">No attendance records yet.</td></tr>';
    } catch (err) { body.innerHTML = `<tr><td colspan="3">Could not load attendance (${err.message})</td></tr>`; }
  }
  async function loadRealParentAttendance() {
    const container = document.getElementById('realParentAttendanceBlocks');
    if (!container || !window.SchoolOS.getAccessToken()) return;
    container.innerHTML = '<p class="modal-sub">Loading…</p>';
    try {
      const children = await window.SchoolOS.api('/portal/parent/children');
      if (!children.length) { container.innerHTML = '<div class="data-card"><div class="empty-state"><span class="mini-avatar">✓</span><h3>No children linked yet</h3><p>Ask the school to link your account to your child’s record.</p></div></div>'; return; }
      const blocks = await Promise.all(children.map(async (link) => {
        const s = link.student;
        let rows = '<tr><td colspan="2">Loading…</td></tr>';
        try { const records = await window.SchoolOS.api('/portal/parent/children/' + s.id + '/attendance'); rows = records.length ? records.map((r) => `<tr><td>${new Date(r.date).toDateString()}</td><td><span class="status ${r.status !== 'PRESENT' ? 'pending' : ''}">${r.status}</span></td></tr>`).join('') : '<tr><td colspan="2">No attendance records yet.</td></tr>'; } catch (err) { rows = `<tr><td colspan="2">Could not load (${err.message})</td></tr>`; }
        return `<section class="data-card fee-child-card"><div class="data-toolbar"><div class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(s.firstName + ' ' + s.lastName)}</span><div><strong>${s.firstName} ${s.lastName}</strong><small>${s.admissionNo}</small></div></div></div><table class="data-table"><thead><tr><th>Date</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></section>`;
      }));
      container.innerHTML = `<div class="fee-child-grid">${blocks.join('')}</div>`;
    } catch (err) { container.innerHTML = `<p class="modal-sub">Could not load your children (${err.message})</p>`; }
  }

  function renderForRole(role) {
    const label = 'Attendance';
    const container = document.getElementById('attendanceSection');
    if (role === 'teacher') { container.innerHTML = pageAttendanceTeacherReal(label); loadRealTeacherAttendance(); return; }
    if (role === 'parent') { container.innerHTML = pageAttendanceSelf(label, role); loadRealParentAttendance(); return; }
    if (role === 'student') { container.innerHTML = pageAttendanceSelf(label, role); loadRealStudentAttendance(); return; }
    container.innerHTML = pageAttendanceOverviewReal(label);
    loadRealAttendanceOverview();
  }

  document.addEventListener('click', (e) => {
    const tra = e.target.closest('[data-take-real-attendance]'); if (tra) openTakeRealAttendanceModal(tra.dataset.takeRealAttendance);
  });

  window.SchoolOS.ready.then((role) => {
    if (!role) return;
    window.SchoolOS.onRoleChange = renderForRole;
    renderForRole(role);
  });
})();
