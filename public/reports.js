// Reports module: real reports generated from live data (attendance,
// results, students, staff), not a canned catalog of fake "Generate" /
// "Download" toasts. Each card opens a modal with its own filter form;
// generating renders the real aggregate inline, and Download CSV exports
// exactly what's on screen.
(function () {
  let currentRole = 'proprietor';
  const LEVEL_LABELS = { NURSERY: 'Nursery', PRIMARY: 'Primary', JUNIOR_SECONDARY: 'Junior Secondary', SENIOR_SECONDARY: 'Senior Secondary' };
  const TERM_LABELS = { FIRST: 'First term', SECOND: 'Second term', THIRD: 'Third term' };

  function downloadCsv(filename, headers, rows) {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  async function loadClassArmOptions() {
    try {
      const classes = await window.SchoolOS.api('/classes');
      return classes.flatMap((c) => (c.arms || []).map((a) => ({ id: a.id, label: `${c.name} · ${a.name}` })));
    } catch (err) { return []; }
  }

  // ---- Attendance summary (PROPRIETOR/PRINCIPAL only, backend-aggregated) ----
  async function openAttendanceReportModal() {
    const arms = await loadClassArmOptions();
    const today = new Date().toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    window.SchoolOS.openModal(`<p class="eyebrow">Reports</p><h2>Attendance summary</h2><p class="modal-sub">Real counts from attendance records, honoring any approved corrections.</p><form id="attendanceReportForm"><div class="form-row"><div class="form-field"><label>From</label><input type="date" name="from" value="${monthAgo}"></div><div class="form-field"><label>To</label><input type="date" name="to" value="${today}"></div></div><div class="form-field"><label>Class (optional)</label><select name="classArmId"><option value="">All classes</option>${arms.map((a) => `<option value="${a.id}">${a.label}</option>`).join('')}</select></div><div class="form-actions"><button type="button" class="outline-button" data-modal-close>Close</button><button type="submit" class="new-button">Generate</button></div></form><div id="reportResult" style="margin-top:16px"></div>`);
    document.getElementById('attendanceReportForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const from = fd.get('from'), to = fd.get('to'), classArmId = fd.get('classArmId') || '';
      const resultEl = document.getElementById('reportResult');
      resultEl.innerHTML = '<p class="modal-sub">Generating…</p>';
      try {
        const qs = new URLSearchParams({ from, to, ...(classArmId ? { classArmId } : {}) });
        const report = await window.SchoolOS.api('/attendance/report?' + qs.toString());
        resultEl.innerHTML = `<div class="screen-kpis" style="margin-bottom:14px"><article class="screen-kpi"><p>Records</p><strong>${report.totalRecords}</strong><small>${report.from} → ${report.to}</small></article><article class="screen-kpi"><p>Attendance rate</p><strong>${report.ratePercent}%</strong><small>Present + late</small></article><article class="screen-kpi"><p>Absent</p><strong>${report.byStatus.ABSENT}</strong><small>Unexcused</small></article><article class="screen-kpi"><p>Excused</p><strong>${report.byStatus.EXCUSED}</strong><small>Approved absence</small></article></div>${report.byClass.length ? `<table class="data-table"><thead><tr><th>Class</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Rate</th></tr></thead><tbody>${report.byClass.map((c) => `<tr><td>${c.label}</td><td>${c.present}</td><td>${c.absent}</td><td>${c.late}</td><td>${c.excused}</td><td>${c.ratePercent}%</td></tr>`).join('')}</tbody></table>` : '<p class="modal-sub">No attendance records in this range.</p>'}<div class="form-actions" style="margin-top:14px"><button type="button" class="new-button" id="downloadReportBtn">Download CSV</button></div>`;
        document.getElementById('downloadReportBtn').addEventListener('click', () => {
          downloadCsv(`attendance-report-${from}-to-${to}.csv`, ['Class', 'Present', 'Absent', 'Late', 'Excused', 'Total', 'Rate %'], report.byClass.map((c) => [c.label, c.present, c.absent, c.late, c.excused, c.total, c.ratePercent]));
        });
      } catch (err) { resultEl.innerHTML = `<p class="modal-sub">Could not generate report (${err.message})</p>`; }
    });
  }

  // ---- Academic performance (PROPRIETOR/PRINCIPAL only, backend-aggregated) ----
  async function openAcademicReportModal() {
    const [arms, subjects, current] = await Promise.all([
      loadClassArmOptions(),
      window.SchoolOS.api('/subjects').catch(() => []),
      window.SchoolOS.api('/academic-sessions/current').catch(() => ({})),
    ]);
    let terms = [];
    if (current.session) { try { terms = await window.SchoolOS.api('/academic-sessions/' + current.session.id + '/terms'); } catch (err) { /* leave terms empty */ } }
    window.SchoolOS.openModal(`<p class="eyebrow">Reports</p><h2>Academic performance</h2><p class="modal-sub">Average, spread and grade distribution over published results.</p><form id="academicReportForm"><div class="form-field"><label>Term</label><select name="termId"><option value="">All terms</option>${terms.map((t) => `<option value="${t.id}" ${t.isCurrent ? 'selected' : ''}>${TERM_LABELS[t.name] || t.name}</option>`).join('')}</select></div><div class="form-field"><label>Subject (optional)</label><select name="subjectId"><option value="">All subjects</option>${subjects.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}</select></div><div class="form-field"><label>Class (optional)</label><select name="classArmId"><option value="">All classes</option>${arms.map((a) => `<option value="${a.id}">${a.label}</option>`).join('')}</select></div><div class="form-actions"><button type="button" class="outline-button" data-modal-close>Close</button><button type="submit" class="new-button">Generate</button></div></form><div id="reportResult" style="margin-top:16px"></div>`);
    document.getElementById('academicReportForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const params = {};
      ['termId', 'subjectId', 'classArmId'].forEach((k) => { const v = fd.get(k); if (v) params[k] = v; });
      const resultEl = document.getElementById('reportResult');
      resultEl.innerHTML = '<p class="modal-sub">Generating…</p>';
      try {
        const qs = new URLSearchParams(params).toString();
        const report = await window.SchoolOS.api('/results/report' + (qs ? '?' + qs : ''));
        resultEl.innerHTML = `<div class="screen-kpis" style="margin-bottom:14px"><article class="screen-kpi"><p>Published results</p><strong>${report.count}</strong><small>Counted</small></article><article class="screen-kpi"><p>Average</p><strong>${report.average}</strong><small>out of 100</small></article><article class="screen-kpi"><p>Highest</p><strong>${report.highest}</strong><small>&nbsp;</small></article><article class="screen-kpi"><p>Lowest</p><strong>${report.lowest}</strong><small>&nbsp;</small></article></div>${report.count ? `<p class="modal-sub" style="margin:0 0 8px"><strong>Grade distribution</strong></p><div class="submission-list" style="margin-bottom:14px">${Object.entries(report.gradeDistribution).map(([g, n]) => `<span class="permission-chip">${g}: ${n}</span>`).join('')}</div>` : ''}${report.bySubject.length ? `<table class="data-table"><thead><tr><th>Subject</th><th>Count</th><th>Average</th></tr></thead><tbody>${report.bySubject.map((s) => `<tr><td>${s.name}</td><td>${s.count}</td><td>${s.average}</td></tr>`).join('')}</tbody></table>` : '<p class="modal-sub">No published results match this filter.</p>'}<div class="form-actions" style="margin-top:14px"><button type="button" class="new-button" id="downloadReportBtn">Download CSV</button></div>`;
        document.getElementById('downloadReportBtn').addEventListener('click', () => {
          downloadCsv('academic-performance-report.csv', ['Subject', 'Count', 'Average'], report.bySubject.map((s) => [s.name, s.count, s.average]));
        });
      } catch (err) { resultEl.innerHTML = `<p class="modal-sub">Could not generate report (${err.message})</p>`; }
    });
  }

  // ---- Enrollment summary (client-side aggregate of real /students + /classes) ----
  async function openEnrollmentReportModal() {
    window.SchoolOS.openModal('<p class="eyebrow">Reports</p><h2>Enrollment summary</h2><p class="modal-sub">Live counts from your student roster.</p><div id="reportResult"><p class="modal-sub">Loading…</p></div><div class="form-actions"><button type="button" class="outline-button" data-modal-close>Close</button></div>');
    const resultEl = document.getElementById('reportResult');
    try {
      const [students, classes] = await Promise.all([window.SchoolOS.api('/students'), window.SchoolOS.api('/classes')]);
      const armInfo = {};
      classes.forEach((c) => (c.arms || []).forEach((a) => { armInfo[a.id] = { level: c.level, label: `${c.name} · ${a.name}` }; }));
      const byStatus = {}, byLevel = {}, byClass = {};
      students.forEach((s) => {
        byStatus[s.status] = (byStatus[s.status] || 0) + 1;
        const info = armInfo[s.currentClassArmId];
        byLevel[info ? (LEVEL_LABELS[info.level] || info.level) : 'Unassigned'] = (byLevel[info ? (LEVEL_LABELS[info.level] || info.level) : 'Unassigned'] || 0) + 1;
        byClass[info ? info.label : 'Unassigned'] = (byClass[info ? info.label : 'Unassigned'] || 0) + 1;
      });
      resultEl.innerHTML = `<div class="screen-kpis" style="margin-bottom:14px"><article class="screen-kpi"><p>Total students</p><strong>${students.length}</strong><small>All statuses</small></article>${Object.entries(byStatus).map(([k, v]) => `<article class="screen-kpi"><p>${k}</p><strong>${v}</strong><small>&nbsp;</small></article>`).join('')}</div><p class="modal-sub" style="margin:0 0 8px"><strong>By level</strong></p><table class="data-table"><thead><tr><th>Level</th><th>Students</th></tr></thead><tbody>${Object.entries(byLevel).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table><p class="modal-sub" style="margin:14px 0 8px"><strong>By class</strong></p><table class="data-table"><thead><tr><th>Class</th><th>Students</th></tr></thead><tbody>${Object.entries(byClass).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table><div class="form-actions" style="margin-top:14px"><button type="button" class="new-button" id="downloadReportBtn">Download CSV</button></div>`;
      document.getElementById('downloadReportBtn').addEventListener('click', () => {
        downloadCsv('enrollment-report.csv', ['Class', 'Students'], Object.entries(byClass));
      });
    } catch (err) { resultEl.innerHTML = `<p class="modal-sub">Could not load (${err.message})</p>`; }
  }

  // ---- Staff directory (client-side aggregate of real /staff-profiles) ----
  async function openStaffReportModal() {
    window.SchoolOS.openModal('<p class="eyebrow">Reports</p><h2>Staff directory</h2><p class="modal-sub">Live counts from your staff records.</p><div id="reportResult"><p class="modal-sub">Loading…</p></div><div class="form-actions"><button type="button" class="outline-button" data-modal-close>Close</button></div>');
    const resultEl = document.getElementById('reportResult');
    try {
      const staff = await window.SchoolOS.api('/staff-profiles');
      const byDept = {};
      staff.forEach((s) => { const d = s.department || 'Unassigned'; byDept[d] = (byDept[d] || 0) + 1; });
      resultEl.innerHTML = `<div class="screen-kpis" style="margin-bottom:14px"><article class="screen-kpi"><p>Total staff</p><strong>${staff.length}</strong><small>All departments</small></article></div><table class="data-table"><thead><tr><th>Department</th><th>Staff</th></tr></thead><tbody>${Object.entries(byDept).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table><div class="form-actions" style="margin-top:14px"><button type="button" class="new-button" id="downloadReportBtn">Download CSV</button></div>`;
      document.getElementById('downloadReportBtn').addEventListener('click', () => {
        downloadCsv('staff-directory-report.csv', ['Department', 'Staff'], Object.entries(byDept));
      });
    } catch (err) { resultEl.innerHTML = `<p class="modal-sub">Could not load (${err.message})</p>`; }
  }

  const REPORT_OPENERS = { attendance: openAttendanceReportModal, academic: openAcademicReportModal, enrollment: openEnrollmentReportModal, staff: openStaffReportModal };

  function pageReports(label) {
    const isAdmin = currentRole === 'proprietor' || currentRole === 'principal';
    const cards = [
      { key: 'attendance', title: 'Attendance summary', scope: 'Attendance', desc: 'Present/absent/late/excused counts over a date range, school-wide or per class.', adminOnly: true },
      { key: 'academic', title: 'Academic performance', scope: 'Academics', desc: 'Average, spread and grade distribution over published results.', adminOnly: true },
      { key: 'enrollment', title: 'Enrollment summary', scope: 'Students', desc: 'Roster counts by status, level and class.', adminOnly: false },
      { key: 'staff', title: 'Staff directory', scope: 'HR', desc: 'Staff counts by department.', adminOnly: false },
    ].filter((c) => isAdmin || !c.adminOnly);
    const rows = cards.map((r) => `<tr><td><strong>${r.title}</strong></td><td>${r.scope}</td><td>${r.desc}</td><td class="row-action"><button class="new-button" data-generate-report="${r.key}">Generate</button></td></tr>`).join('');
    return `<section class="page workspace-page visible" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Insights</p><h1>${label}</h1><p class="subtitle">Generate real reports from your school's live data.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Report</th><th>Scope</th><th>What it covers</th><th></th></tr></thead><tbody>${rows}</tbody></table></section></section>`;
  }
  function render() { document.getElementById('reportsSection').innerHTML = pageReports('Reports'); }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-generate-report]');
    if (!btn) return;
    const opener = REPORT_OPENERS[btn.dataset.generateReport];
    if (opener) opener();
  });

  window.SchoolOS.ready.then((role) => {
    if (!role) return;
    currentRole = role;
    window.SchoolOS.onRoleChange = (r) => { currentRole = r; render(); };
    render();
  });
})();
