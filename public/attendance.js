// Attendance module, real data throughout. Three role variants: teacher
// (take today's register), overview (proprietor/principal/HR/bursar/etc.,
// every class's latest register), self (student's own history / parent's
// per-child history).
(function () {
  let currentRole = null;
  const LEVEL_LABELS = { NURSERY: 'Nursery', PRIMARY: 'Primary', JUNIOR_SECONDARY: 'Junior Secondary', SENIOR_SECONDARY: 'Senior Secondary' };
  let lastLoadedClasses = [];

  function pageAttendanceTeacherReal(label) {
    return `<section class="page workspace-page visible" id="attendance"><div class="page-heading"><div><p class="eyebrow">Attendance</p><h1>${label}</h1><p class="subtitle">Take today's register for the class(es) you're the class teacher of.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Class</th><th>Latest register</th><th></th></tr></thead><tbody id="realTeacherAttendanceBody"><tr><td colspan="3">Loading…</td></tr></tbody></table></section></section>`;
  }
  async function loadRealTeacherAttendance() {
    const tbody = document.getElementById('realTeacherAttendanceBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="3">Loading…</td></tr>';
    try {
      // Attendance is restricted to the class teacher only; a subject
      // teacher without the class-teacher role for an arm can't take its
      // register, so this picker only offers arms this teacher actually
      // leads (narrower than /portal/teacher/class-arms, used elsewhere
      // for lessons/assignments/CBT which stay open to subject teachers).
      const arms = await window.SchoolOS.api('/portal/teacher/class-teacher-arms');
      if (!arms.length) { tbody.innerHTML = '<tr><td colspan="3">You are not the class teacher of any class yet.</td></tr>'; return; }
      const today = new Date().toISOString().slice(0, 10);
      const rows = await Promise.all(arms.map(async (a) => {
        let note = 'No register yet';
        let takenToday = false;
        try {
          const records = await window.SchoolOS.api('/attendance?classArmId=' + a.id);
          if (records.length) {
            const latestDate = records[0].date;
            const sameDay = records.filter((r) => r.date === latestDate);
            const present = sameDay.filter((r) => r.status === 'PRESENT').length;
            note = `${new Date(latestDate).toDateString()} · ${present}/${sameDay.length} present`;
            takenToday = latestDate.slice(0, 10) === today;
          }
        } catch (err) { /* leave the default note */ }
        // Once a register exists for today, re-taking it is rejected by
        // the backend; individual records get corrected instead (and a
        // teacher's correction needs admin approval before it counts).
        const action = takenToday
          ? `<button class="outline-button" data-view-correct-attendance="${a.id}" data-class-label="${a.schoolClassName} · ${a.armName}">View &amp; correct</button>`
          : `<button class="new-button" data-take-real-attendance="${a.id}">Take attendance</button>`;
        return `<tr><td>${a.schoolClassName} · ${a.armName}</td><td>${note}</td><td class="row-action">${action}</td></tr>`;
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

  /** A single student's row of today's register, correctable in place
   * once a register already exists: the "edit" path all four roles'
   * views funnel through. Admin roles (PROPRIETOR/PRINCIPAL) self-approve
   * immediately; TEACHER submits a request that sits PENDING until an
   * admin reviews it (see attendance.service.ts's correct()). */
  function openCorrectRecordModal(record, studentName, onDone) {
    const isAdmin = currentRole === 'proprietor' || currentRole === 'principal';
    window.SchoolOS.formModal({
      eyebrow: 'Attendance',
      title: `Correct ${studentName}'s attendance`,
      sub: isAdmin
        ? 'You’re an admin, so this takes effect immediately.'
        : 'This needs Proprietor/Principal approval before it changes the official record.',
      fields: [
        { name: 'status', label: 'New status', type: 'select', options: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] },
        { name: 'correctionReason', label: 'Reason', type: 'textarea', placeholder: 'Why is this changing?' },
      ],
      submitLabel: 'Submit correction',
      onSubmit: async (d) => {
        const reason = (d.correctionReason || '').trim();
        if (reason.length < 3) { window.SchoolOS.toast('A reason (3+ characters) is required'); return; }
        try {
          const res = await window.SchoolOS.api(`/attendance/${record.id}/correct`, {
            method: 'PATCH', body: JSON.stringify({ status: d.status, correctionReason: reason }),
          });
          window.SchoolOS.toast(res.correctionStatus === 'PENDING' ? 'Correction submitted, pending admin approval' : 'Correction applied');
          if (onDone) onDone();
        } catch (err) { window.SchoolOS.toast(`Could not submit correction (${err.message})`); }
      },
    });
  }

  /** Today's register for one class, with a Correct action per student:
   * the entry point once "Take attendance" has flipped to "View &
   * correct" for the day. */
  async function openCorrectAttendanceModal(classArmId, classLabel) {
    let students, records;
    try {
      [students, records] = await Promise.all([
        window.SchoolOS.api('/students?classArmId=' + classArmId),
        window.SchoolOS.api('/attendance?classArmId=' + classArmId),
      ]);
    } catch (err) { window.SchoolOS.toast(`Could not load register (${err.message})`); return; }

    const today = new Date().toISOString().slice(0, 10);
    const byStudent = new Map(records.filter((r) => r.date.slice(0, 10) === today).map((r) => [r.studentId, r]));

    const render = () => {
      const rowsHtml = students.map((s) => {
        const r = byStudent.get(s.id);
        const name = `${s.firstName} ${s.lastName}`;
        if (!r) return `<div class="attendance-row"><span class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(name)}</span>${name}</span><span>No record</span><span></span></div>`;
        const pending = r.hasPendingCorrection ? ' <span class="status pending">Pending review</span>' : '';
        const action = r.hasPendingCorrection
          ? '<button class="outline-button" disabled>Awaiting review</button>'
          : `<button class="outline-button" data-open-correct-record="${r.id}" data-student-name="${name}" data-current-status="${r.status}">Correct</button>`;
        return `<div class="attendance-row"><span class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(name)}</span>${name}</span><span class="status">${r.status}${pending}</span>${action}</div>`;
      }).join('');
      window.SchoolOS.openModal(`<p class="eyebrow">Attendance</p><h2>${classLabel} · Today's register</h2><div class="attendance-list">${rowsHtml}</div><div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>`);
    };
    render();

    window.__correctAttendanceReload = async () => {
      records = await window.SchoolOS.api('/attendance?classArmId=' + classArmId);
      byStudent.clear();
      records.filter((r) => r.date.slice(0, 10) === today).forEach((r) => byStudent.set(r.studentId, r));
      render();
      loadRealTeacherAttendance();
      loadRealAttendanceOverview(); loadAttendanceOverviewSummary();
    };
  }

  function pageAttendanceOverviewReal(label) {
    const isAdmin = currentRole === 'proprietor' || currentRole === 'principal';
    return `<section class="page workspace-page visible" id="attendance"><div class="page-heading"><div><p class="eyebrow">Attendance</p><h1>${label}</h1><p class="subtitle">Latest register per class.</p></div></div><div class="screen-kpis"><article class="screen-kpi"><p>Classes tracked</p><strong id="attendanceOverviewClassCount">—</strong><small>Live count</small></article><article class="screen-kpi"><p>School attendance today</p><strong id="attendanceTodayRateKpi">—</strong><small id="attendanceTodayRateNote">Present + late, across everyone marked today</small></article><article class="screen-kpi"><p>Flagged absentees</p><strong id="attendanceFlaggedKpi">—</strong><small>3+ absences in the last 14 days</small></article></div><section class="data-card"><div class="data-toolbar"><select id="attendanceLevelFilter" class="level-filter-select" aria-label="Filter by level"><option value="">All levels</option>${Object.entries(LEVEL_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><select id="attendanceClassFilter" class="level-filter-select" aria-label="Filter by class"><option value="">All classes</option></select><select id="attendanceArmFilter" class="level-filter-select" aria-label="Filter by arm"><option value="">All arms</option></select></div><table class="data-table"><thead><tr><th>Class</th><th>Latest register</th>${isAdmin ? '<th></th>' : ''}</tr></thead><tbody id="realAttendanceOverviewBody"><tr><td colspan="${isAdmin ? 3 : 2}">Loading…</td></tr></tbody></table></section><section class="data-card" id="flaggedAbsenteesCard" style="margin-top:20px"><div class="data-toolbar"><strong>Flagged absentees</strong></div><table class="data-table"><thead><tr><th>Student</th><th>Class</th><th>Absences (last 14 days)</th></tr></thead><tbody id="flaggedAbsenteesBody"><tr><td colspan="3">Loading…</td></tr></tbody></table></section>${isAdmin ? `<section class="data-card" id="pendingCorrectionsCard" style="margin-top:20px"><div class="data-toolbar"><strong>Pending attendance corrections</strong></div><table class="data-table"><thead><tr><th>Student</th><th>Class</th><th>Requested by</th><th>Change to</th><th>Reason</th><th></th></tr></thead><tbody id="pendingCorrectionsBody"><tr><td colspan="6">Loading…</td></tr></tbody></table></section>` : ''}</section>`;
  }
  /** Mirrors students.js's populateStudentsClassArmFilters: Level narrows
   * Class, Class narrows Arm, each reset only when the level above it
   * changes to something that invalidates the current pick. */
  function populateAttendanceClassArmFilters() {
    const levelSelect = document.getElementById('attendanceLevelFilter');
    const classSelect = document.getElementById('attendanceClassFilter');
    const armSelect = document.getElementById('attendanceArmFilter');
    if (!levelSelect || !classSelect || !armSelect) return;
    const level = levelSelect.value;
    const previousClass = classSelect.value;
    const classesForLevel = lastLoadedClasses.filter((c) => !level || c.level === level);
    classSelect.innerHTML = '<option value="">All classes</option>' + classesForLevel.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
    classSelect.value = classesForLevel.some((c) => c.id === previousClass) ? previousClass : '';
    classSelect.disabled = !classesForLevel.length;

    const selectedClass = lastLoadedClasses.find((c) => c.id === classSelect.value);
    const previousArm = armSelect.value;
    const armsForClass = selectedClass ? selectedClass.arms || [] : [];
    armSelect.innerHTML = '<option value="">All arms</option>' + armsForClass.map((a) => `<option value="${a.id}">${a.name}</option>`).join('');
    armSelect.value = armsForClass.some((a) => a.id === previousArm) ? previousArm : '';
    armSelect.disabled = !armsForClass.length;
  }
  async function loadRealAttendanceOverview() {
    const tbody = document.getElementById('realAttendanceOverviewBody');
    const countEl = document.getElementById('attendanceOverviewClassCount');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    const isAdmin = currentRole === 'proprietor' || currentRole === 'principal';
    tbody.innerHTML = `<tr><td colspan="${isAdmin ? 3 : 2}">Loading…</td></tr>`;
    try {
      const classes = await window.SchoolOS.api('/classes');
      lastLoadedClasses = classes;
      populateAttendanceClassArmFilters();
      const level = document.getElementById('attendanceLevelFilter')?.value || '';
      const classId = document.getElementById('attendanceClassFilter')?.value || '';
      const armId = document.getElementById('attendanceArmFilter')?.value || '';
      const allArms = classes.flatMap((c) => (c.arms || []).map((a) => ({ id: a.id, classId: c.id, level: c.level, label: c.name + ' · ' + a.name, schoolClassName: c.name, armName: a.name })));
      const arms = allArms.filter((a) => (armId ? a.id === armId : classId ? a.classId === classId : level ? a.level === level : true));
      if (countEl) countEl.textContent = allArms.length;
      if (!arms.length) { tbody.innerHTML = `<tr><td colspan="${isAdmin ? 3 : 2}">No classes match this filter.</td></tr>`; return; }
      const rows = await Promise.all(arms.map(async (a) => {
        let note = 'No register yet';
        let takenToday = false;
        try {
          const records = await window.SchoolOS.api('/attendance?classArmId=' + a.id);
          if (records.length) {
            const latestDate = records[0].date;
            const sameDay = records.filter((r) => r.date === latestDate);
            const present = sameDay.filter((r) => r.status === 'PRESENT').length;
            note = `${new Date(latestDate).toDateString()} · ${present}/${sameDay.length} present`;
            takenToday = latestDate.slice(0, 10) === new Date().toISOString().slice(0, 10);
          }
        } catch (err) { /* leave the default note */ }
        const action = isAdmin
          ? `<td class="row-action">${takenToday ? `<button class="outline-button" data-view-correct-attendance="${a.id}" data-class-label="${a.schoolClassName} · ${a.armName}">View &amp; correct</button>` : ''}</td>`
          : '';
        return `<tr><td>${a.label}</td><td>${note}</td>${action}</tr>`;
      }));
      tbody.innerHTML = rows.join('');
    } catch (err) { tbody.innerHTML = `<tr><td colspan="${isAdmin ? 3 : 2}">Could not load classes (${err.message})</td></tr>`; }
  }

  /** School-wide today's attendance rate + the flagged-absentee list,
   * both computed server-side (AttendanceService.overviewSummary) so
   * every viewer of this page sees the same numbers regardless of which
   * classes they can act on. */
  async function loadAttendanceOverviewSummary() {
    const rateKpi = document.getElementById('attendanceTodayRateKpi');
    const rateNote = document.getElementById('attendanceTodayRateNote');
    const flaggedKpi = document.getElementById('attendanceFlaggedKpi');
    const flaggedBody = document.getElementById('flaggedAbsenteesBody');
    if (!rateKpi && !flaggedKpi) return;
    try {
      const summary = await window.SchoolOS.api('/attendance/overview/summary');
      if (rateKpi) {
        if (summary.todayRate) {
          rateKpi.textContent = `${summary.todayRate.ratePercent}%`;
          if (rateNote) rateNote.textContent = `${summary.todayRate.presentCount}/${summary.todayRate.markedCount} present or late, marked today`;
        } else {
          rateKpi.textContent = '—';
          if (rateNote) rateNote.textContent = 'No attendance taken yet today';
        }
      }
      if (flaggedKpi) flaggedKpi.textContent = summary.flaggedAbsentees.length;
      if (flaggedBody) {
        flaggedBody.innerHTML = summary.flaggedAbsentees.length
          ? summary.flaggedAbsentees.map((f) => `<tr><td>${f.name}</td><td>${f.classLabel}</td><td><span class="status pending">${f.absentCount} absences</span></td></tr>`).join('')
          : '<tr><td colspan="3">No students with a concerning absence pattern right now.</td></tr>';
      }
    } catch (err) {
      if (rateKpi) rateKpi.textContent = '—';
      if (flaggedKpi) flaggedKpi.textContent = '—';
      if (flaggedBody) flaggedBody.innerHTML = `<tr><td colspan="3">Could not load (${err.message})</td></tr>`;
    }
  }

  /** PROPRIETOR/PRINCIPAL-only queue: every TEACHER correction request
   * still awaiting a decision, school-wide (not scoped to one class). */
  async function loadPendingCorrections() {
    const tbody = document.getElementById('pendingCorrectionsBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';
    try {
      const items = await window.SchoolOS.api('/attendance/pending-corrections');
      tbody.innerHTML = items.length ? items.map((c) => `<tr><td>${c.student.firstName} ${c.student.lastName}</td><td>${c.classArm.schoolClass.name} · ${c.classArm.name}</td><td>${c.recordedBy.firstName} ${c.recordedBy.lastName}</td><td>${c.status}</td><td>${c.correctionReason || '—'}</td><td class="row-action"><button class="outline-button" data-approve-correction="${c.id}" data-student-name="${c.student.firstName} ${c.student.lastName}">Approve</button> <button class="outline-button" data-reject-correction="${c.id}">Reject</button></td></tr>`).join('') : '<tr><td colspan="6">Nothing pending.</td></tr>';
    } catch (err) { tbody.innerHTML = `<tr><td colspan="6">Could not load pending corrections (${err.message})</td></tr>`; }
  }
  async function approveCorrection(id) {
    try {
      await window.SchoolOS.api(`/attendance/${id}/approve-correction`, { method: 'PATCH' });
      window.SchoolOS.toast('Correction approved');
      loadPendingCorrections(); loadRealAttendanceOverview(); loadAttendanceOverviewSummary();
    } catch (err) { window.SchoolOS.toast(`Could not approve (${err.message})`); }
  }
  function rejectCorrection(id) {
    window.SchoolOS.formModal({
      eyebrow: 'Attendance', title: 'Reject correction', sub: 'Tell the teacher why this correction isn’t being applied.',
      fields: [{ name: 'reason', label: 'Reason', type: 'textarea', placeholder: 'What’s wrong with this correction?' }],
      submitLabel: 'Reject correction',
      onSubmit: async (d) => {
        const reason = (d.reason || '').trim();
        if (reason.length < 3) { window.SchoolOS.toast('A reason (3+ characters) is required'); return; }
        try {
          await window.SchoolOS.api(`/attendance/${id}/reject-correction`, { method: 'PATCH', body: JSON.stringify({ reason }) });
          window.SchoolOS.toast('Correction rejected');
          loadPendingCorrections(); loadRealAttendanceOverview(); loadAttendanceOverviewSummary();
        } catch (err) { window.SchoolOS.toast(`Could not reject (${err.message})`); }
      },
    });
  }

  function pageAttendanceSelf(label, role) {
    if (role === 'student') {
      return `<section class="page workspace-page visible" id="attendance"><div class="page-heading"><div><p class="eyebrow">Attendance</p><h1>${label}</h1><p class="subtitle">Your attendance history.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Date</th><th>Status</th><th>Notes</th></tr></thead><tbody id="realStudentAttendanceBody"><tr><td colspan="3">Loading…</td></tr></tbody></table></section></section>`;
    }
    return `<section class="page workspace-page visible" id="attendance"><div class="page-heading"><div><p class="eyebrow">Attendance</p><h1>${label}</h1><p class="subtitle">Attendance history for your children.</p></div></div><div id="realParentAttendanceBlocks"><p class="modal-sub">Loading…</p></div></section>`;
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
    currentRole = role;
    const label = 'Attendance';
    const container = document.getElementById('attendanceSection');
    if (role === 'teacher') { container.innerHTML = pageAttendanceTeacherReal(label); loadRealTeacherAttendance(); return; }
    if (role === 'parent') { container.innerHTML = pageAttendanceSelf(label, role); loadRealParentAttendance(); return; }
    if (role === 'student') { container.innerHTML = pageAttendanceSelf(label, role); loadRealStudentAttendance(); return; }
    container.innerHTML = pageAttendanceOverviewReal(label);
    loadRealAttendanceOverview();
    loadAttendanceOverviewSummary();
    if (role === 'proprietor' || role === 'principal') loadPendingCorrections();
    ['attendanceLevelFilter', 'attendanceClassFilter', 'attendanceArmFilter'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', loadRealAttendanceOverview);
    });
  }

  document.addEventListener('click', (e) => {
    const tra = e.target.closest('[data-take-real-attendance]'); if (tra) openTakeRealAttendanceModal(tra.dataset.takeRealAttendance);
    const vca = e.target.closest('[data-view-correct-attendance]'); if (vca) openCorrectAttendanceModal(vca.dataset.viewCorrectAttendance, vca.dataset.classLabel);
    const ocr = e.target.closest('[data-open-correct-record]');
    if (ocr) {
      openCorrectRecordModal(
        { id: ocr.dataset.openCorrectRecord, status: ocr.dataset.currentStatus },
        ocr.dataset.studentName,
        () => { if (typeof window.__correctAttendanceReload === 'function') window.__correctAttendanceReload(); },
      );
    }
    const apc = e.target.closest('[data-approve-correction]');
    if (apc && window.confirm(`Approve this correction for ${apc.dataset.studentName}?`)) approveCorrection(apc.dataset.approveCorrection);
    const rjc = e.target.closest('[data-reject-correction]'); if (rjc) rejectCorrection(rjc.dataset.rejectCorrection);
  });

  window.SchoolOS.ready.then((role) => {
    if (!role) return;
    window.SchoolOS.onRoleChange = renderForRole;
    renderForRole(role);
  });
})();
