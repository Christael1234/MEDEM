// Students & Admissions module. Students is real (SchoolOS API); Admissions
// is the original interactive demo kanban (no backend admissions pipeline
// exists yet) — both were separate top-level nav items in the old SPA,
// now tabs on one page. #admissions in the URL opens straight to the
// Admissions tab (used by the sidebar's "Admissions" link).
(function () {
  function bindTabs() {
    document.querySelectorAll('[data-tabs]').forEach((group) => {
      group.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          group.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
          group.parentElement.querySelectorAll('[data-tab-panel]').forEach((p) => p.classList.toggle('visible', p.dataset.tabPanel === btn.dataset.tab));
        });
      });
    });
  }
  // ---- Students (real) ----
  async function loadRealStudents() {
    const tbody = document.getElementById('realStudentsBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4">Loading students…</td></tr>';
    try {
      const students = await window.SchoolOS.api('/students');
      tbody.innerHTML = students.length ? students.map((s) => `<tr><td><div class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(s.firstName + ' ' + s.lastName)}</span>${s.firstName} ${s.lastName}</div></td><td>${s.admissionNo}</td><td><span class="status">${s.status}</span></td><td class="row-action"><button class="outline-button" data-view-student="${s.id}">View</button></td></tr>`).join('') : '<tr><td colspan="4">No students yet.</td></tr>';
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4">Could not load students (${err.message})</td></tr>`;
    }
  }

  async function openNewStudentModal() {
    let campuses = [], classArms = [];
    try {
      campuses = await window.SchoolOS.api('/campuses');
      const classes = await window.SchoolOS.api('/classes');
      classArms = classes.flatMap((c) => (c.arms || []).map((a) => ({ id: a.id, label: `${c.name} · ${a.name}` })));
    } catch (err) { window.SchoolOS.toast(`Could not load campuses/classes (${err.message})`); return; }
    if (!campuses.length) { window.SchoolOS.toast('No campuses found for this tenant'); return; }
    const campusByName = Object.fromEntries(campuses.map((c) => [c.name, c.id]));
    const armByLabel = Object.fromEntries(classArms.map((a) => [a.label, a.id]));

    window.SchoolOS.formModal({
      eyebrow: 'Students', title: 'Add student',
      sub: 'Creates a real student record via the SchoolOS API — POST /students.',
      fields: [
        { name: 'firstName', label: 'First name', placeholder: 'e.g. Ada' },
        { name: 'lastName', label: 'Last name', placeholder: 'e.g. Okafor' },
        { name: 'campus', label: 'Campus', type: 'select', options: campuses.map((c) => c.name) },
        { name: 'classArm', label: 'Class', type: 'select', options: ['Unassigned', ...classArms.map((a) => a.label)] },
        { name: 'gender', label: 'Gender', type: 'select', options: ['—', 'Male', 'Female'] },
        { name: 'dateOfBirth', label: 'Date of birth', type: 'date' },
      ],
      submitLabel: 'Add student',
      onSubmit: async (d) => {
        const payload = {
          campusId: campusByName[d.campus], firstName: (d.firstName || '').trim(), lastName: (d.lastName || '').trim(),
          gender: d.gender && d.gender !== '—' ? d.gender : undefined, dateOfBirth: d.dateOfBirth || undefined,
          currentClassArmId: d.classArm && d.classArm !== 'Unassigned' ? armByLabel[d.classArm] : undefined,
        };
        if (!payload.firstName || !payload.lastName || !payload.campusId) { window.SchoolOS.toast('First name, last name and campus are required'); return; }
        try {
          const created = await window.SchoolOS.api('/students', { method: 'POST', body: JSON.stringify(payload) });
          window.SchoolOS.toast(`${payload.firstName} ${payload.lastName} added`);
          loadRealStudents();
          if (created && created.loginCredentials) {
            window.SchoolOS.detailModal({
              eyebrow: 'Students', title: 'Login created',
              sub: `A student portal login was generated automatically for ${payload.firstName} ${payload.lastName}. Share these with them directly — they won't be shown again.`,
              rows: [['Email', created.loginCredentials.email], ['Password', created.loginCredentials.password]],
            });
          }
        } catch (err) { window.SchoolOS.toast(`Could not add student (${err.message})`); }
      },
    });
  }

  async function openStudentDetailModal(studentId) {
    let s;
    try { s = await window.SchoolOS.api('/students/' + studentId); } catch (err) { window.SchoolOS.toast(`Could not load student (${err.message})`); return; }
    const user = window.SchoolOS.getUser();
    const canManage = user && (user.role === 'PROPRIETOR' || user.role === 'PRINCIPAL');
    const className = s.currentClassArm ? `${s.currentClassArm.schoolClass.name} · ${s.currentClassArm.name}` : 'Unassigned';
    const guardiansHtml = (s.guardianLinks || []).map((g) => `<div class="modal-detail-row"><span>${g.guardian.firstName} ${g.guardian.lastName} (${g.relationship})</span><strong>${g.guardian.phone || g.guardian.email || '—'}</strong></div>`).join('') || '<p class="modal-sub" style="margin:0">No guardians linked yet.</p>';

    window.__renameStudentSubmit = async (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      try {
        await window.SchoolOS.api('/students/' + studentId, { method: 'PATCH', body: JSON.stringify({ firstName: data.get('firstName'), lastName: data.get('lastName'), middleName: data.get('middleName') || undefined }) });
        window.SchoolOS.toast('Student updated');
        loadRealStudents();
        openStudentDetailModal(studentId);
      } catch (err) { window.SchoolOS.toast(`Could not update student (${err.message})`); }
    };

    window.SchoolOS.openModal(`<p class="eyebrow">Students</p><h2>Student details</h2>
      ${canManage ? `<form onsubmit="__renameStudentSubmit(event)">
        <div class="inline-edit-row"><input name="firstName" value="${s.firstName}" aria-label="First name"><input name="lastName" value="${s.lastName}" aria-label="Last name"></div>
        <div class="inline-edit-row"><input name="middleName" value="${s.middleName || ''}" placeholder="Middle name (optional)" aria-label="Middle name"></div>
        <div class="form-actions" style="margin-top:10px"><button type="submit" class="new-button">Save changes</button></div>
      </form>` : `<p class="modal-sub">${s.firstName} ${s.lastName}</p>`}
      <div class="modal-detail-row"><span>Admission No.</span><strong>${s.admissionNo}</strong></div>
      <div class="modal-detail-row"><span>Status</span><strong>${s.status}</strong></div>
      <div class="modal-detail-row"><span>Class</span><strong>${className}</strong></div>
      <div class="modal-detail-row"><span>Gender</span><strong>${s.gender || '—'}</strong></div>
      <div class="detail-section"><p class="eyebrow">Guardians</p>${guardiansHtml}</div>
      <div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>`);
  }

  function renderStudentsAddRow(role) {
    const row = document.getElementById('studentsAddRow');
    if (!row) return;
    row.innerHTML = (role === 'proprietor' || role === 'principal') ? '<button class="new-button" id="addStudentBtn">+ Add student</button>' : '';
    const btn = document.getElementById('addStudentBtn');
    if (btn) btn.addEventListener('click', openNewStudentModal);
  }

  // ---- Admissions (demo pipeline) ----
  const admissionsStages = [['submitted', 'Submitted', 'Review application'], ['review', 'Under review', 'Send offer'], ['approved', 'Approved', 'Generate letter'], ['enrolled', 'Enrolled', 'View profile']];
  const admissionsPipeline = [
    { stage: 'submitted', name: 'Fatima Ibrahim', cls: 'JSS 1', campus: 'Ikoyi', date: '21 Aug', docsLabel: '2/4 docs', docsOk: false, dob: '14 Mar 2013', guardian: 'Alhaji Ibrahim', phone: '0803 456 7890', address: '22 Alexander Ave, Ikoyi', previousSchool: 'Greenwood Prep', notes: 'Sibling of a current SS 2 student.' },
    { stage: 'submitted', name: 'David Chukwu', cls: 'SS 1', campus: 'Lekki', date: '20 Aug', docsLabel: '4/4 docs', docsOk: true, dob: '2 Jul 2011', guardian: 'Mrs. Chukwu', phone: '0806 112 3344', address: '9 Chevron Drive, Lekki', previousSchool: 'Corona Secondary School', notes: 'Transfer student, third term.' },
    { stage: 'review', name: 'Grace Adebayo', cls: 'JSS 2', campus: 'Ikoyi', date: '18 Aug', docsLabel: '4/4 docs', docsOk: true, dob: '30 Sep 2012', guardian: 'Mr. Adebayo', phone: '0812 998 2211', address: '5 Awolowo Road, Ikoyi', previousSchool: 'Whitesands School', notes: 'Requests transport service.' },
    { stage: 'review', name: 'Emeka Obi', cls: 'JSS 1', campus: 'Yaba', date: '17 Aug', docsLabel: '3/4 docs', docsOk: false, dob: '19 Jan 2013', guardian: 'Mrs. Obi', phone: '0705 667 8899', address: '14 Herbert Macaulay Way, Yaba', previousSchool: 'Yaba Model School', notes: 'Awaiting birth certificate.' },
    { stage: 'approved', name: 'Zainab Bello', cls: 'SS 2', campus: 'Ikoyi', date: '12 Aug', docsLabel: 'Offer sent', docsOk: true, dob: '8 Nov 2010', guardian: 'Alhaji Bello', phone: '0813 221 4455', address: '3 Bourdillon Road, Ikoyi', previousSchool: 'Grange School', notes: 'Merit scholarship applicant.' },
    { stage: 'approved', name: 'Tobi Adeleke', cls: 'JSS 3', campus: 'Yaba', date: '11 Aug', docsLabel: 'Offer sent', docsOk: true, dob: '25 May 2011', guardian: 'Mr. Adeleke', phone: '0701 334 5566', address: '8 Commercial Ave, Yaba', previousSchool: 'St. Saviour’s School', notes: '' },
    { stage: 'enrolled', name: 'Michael Okoro', cls: 'JSS 3', campus: 'Lekki', date: '5 Aug', docsLabel: 'Enrolled', docsOk: true, dob: '2 Feb 2011', guardian: 'Mrs. Okoro', phone: '0802 556 7788', address: '17 Admiralty Way, Lekki', previousSchool: 'Chrisland School', notes: '' },
    { stage: 'enrolled', name: 'Amara Nwosu', cls: 'JSS 1', campus: 'Ikoyi', date: '3 Aug', docsLabel: 'Enrolled', docsOk: true, dob: '11 Aug 2013', guardian: 'Mr. Nwosu', phone: '0809 887 6655', address: '2 Glover Road, Ikoyi', previousSchool: 'Lekki British School', notes: '' },
  ];
  const initialsOf = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  function renderAdmissions(role) {
    const canAct = role === 'proprietor' || role === 'principal';
    const kpis = [
      ['Applications this term', '186', '↑ 22% vs last term'],
      ['Awaiting a decision', String(admissionsPipeline.filter((a) => a.stage === 'submitted' || a.stage === 'review').length), 'Submitted or under review'],
      ['Offers sent', '34', '9 awaiting a response'],
      ['Conversion to enrolled', '78%', 'Submitted → enrolled, this term'],
    ];
    document.getElementById('admissionsKpis').innerHTML = kpis.map((s) => `<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('');

    const cols = admissionsStages.map(([key, title, action]) => {
      const cards = admissionsPipeline.filter((a) => a.stage === key);
      const body = cards.map((c) => `<article class="kanban-card"><div class="person-cell"><span class="mini-avatar">${initialsOf(c.name)}</span><div><strong>${c.name}</strong><small>${c.cls} · ${c.campus}</small></div></div><div class="kanban-meta"><span>${c.date}</span><span class="${c.docsOk ? 'doc-ok' : 'doc-warn'}">${c.docsLabel}</span></div>${canAct ? (key === 'submitted' ? `<button class="outline-button" data-review-applicant="${c.name}">${action}</button>` : key === 'enrolled' ? `<button class="outline-button" data-view-applicant="${c.name}">${action}</button>` : `<button class="outline-button" data-advance-applicant="${c.name}">${action}</button>`) : '<div class="view-only-badge">View only</div>'}</article>`).join('') || '<p class="kanban-empty">No applicants here</p>';
      return `<div class="kanban-col"><div class="kanban-col-head"><h3>${title}</h3><span>${cards.length}</span></div>${body}</div>`;
    }).join('');
    document.getElementById('admissionsKanban').innerHTML = cols;
  }

  function openNewApplicationModal() {
    window.SchoolOS.formModal({
      eyebrow: 'Admissions', title: 'New application', sub: 'Register a prospective student into the pipeline.',
      fields: [{ name: 'name', label: 'Applicant name', placeholder: 'e.g. Halima Suleiman' }, { name: 'cls', label: 'Class applying for', type: 'select', options: ['Creche', 'KG', 'Primary 1', 'Primary 2', 'JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3'] }, { name: 'campus', label: 'Campus', type: 'select', options: ['Ikoyi', 'Lekki', 'Yaba'] }, { name: 'guardian', label: 'Guardian name', placeholder: 'e.g. Mr. Suleiman' }, { name: 'phone', label: 'Guardian phone', type: 'tel', placeholder: '080...' }],
      submitLabel: 'Add application',
      onSubmit: (d) => {
        admissionsPipeline.push({ stage: 'submitted', name: d.name || 'New applicant', cls: d.cls, campus: d.campus, date: 'Today', docsLabel: '0/4 docs', docsOk: false });
        renderAdmissions(window.SchoolOS.getActiveRole());
        window.SchoolOS.toast(`Application added · ${d.name || 'New applicant'}`);
      },
    });
  }
  function advanceApplicant(name) {
    const a = admissionsPipeline.find((x) => x.name === name); if (!a) return;
    const order = admissionsStages.map((s) => s[0]); const i = order.indexOf(a.stage);
    if (i >= order.length - 1) { openApplicantDetailModal(name); return; }
    a.stage = order[i + 1];
    if (a.stage === 'review') a.docsLabel = a.docsOk ? '4/4 docs' : '3/4 docs';
    if (a.stage === 'approved') { a.docsLabel = 'Offer sent'; a.docsOk = true; }
    if (a.stage === 'enrolled') a.docsLabel = 'Enrolled';
    renderAdmissions(window.SchoolOS.getActiveRole());
    window.SchoolOS.toast(`Moved to ${admissionsStages.find((s) => s[0] === a.stage)[1]} · ${name}`);
  }
  function openApplicantDetailModal(name) {
    const a = admissionsPipeline.find((x) => x.name === name); if (!a) return;
    window.SchoolOS.detailModal({ eyebrow: 'Applicant profile', title: a.name, rows: [['Class', a.cls], ['Campus', a.campus], ['Stage', admissionsStages.find((s) => s[0] === a.stage)[1]], ['Documents', a.docsLabel], ['Submitted', a.date]] });
  }
  function openApplicantReviewModal(name) {
    const a = admissionsPipeline.find((x) => x.name === name); if (!a) return;
    window.SchoolOS.detailModal({
      eyebrow: `Application · ${a.cls}`, title: a.name,
      rows: [['Date of birth', a.dob || '—'], ['Campus', a.campus], ['Class applying for', a.cls], ['Guardian', a.guardian || '—'], ['Guardian phone', a.phone || '—'], ['Home address', a.address || '—'], ['Previous school', a.previousSchool || '—'], ['Documents', a.docsLabel], ['Notes', a.notes || '—']],
      footer: `<div class="form-actions"><button class="outline-button" data-modal-close>Close</button><button class="new-button" data-modal-close data-advance-applicant="${a.name}">Move to review →</button></div>`,
    });
  }

  function renderForRole(role) {
    renderStudentsAddRow(role);
    loadRealStudents();
    renderAdmissions(role);
  }

  document.addEventListener('click', (e) => {
    const viewStudent = e.target.closest('[data-view-student]'); if (viewStudent) openStudentDetailModal(viewStudent.dataset.viewStudent);
    const adv = e.target.closest('[data-advance-applicant]'); if (adv) advanceApplicant(adv.dataset.advanceApplicant);
    const va = e.target.closest('[data-view-applicant]'); if (va) openApplicantDetailModal(va.dataset.viewApplicant);
    const ra = e.target.closest('[data-review-applicant]'); if (ra) openApplicantReviewModal(ra.dataset.reviewApplicant);
  });

  window.SchoolOS.ready.then((role) => {
    if (!role) return;
    window.SchoolOS.onRoleChange = renderForRole;
    window.SchoolOS.onCreateNew = () => {
      const admissionsVisible = document.querySelector('[data-tab-panel="admissions"]').classList.contains('visible');
      if (admissionsVisible) openNewApplicationModal(); else openNewStudentModal();
    };
    renderForRole(role);
    bindTabs();
    if (location.hash === '#admissions') {
      const tabBtn = document.querySelector('[data-tabs] [data-tab="admissions"]');
      if (tabBtn) tabBtn.click();
    }
  });
})();
