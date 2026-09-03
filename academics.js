// Academics module — everything academic-cluster: Academics (timetable/
// marks/results/grading-scale/classes/subjects), Teachers, Results,
// Assignments, CBT Exams, Lessons, Content Approvals, standalone
// Timetable, and the student's own Classes/Notices/Profile. These were
// separate top-level SPA pages sharing heavy role-branching logic — kept
// together here rather than split further, mirroring the original app's
// own show/hide-by-id pattern (all sections render, one is visible).
(function () {
  let currentRole = 'proprietor';

  // Which of this module's sections are relevant to each role, in nav
  // order — mirrors the academics-cluster subset of shared.js's `navs`.
  const ITEMS_BY_ROLE = {
    proprietor: ['Teachers', 'Academics', 'Content Approvals'],
    principal: ['Academics', 'Lessons', 'Content Approvals', 'Teachers', 'Timetable', 'Exams & Results'],
    teacher: ['My Classes', 'Lessons', 'Results', 'Timetable', 'Assignments', 'CBT Exams'],
    student: ['Classes', 'Lessons', 'Timetable', 'Assignments', 'CBT Exams', 'Results', 'Notices', 'Profile'],
    parent: ['Lessons', 'Timetable', 'Results'],
  };

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

  // ============ Teachers (real) ============
  function pageTeachersReal(label) {
    const user = window.SchoolOS.getUser();
    const canCreate = user && (user.role === 'PROPRIETOR' || user.role === 'PRINCIPAL');
    const addButton = canCreate ? '<button class="new-button" data-modal="new-teacher">+ Add teacher</button>' : '';
    return `<section class="page workspace-page" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Real teaching staff for the signed-in tenant.</p></div>${addButton}</div><section class="data-card"><table class="data-table"><thead><tr><th>Teacher</th><th>Staff ID</th><th>Department</th><th>Login email</th><th></th></tr></thead><tbody id="realTeachersBody"><tr><td colspan="5">Sign in to load teachers…</td></tr></tbody></table></section></section>`;
  }
  async function openNewTeacherModal() {
    let campuses = [], classes = [], subjects = [];
    try {
      [campuses, classes, subjects] = await Promise.all([window.SchoolOS.api('/campuses'), window.SchoolOS.api('/classes'), window.SchoolOS.api('/subjects')]);
    } catch (err) { window.SchoolOS.toast(`Could not load campuses/classes/subjects (${err.message})`); return; }
    if (!campuses.length) { window.SchoolOS.toast('No campuses found for this tenant'); return; }
    const campusByName = Object.fromEntries(campuses.map((c) => [c.name, c.id]));
    const subjectByName = Object.fromEntries(subjects.map((s) => [s.name, s.id]));

    window.SchoolOS.formModal({
      eyebrow: 'Teachers', title: 'Add teacher',
      sub: 'Creates a real teacher account via the SchoolOS API — POST /staff-profiles/teachers. Optionally assign them as the subject teacher for one or more classes right away.',
      fields: [
        { name: 'firstName', label: 'First name', placeholder: 'e.g. Amina' }, { name: 'lastName', label: 'Last name', placeholder: 'e.g. Yusuf' },
        { name: 'campus', label: 'Campus', type: 'select', options: campuses.map((c) => c.name) },
        { name: 'department', label: 'Department', placeholder: 'e.g. Academics' }, { name: 'position', label: 'Position', placeholder: 'e.g. Class Teacher' },
        { name: 'subject', label: 'Subject to teach (optional)', type: 'select', options: ['None', ...subjects.map((s) => s.name)] },
        { name: 'classIds', label: 'Classes they teach this subject in', type: 'checkboxes', options: classes.map((c) => ({ value: c.id, label: c.name })) },
      ],
      submitLabel: 'Add teacher',
      onSubmit: async (d) => {
        const payload = { campusId: campusByName[d.campus], firstName: (d.firstName || '').trim(), lastName: (d.lastName || '').trim(), department: d.department || undefined, position: d.position || undefined };
        if (!payload.firstName || !payload.lastName || !payload.campusId) { window.SchoolOS.toast('First name, last name and campus are required'); return; }
        const chosenClassIds = [].concat(d.classIds || []);
        const subjectId = d.subject && d.subject !== 'None' ? subjectByName[d.subject] : null;
        if (chosenClassIds.length && !subjectId) { window.SchoolOS.toast('Select a subject to assign to those classes'); return; }
        try {
          const created = await window.SchoolOS.api('/staff-profiles/teachers', { method: 'POST', body: JSON.stringify(payload) });
          loadRealTeachers();
          let assignedNote = '';
          if (subjectId && chosenClassIds.length) {
            for (const schoolClassId of chosenClassIds) {
              await window.SchoolOS.api('/teacher-subject-assignments', { method: 'POST', body: JSON.stringify({ staffProfileId: created.id, schoolClassId, subjectId }) });
            }
            assignedNote = ` · assigned ${d.subject} in ${chosenClassIds.length} class${chosenClassIds.length > 1 ? 'es' : ''}`;
          }
          window.SchoolOS.toast(`${payload.firstName} ${payload.lastName} added${assignedNote}`);
          if (created && created.loginCredentials) {
            window.SchoolOS.detailModal({ eyebrow: 'Teachers', title: 'Login created', sub: `A teacher portal login was generated automatically for ${payload.firstName} ${payload.lastName}. Share these with them directly — they won't be shown again.`, rows: [['Email', created.loginCredentials.email], ['Password', created.loginCredentials.password]] });
          }
        } catch (err) { window.SchoolOS.toast(`Could not add teacher (${err.message})`); }
      },
    });
  }
  async function loadRealTeachers() {
    const tbody = document.getElementById('realTeachersBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="5">Loading teachers…</td></tr>';
    try {
      const staff = await window.SchoolOS.api('/staff-profiles');
      const teachers = staff.filter((s) => s.user && s.user.role === 'TEACHER');
      tbody.innerHTML = teachers.length ? teachers.map((s) => `<tr><td><div class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(s.user.firstName + ' ' + s.user.lastName)}</span>${s.user.firstName} ${s.user.lastName}</div></td><td>${s.staffId}</td><td>${s.department || '—'}</td><td>${s.user.email}</td><td class="row-action"><button class="outline-button" data-view-teacher="${s.id}">View</button></td></tr>`).join('') : '<tr><td colspan="5">No teachers yet.</td></tr>';
    } catch (err) { tbody.innerHTML = `<tr><td colspan="5">Could not load teachers (${err.message})</td></tr>`; }
  }
  async function openTeacherDetailModal(staffProfileId) {
    let t;
    try { t = await window.SchoolOS.api('/staff-profiles/' + staffProfileId); } catch (err) { window.SchoolOS.toast(`Could not load teacher (${err.message})`); return; }
    const user = window.SchoolOS.getUser();
    const canManage = user && (user.role === 'PROPRIETOR' || user.role === 'PRINCIPAL');
    const ledHtml = (t.classArmsLed || []).map((a) => `<div class="modal-detail-row"><span>${a.name}</span><strong>${a.schoolClass.name}</strong></div>`).join('') || '<p class="modal-sub" style="margin:0">Not a class teacher for any arm.</p>';
    const taughtHtml = (t.teacherAssignments || []).map((a) => `<div class="modal-detail-row"><span>${a.subject.name}</span><strong>${a.schoolClass.name}</strong></div>`).join('') || '<p class="modal-sub" style="margin:0">No subjects assigned yet.</p>';
    window.__renameTeacherSubmit = async (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      try {
        await window.SchoolOS.api('/staff-profiles/' + staffProfileId, { method: 'PATCH', body: JSON.stringify({ firstName: data.get('firstName'), lastName: data.get('lastName'), department: data.get('department'), position: data.get('position') }) });
        window.SchoolOS.toast('Teacher updated'); loadRealTeachers(); openTeacherDetailModal(staffProfileId);
      } catch (err) { window.SchoolOS.toast(`Could not update teacher (${err.message})`); }
    };
    window.SchoolOS.openModal(`<p class="eyebrow">Teachers</p><h2>Teacher details</h2>
      ${canManage ? `<form onsubmit="__renameTeacherSubmit(event)">
        <div class="inline-edit-row"><input name="firstName" value="${t.user.firstName}" aria-label="First name"><input name="lastName" value="${t.user.lastName}" aria-label="Last name"></div>
        <div class="inline-edit-row"><input name="department" value="${t.department || ''}" placeholder="Department" aria-label="Department"><input name="position" value="${t.position || ''}" placeholder="Position" aria-label="Position"></div>
        <div class="form-actions" style="margin-top:10px"><button type="submit" class="new-button">Save changes</button></div>
      </form>` : `<p class="modal-sub">${t.user.firstName} ${t.user.lastName} · ${t.department || '—'} · ${t.position || '—'}</p>`}
      <div class="modal-detail-row"><span>Staff ID</span><strong>${t.staffId}</strong></div>
      <div class="modal-detail-row"><span>Login email</span><strong>${t.user.email}</strong></div>
      <div class="detail-section"><p class="eyebrow">Class teacher (homeroom) for</p>${ledHtml}</div>
      <div class="detail-section"><p class="eyebrow">Subjects taught</p>${taughtHtml}</div>
      <div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>`);
  }

  // ============ My Classes (real, teacher) ============
  // Two real, independent views of the same underlying scope: the
  // subjects a teacher is assigned to teach (TeacherSubjectAssignment,
  // at the SchoolClass level) and the actual class arms that scope
  // covers (what Attendance/Assignments/Results already restrict them
  // to). Teachers only ever had a generic mock page here before.
  function pageMyClassesTeacher(label) {
    return `<section class="page workspace-page" id="my-classes"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">The subjects and classes you're assigned to teach.</p></div></div><section class="data-card"><div class="data-toolbar"><span class="tt-class-label">Subjects you teach</span></div><table class="data-table"><thead><tr><th>Subject</th><th>Class</th></tr></thead><tbody id="realMyClassesSubjectsBody"><tr><td colspan="2">Loading…</td></tr></tbody></table></section><section class="data-card" style="margin-top:14px"><div class="data-toolbar"><span class="tt-class-label">Class arms in your scope</span></div><table class="data-table"><thead><tr><th>Class</th><th>Arm</th></tr></thead><tbody id="realMyClassesArmsBody"><tr><td colspan="2">Loading…</td></tr></tbody></table></section></section>`;
  }
  async function loadRealMyClasses() {
    const subjectsBody = document.getElementById('realMyClassesSubjectsBody');
    const armsBody = document.getElementById('realMyClassesArmsBody');
    if ((!subjectsBody && !armsBody) || !window.SchoolOS.getAccessToken()) return;
    if (subjectsBody) {
      subjectsBody.innerHTML = '<tr><td colspan="2">Loading…</td></tr>';
      try {
        const assignments = await window.SchoolOS.api('/portal/teacher/classes');
        subjectsBody.innerHTML = assignments.length ? assignments.map((a) => `<tr><td><strong>${a.subject.name}</strong></td><td>${a.schoolClass.name}</td></tr>`).join('') : '<tr><td colspan="2">You are not assigned to teach any subject yet.</td></tr>';
      } catch (err) { subjectsBody.innerHTML = `<tr><td colspan="2">Could not load your subjects (${err.message})</td></tr>`; }
    }
    if (armsBody) {
      armsBody.innerHTML = '<tr><td colspan="2">Loading…</td></tr>';
      try {
        const arms = await window.SchoolOS.api('/portal/teacher/class-arms');
        armsBody.innerHTML = arms.length ? arms.map((a) => `<tr><td>${a.schoolClassName}</td><td>${a.armName}</td></tr>`).join('') : '<tr><td colspan="2">You are not assigned to any class yet.</td></tr>';
      } catch (err) { armsBody.innerHTML = `<tr><td colspan="2">Could not load your classes (${err.message})</td></tr>`; }
    }
  }

  // ============ Academics (timetable / marks / results / grading / classes / subjects) ============
  const timetableDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const timetablePeriods = ['P1 · 8:00', 'P2 · 8:45', 'P3 · 9:30', 'P4 · 10:35', 'P5 · 11:20', 'P6 · 12:05'];
  const classTimetables = {
    'JSS 2A': [['Mathematics · Dada', 'English · James', 'Basic Science · Eze', 'Mathematics · Dada', 'Civic Ed · Okoro'], ['English · James', 'Mathematics · Dada', 'Social Studies · Bello', 'Basic Science · Eze', 'English · James'], ['Basic Science · Eze', 'Basic Science · Eze', 'Mathematics · Dada', 'Social Studies · Bello', 'Mathematics · Dada'], ['— Break —', '— Break —', '— Break —', '— Break —', '— Break —'], ['Social Studies · Bello', 'Civic Ed · Okoro', 'English · James', 'Mathematics · Dada', 'Basic Science · Eze'], ['French · Diallo', 'French · Diallo', 'Civic Ed · Okoro', 'French · Diallo', 'Mathematics · Dada']],
    'JSS 2B': [['English · James', 'Mathematics · Dada', 'Civic Ed · Okoro', 'Basic Science · Eze', 'Mathematics · Dada'], ['Mathematics · Dada', 'Basic Science · Eze', 'English · James', 'Social Studies · Bello', 'English · James'], ['Social Studies · Bello', 'English · James', 'Mathematics · Dada', 'Basic Science · Eze', 'French · Diallo'], ['— Break —', '— Break —', '— Break —', '— Break —', '— Break —'], ['Basic Science · Eze', 'Civic Ed · Okoro', 'French · Diallo', 'Mathematics · Dada', 'Social Studies · Bello'], ['French · Diallo', 'Social Studies · Bello', 'Civic Ed · Okoro', 'English · James', 'Basic Science · Eze']],
    'SS 1A': [['Physics · Nwachukwu', 'Chemistry · Adio', 'Biology · Falana', 'Mathematics · Dada', 'English · James'], ['Mathematics · Dada', 'Physics · Nwachukwu', 'English · James', 'Chemistry · Adio', 'Biology · Falana'], ['Chemistry · Adio', 'Biology · Falana', 'Mathematics · Dada', 'Physics · Nwachukwu', 'Government · Bello'], ['— Break —', '— Break —', '— Break —', '— Break —', '— Break —'], ['Biology · Falana', 'Government · Bello', 'Physics · Nwachukwu', 'English · James', 'Chemistry · Adio'], ['English · James', 'Government · Bello', 'Chemistry · Adio', 'Biology · Falana', 'Mathematics · Dada']],
  };
  const timetableConflicts = { 'JSS 2A': { row: 5, col: 4, note: 'Mrs. Dada is also teaching JSS 2B at this time' } };
  let currentTimetableClass = 'JSS 2A';
  const teacherClassMap = { 'Tunde Bello': { cls: 'JSS 2A', subject: 'Mathematics' } };
  function openEditTimetableCellModal(r, c) {
    const grid = classTimetables[currentTimetableClass];
    const current = grid[r][c];
    const parts = current.includes('·') ? current.split(' · ') : ['', ''];
    window.SchoolOS.formModal({
      eyebrow: currentTimetableClass, title: `${timetableDays[c]} · ${timetablePeriods[r]}`,
      fields: [{ name: 'subject', label: 'Subject', value: parts[0].trim(), placeholder: 'e.g. Mathematics' }, { name: 'teacher', label: 'Teacher', value: (parts[1] || '').trim(), placeholder: 'e.g. Dada' }],
      submitLabel: 'Save',
      onSubmit: (d) => { grid[r][c] = d.subject ? `${d.subject} · ${d.teacher || 'TBC'}` : 'Free period'; renderAcademicsPanel(); window.SchoolOS.toast('Timetable updated'); },
    });
  }
  function openNewTimetableModal() {
    window.SchoolOS.formModal({
      eyebrow: 'Timetable', title: 'New class timetable', sub: 'Creates a blank weekly grid you can fill in, period by period.',
      fields: [{ name: 'cls', label: 'Class name', placeholder: 'e.g. SS 2A' }],
      submitLabel: 'Create timetable',
      onSubmit: (d) => { const cls = d.cls || 'New class'; classTimetables[cls] = Array.from({ length: 6 }, () => Array(5).fill('Free period')); currentTimetableClass = cls; renderAcademicsPanel(); window.SchoolOS.toast(`Timetable created · ${cls}`); },
    });
  }
  function selectTimetableClass(cls) { if (classTimetables[cls]) { currentTimetableClass = cls; renderAcademicsPanel(); } }
  const gradingScale = [['A', '70–100', 'Excellent'], ['B', '60–69', 'Very good'], ['C', '50–59', 'Good'], ['D', '45–49', 'Pass'], ['E', '40–44', 'Weak pass'], ['F', '0–39', 'Fail']];
  function openEditGradeModal(grade) {
    const g = gradingScale.find((x) => x[0] === grade); if (!g) return;
    window.SchoolOS.formModal({
      eyebrow: 'Grading scale', title: `Edit grade ${grade}`,
      fields: [{ name: 'range', label: 'Score range', value: g[1], placeholder: 'e.g. 70–100' }, { name: 'meaning', label: 'Meaning', value: g[2] }],
      submitLabel: 'Save',
      onSubmit: (d) => { g[1] = d.range || g[1]; g[2] = d.meaning || g[2]; renderAcademicsPanel(); window.SchoolOS.toast(`Grading scale updated · Grade ${grade}`); },
    });
  }
  function pageAcademics(label) {
    const kpis = [['Classes live', '—', 'Live count', 'academicsClassesLiveKpi'], ['Timetable conflicts', 'Coming soon', 'Timetable data source not built yet', null], ['Marks entries flagged', 'Coming soon', 'No flagging logic built yet', null], ['Results awaiting approval', '—', 'Submitted, not yet approved', 'academicsResultsAwaitingKpi']];
    const grid = classTimetables[currentTimetableClass];
    const conflict = timetableConflicts[currentTimetableClass];
    const ttRows = timetablePeriods.map((p, r) => `<tr><td class="tt-period">${p}</td>${timetableDays.map((d, c) => { const isConflict = conflict && conflict.row === r && conflict.col === c; const val = grid[r][c]; const isBreak = val.startsWith('—'); return `<td class="${isBreak ? 'tt-break' : 'tt-editable'} ${isConflict ? 'tt-conflict' : ''}" ${isConflict ? `title="Clash: ${conflict.note}"` : ''} ${isBreak ? '' : `data-edit-cell="${r},${c}"`}>${val}${isConflict ? ' ⚠' : ''}</td>`; }).join('')}</tr>`).join('');
    const canManageClasses = currentRole === 'proprietor' || currentRole === 'principal';
    const addClassButton = canManageClasses ? '<button class="new-button" data-modal="new-class">+ Add class</button>' : '';
    const addSubjectButton = canManageClasses ? '<button class="new-button" data-modal="new-subject">+ Add subject</button>' : '';
    return `<section class="page workspace-page" id="academics"><div class="page-heading"><div><p class="eyebrow">Academic management</p><h1>${label}</h1><p class="subtitle">Timetable, marks entry and result approval for every class.</p></div><button class="new-button" data-goto-tab="marks">+ Enter marks</button></div><div class="screen-kpis">${kpis.map((s, i) => `<article class="screen-kpi"><p>${s[0]}</p><strong${s[3] ? ` id="${s[3]}"` : ''}>${s[1]}</strong><small class="${i === 1 || i === 2 ? 'warn' : ''}">${s[2]}</small></article>`).join('')}</div><div class="screen-tabs" data-tabs><button class="active" data-tab="timetable">Timetable</button><button data-tab="marks">Marks entry</button><button data-tab="results">Result approval</button><button data-tab="scale">Grading scale</button><button data-tab="classes">Classes</button><button data-tab="subjects">Subjects</button></div><div data-tab-panel="timetable" class="tab-panel visible"><section class="data-card"><div class="data-toolbar"><span class="tt-class-label">${currentTimetableClass} · Third term</span><select id="timetableClassSelect" aria-label="Select class timetable">${Object.keys(classTimetables).map((c) => `<option ${c === currentTimetableClass ? 'selected' : ''}>${c}</option>`).join('')}</select><button class="new-button" data-modal="new-timetable">+ New class timetable</button></div><p class="tt-hint">Click any period to edit it.</p><table class="data-table timetable-grid"><thead><tr><th></th>${timetableDays.map((d) => `<th>${d}</th>`).join('')}</tr></thead><tbody>${ttRows}</tbody></table></section></div><div data-tab-panel="marks" class="tab-panel"><section class="data-card"><div class="data-toolbar"><span class="tt-class-label">Live from the API — drafts not yet submitted</span></div><table class="data-table"><thead><tr><th>Student</th><th>Subject</th><th>Term</th><th>CA</th><th>Exam</th><th>Total</th></tr></thead><tbody id="realMarksEntryBody"><tr><td colspan="6">Sign in to load marks…</td></tr></tbody></table></section></div><div data-tab-panel="results" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Student</th><th>Subject</th><th>Term</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody id="realResultApprovalsBody"><tr><td colspan="6">Sign in to load results…</td></tr></tbody></table></section></div><div data-tab-panel="scale" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Grade</th><th>Range</th><th>Meaning</th><th></th></tr></thead><tbody>${gradingScale.map((g) => `<tr><td><strong>${g[0]}</strong></td><td>${g[1]}</td><td>${g[2]}</td><td class="row-action"><button class="outline-button" data-edit-grade="${g[0]}">Edit</button></td></tr>`).join('')}</tbody></table></section></div><div data-tab-panel="classes" class="tab-panel"><section class="data-card"><div class="data-toolbar"><span class="tt-class-label">Live from the API</span>${addClassButton}</div><table class="data-table"><thead><tr><th>Class</th><th>Campus</th><th>Arms</th><th></th></tr></thead><tbody id="realClassesBody"><tr><td colspan="4">Sign in to load classes…</td></tr></tbody></table></section></div><div data-tab-panel="subjects" class="tab-panel"><section class="data-card"><div class="data-toolbar"><span class="tt-class-label">Live from the API</span>${addSubjectButton}</div><table class="data-table"><thead><tr><th>Subject</th><th>Code</th></tr></thead><tbody id="realSubjectsBody"><tr><td colspan="2">Sign in to load subjects…</td></tr></tbody></table></section></div></section>`;
  }
  function renderAcademicsPanel() {
    const el = document.getElementById('academics');
    if (!el) return;
    const wasVisible = el.classList.contains('visible');
    el.outerHTML = pageAcademics('Academics');
    if (wasVisible) document.getElementById('academics').classList.add('visible');
    bindTabs();
    loadRealClasses(); loadRealSubjects(); loadRealAcademicsResults();
  }
  async function loadRealClasses() {
    const tbody = document.getElementById('realClassesBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="4">Loading classes…</td></tr>';
    try {
      const [classes, campuses] = await Promise.all([window.SchoolOS.api('/classes'), window.SchoolOS.api('/campuses')]);
      const campusName = Object.fromEntries(campuses.map((c) => [c.id, c.name]));
      tbody.innerHTML = classes.length ? classes.map((c) => `<tr><td>${c.name}</td><td>${campusName[c.campusId] || '—'}</td><td>${(c.arms || []).map((a) => a.name).join(', ') || '—'}</td><td class="row-action"><button class="outline-button" data-view-class="${c.id}">View</button></td></tr>`).join('') : '<tr><td colspan="4">No classes yet.</td></tr>';
    } catch (err) { tbody.innerHTML = `<tr><td colspan="4">Could not load classes (${err.message})</td></tr>`; }
  }
  async function openClassDetailModal(classId) {
    let cls;
    try { cls = await window.SchoolOS.api('/classes/' + classId); } catch (err) { window.SchoolOS.toast(`Could not load class (${err.message})`); return; }
    const user = window.SchoolOS.getUser();
    const canManage = user && (user.role === 'PROPRIETOR' || user.role === 'PRINCIPAL');
    const armsHtml = (cls.arms || []).map((a) => {
      const teacherName = a.classTeacher ? `${a.classTeacher.user.firstName} ${a.classTeacher.user.lastName}` : 'Unassigned';
      return canManage ? `<form class="inline-edit-row" onsubmit="__renameArmSubmit(event,'${a.id}')"><input name="name" value="${a.name}" aria-label="Arm name"><small>${teacherName}</small><button type="submit" class="outline-button">Save</button></form>` : `<div class="modal-detail-row"><span>${a.name}</span><strong>${teacherName}</strong></div>`;
    }).join('') || '<p class="modal-sub" style="margin:0">No arms yet.</p>';
    const subjectsHtml = (cls.teacherAssignments || []).map((t) => `<div class="modal-detail-row"><span>${t.subject.name}</span><strong>${t.staffProfile.user.firstName} ${t.staffProfile.user.lastName}</strong></div>`).join('') || '<p class="modal-sub" style="margin:0">No subject teachers assigned yet.</p>';
    window.__renameClassSubmit = async (e) => {
      e.preventDefault();
      const name = new FormData(e.target).get('name');
      try { await window.SchoolOS.api('/classes/' + classId, { method: 'PATCH', body: JSON.stringify({ name }) }); window.SchoolOS.toast('Class renamed'); loadRealClasses(); openClassDetailModal(classId); } catch (err) { window.SchoolOS.toast(`Could not rename class (${err.message})`); }
    };
    window.__renameArmSubmit = async (e, armId) => {
      e.preventDefault();
      const name = new FormData(e.target).get('name');
      try { await window.SchoolOS.api('/class-arms/' + armId, { method: 'PATCH', body: JSON.stringify({ name }) }); window.SchoolOS.toast('Arm renamed'); loadRealClasses(); openClassDetailModal(classId); } catch (err) { window.SchoolOS.toast(`Could not rename arm (${err.message})`); }
    };
    window.SchoolOS.openModal(`<p class="eyebrow">Academics</p><h2>Class details</h2>
      ${canManage ? `<form class="inline-edit-row" onsubmit="__renameClassSubmit(event)"><input name="name" value="${cls.name}" aria-label="Class name"><button type="submit" class="outline-button">Save</button></form>` : `<p class="modal-sub">${cls.name}</p>`}
      <div class="detail-section"><p class="eyebrow">Arms</p>${armsHtml}${canManage ? `<button class="outline-button" style="margin-top:10px" data-add-arm="${classId}">+ Add arm</button>` : ''}</div>
      <div class="detail-section"><p class="eyebrow">Subject teachers</p>${subjectsHtml}</div>
      <div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>`);
  }
  async function openNewClassModal() {
    let campuses = [];
    try { campuses = await window.SchoolOS.api('/campuses'); } catch (err) { window.SchoolOS.toast(`Could not load campuses (${err.message})`); return; }
    if (!campuses.length) { window.SchoolOS.toast('No campuses found for this tenant'); return; }
    const campusByName = Object.fromEntries(campuses.map((c) => [c.name, c.id]));
    window.SchoolOS.formModal({
      eyebrow: 'Academics', title: 'Add class', sub: 'Creates a real class via the SchoolOS API — POST /classes.',
      fields: [{ name: 'name', label: 'Class name', placeholder: 'e.g. JSS 3' }, { name: 'campus', label: 'Campus', type: 'select', options: campuses.map((c) => c.name) }],
      submitLabel: 'Add class',
      onSubmit: async (d) => {
        const payload = { campusId: campusByName[d.campus], name: (d.name || '').trim() };
        if (!payload.name || !payload.campusId) { window.SchoolOS.toast('Class name and campus are required'); return; }
        try { await window.SchoolOS.api('/classes', { method: 'POST', body: JSON.stringify(payload) }); window.SchoolOS.toast(`${payload.name} added`); loadRealClasses(); } catch (err) { window.SchoolOS.toast(`Could not add class (${err.message})`); }
      },
    });
  }
  async function openNewClassArmModal(schoolClassId) {
    let teachers = [];
    try { const staff = await window.SchoolOS.api('/staff-profiles'); teachers = staff.filter((s) => s.user && s.user.role === 'TEACHER'); } catch (err) { window.SchoolOS.toast(`Could not load teachers (${err.message})`); return; }
    const teacherLabel = (s) => `${s.user.firstName} ${s.user.lastName}`;
    const teacherByLabel = Object.fromEntries(teachers.map((s) => [teacherLabel(s), s.id]));
    window.SchoolOS.formModal({
      eyebrow: 'Academics', title: 'Add class arm', sub: 'Creates a real class arm (section) via the SchoolOS API — POST /class-arms.',
      fields: [{ name: 'name', label: 'Arm name', placeholder: 'e.g. Gold' }, { name: 'teacher', label: 'Class teacher', type: 'select', options: ['Unassigned', ...teachers.map(teacherLabel)] }],
      submitLabel: 'Add arm',
      onSubmit: async (d) => {
        const payload = { schoolClassId, name: (d.name || '').trim(), classTeacherId: d.teacher && d.teacher !== 'Unassigned' ? teacherByLabel[d.teacher] : undefined };
        if (!payload.name) { window.SchoolOS.toast('Arm name is required'); return; }
        try { await window.SchoolOS.api('/class-arms', { method: 'POST', body: JSON.stringify(payload) }); window.SchoolOS.toast(`${payload.name} added`); loadRealClasses(); } catch (err) { window.SchoolOS.toast(`Could not add class arm (${err.message})`); }
      },
    });
  }
  async function loadRealSubjects() {
    const tbody = document.getElementById('realSubjectsBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="2">Loading subjects…</td></tr>';
    try { const subjects = await window.SchoolOS.api('/subjects'); tbody.innerHTML = subjects.length ? subjects.map((s) => `<tr><td>${s.name}</td><td>${s.code || '—'}</td></tr>`).join('') : '<tr><td colspan="2">No subjects yet.</td></tr>'; } catch (err) { tbody.innerHTML = `<tr><td colspan="2">Could not load subjects (${err.message})</td></tr>`; }
  }
  function openNewSubjectModal() {
    window.SchoolOS.formModal({
      eyebrow: 'Academics', title: 'Add subject', sub: 'Creates a real subject via the SchoolOS API — POST /subjects.',
      fields: [{ name: 'name', label: 'Subject name', placeholder: 'e.g. Further Mathematics' }, { name: 'code', label: 'Code (optional)', placeholder: 'e.g. FMTH' }],
      submitLabel: 'Add subject',
      onSubmit: async (d) => {
        const name = (d.name || '').trim();
        if (!name) { window.SchoolOS.toast('Subject name is required'); return; }
        try { await window.SchoolOS.api('/subjects', { method: 'POST', body: JSON.stringify({ name, code: d.code || undefined }) }); window.SchoolOS.toast(`${name} added`); loadRealSubjects(); } catch (err) { window.SchoolOS.toast(`Could not add subject (${err.message})`); }
      },
    });
  }
  async function loadRealAcademicsResults() {
    const marksBody = document.getElementById('realMarksEntryBody');
    const approvalsBody = document.getElementById('realResultApprovalsBody');
    const classesKpi = document.getElementById('academicsClassesLiveKpi');
    const resultsKpi = document.getElementById('academicsResultsAwaitingKpi');
    if ((!marksBody && !approvalsBody && !classesKpi && !resultsKpi) || !window.SchoolOS.getAccessToken()) return;
    if (classesKpi) { try { const classes = await window.SchoolOS.api('/classes'); classesKpi.textContent = classes.length; } catch (err) { classesKpi.textContent = '—'; } }
    if (!marksBody && !approvalsBody && !resultsKpi) return;
    let results = [];
    try { results = await window.SchoolOS.api('/results'); } catch (err) {
      if (marksBody) marksBody.innerHTML = `<tr><td colspan="6">Could not load marks (${err.message})</td></tr>`;
      if (approvalsBody) approvalsBody.innerHTML = `<tr><td colspan="6">Could not load results (${err.message})</td></tr>`;
      return;
    }
    if (marksBody) {
      const drafts = results.filter((r) => r.status === 'DRAFT');
      marksBody.innerHTML = drafts.length ? drafts.map((r) => `<tr><td>${r.student ? r.student.firstName + ' ' + r.student.lastName : '—'}</td><td>${r.subject?.name || '—'}</td><td>${r.term?.name || '—'}</td><td>${r.continuousAssessmentScore ?? '—'}</td><td>${r.examScore ?? '—'}</td><td>${r.totalScore ?? '—'}</td></tr>`).join('') : '<tr><td colspan="6">No draft marks yet.</td></tr>';
    }
    if (approvalsBody) {
      const relevant = results.filter((r) => r.status === 'SUBMITTED' || r.status === 'APPROVED' || r.status === 'PUBLISHED');
      approvalsBody.innerHTML = relevant.length ? relevant.map((r) => {
        let action = '<span>→</span>';
        if (r.status === 'SUBMITTED') action = `<button class="outline-button" data-approve-real-result="${r.id}">Approve</button>`;
        else if (r.status === 'APPROVED') action = `<button class="outline-button" data-publish-real-result="${r.id}">Publish</button>`;
        return `<tr><td>${r.student ? r.student.firstName + ' ' + r.student.lastName : '—'}</td><td>${r.subject?.name || '—'}</td><td>${r.term?.name || '—'}</td><td>${r.totalScore ?? '—'}</td><td><span class="status ${r.status !== 'PUBLISHED' ? 'pending' : ''}">${r.status}</span></td><td class="row-action">${action}</td></tr>`;
      }).join('') : '<tr><td colspan="6">No submitted results yet.</td></tr>';
    }
    if (resultsKpi) resultsKpi.textContent = results.filter((r) => r.status === 'SUBMITTED').length;
  }
  async function approveRealResult(id) {
    try { await window.SchoolOS.api('/results/' + id + '/approve', { method: 'PATCH' }); window.SchoolOS.toast('Result approved'); loadRealAcademicsResults(); } catch (err) { window.SchoolOS.toast(`Could not approve (${err.message})`); }
  }
  async function publishRealResult(id) {
    try { await window.SchoolOS.api('/results/' + id + '/publish', { method: 'PATCH' }); window.SchoolOS.toast('Result published'); loadRealAcademicsResults(); } catch (err) { window.SchoolOS.toast(`Could not publish (${err.message})`); }
  }

  // ============ Results (student / parent / teacher) ============
  function pageStudentResults(label) {
    return `<section class="page workspace-page" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Results</p><h1>${label}</h1><p class="subtitle">Live from the API — every published result for your account.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Subject</th><th>Term</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th></tr></thead><tbody id="realStudentResultsBody"><tr><td colspan="6">Sign in as a student to load results…</td></tr></tbody></table></section></section>`;
  }
  function pageParentResults(label) {
    return `<section class="page workspace-page" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Published results for your linked children.</p></div></div><div id="realParentResultsBlocks"><p class="modal-sub">Sign in as a parent to load results…</p></div></section>`;
  }
  async function loadRealParentResults() {
    const container = document.getElementById('realParentResultsBlocks');
    if (!container || !window.SchoolOS.getAccessToken()) return;
    container.innerHTML = '<p class="modal-sub">Loading…</p>';
    try {
      const children = await window.SchoolOS.api('/portal/parent/children');
      if (!children.length) { container.innerHTML = '<div class="data-card"><div class="empty-state"><span class="mini-avatar">♥</span><h3>No children linked yet</h3><p>Ask the school to link your account to your child’s record.</p></div></div>'; return; }
      const blocks = await Promise.all(children.map(async (link) => {
        const s = link.student;
        let rows = '<tr><td colspan="4">Loading…</td></tr>';
        try { const results = await window.SchoolOS.api('/portal/parent/children/' + s.id + '/results'); rows = results.length ? results.map((r) => `<tr><td>${r.subject?.name || '—'}</td><td>${r.term?.name || '—'}</td><td>${r.totalScore ?? '—'}</td><td>${r.grade || '—'}</td></tr>`).join('') : '<tr><td colspan="4">No published results yet.</td></tr>'; } catch (err) { rows = `<tr><td colspan="4">Could not load (${err.message})</td></tr>`; }
        return `<section class="data-card fee-child-card"><div class="data-toolbar"><div class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(s.firstName + ' ' + s.lastName)}</span><div><strong>${s.firstName} ${s.lastName}</strong><small>${s.admissionNo}</small></div></div></div><table class="data-table"><thead><tr><th>Subject</th><th>Term</th><th>Total</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table></section>`;
      }));
      container.innerHTML = `<div class="fee-child-grid">${blocks.join('')}</div>`;
    } catch (err) { container.innerHTML = `<p class="modal-sub">Could not load your children (${err.message})</p>`; }
  }
  function pageTeacherResultsReal(label) {
    return `<section class="page workspace-page" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Enter marks for the subjects and classes you teach.</p></div><button class="new-button" data-modal="add-marks">+ Add marks</button></div><section class="data-card"><table class="data-table"><thead><tr><th>Student</th><th>Subject</th><th>Term</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody id="realTeacherResultsBody"><tr><td colspan="6">Sign in as a teacher to load results…</td></tr></tbody></table></section></section>`;
  }
  async function loadRealTeacherResults() {
    const tbody = document.getElementById('realTeacherResultsBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';
    try {
      const results = await window.SchoolOS.api('/results');
      tbody.innerHTML = results.length ? results.map((r) => `<tr><td>${r.student ? r.student.firstName + ' ' + r.student.lastName : '—'}</td><td>${r.subject?.name || '—'}</td><td>${r.term?.name || '—'}</td><td>${r.totalScore ?? '—'}</td><td><span class="status ${r.status !== 'PUBLISHED' ? 'pending' : ''}">${r.status}</span></td><td class="row-action">${r.status === 'DRAFT' ? `<button class="outline-button" data-submit-result="${r.id}">Submit</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="6">No marks entered yet.</td></tr>';
    } catch (err) { tbody.innerHTML = `<tr><td colspan="6">Could not load results (${err.message})</td></tr>`; }
  }
  async function submitResult(id) {
    try { await window.SchoolOS.api('/results/' + id + '/submit', { method: 'PATCH' }); window.SchoolOS.toast('Marks submitted for approval'); loadRealTeacherResults(); } catch (err) { window.SchoolOS.toast(`Could not submit (${err.message})`); }
  }
  function pageResults(label) {
    if (currentRole === 'student') return pageStudentResults(label);
    if (currentRole === 'parent') return pageParentResults(label);
    if (currentRole === 'teacher') return pageTeacherResultsReal(label);
    return window.SchoolOS.renderGenericPage(label);
  }
  async function openAddMarksModal() {
    let assignments = [];
    try { assignments = await window.SchoolOS.api('/portal/teacher/classes'); } catch (err) { window.SchoolOS.toast(`Could not load your subjects (${err.message})`); return; }
    if (!assignments.length) { window.SchoolOS.toast('You are not assigned to teach any subject yet'); return; }
    const subjectsById = {};
    assignments.forEach((a) => { subjectsById[a.subject.id] = a.subject.name; });
    const subjectNames = [...new Set(Object.values(subjectsById))];
    window.SchoolOS.formModal({
      eyebrow: 'Results', title: 'Add marks', sub: 'Pick the subject you want to enter marks for — you’ll then choose one or more of your classes.',
      fields: [{ name: 'subject', label: 'Subject', type: 'select', options: subjectNames }],
      submitLabel: 'Continue',
      onSubmit: (d) => {
        const subjectId = Object.keys(subjectsById).find((id) => subjectsById[id] === d.subject);
        const classAssignments = assignments.filter((a) => a.subject.id === subjectId);
        openMarksClassPickerModal(subjectId, d.subject, classAssignments);
      },
    });
  }
  async function openMarksClassPickerModal(subjectId, subjectName, classAssignments) {
    let armOptions = [];
    try {
      const schoolClassIds = [...new Set(classAssignments.map((a) => a.schoolClass.id))];
      const schoolClasses = await Promise.all(schoolClassIds.map((id) => window.SchoolOS.api('/classes/' + id)));
      armOptions = schoolClasses.flatMap((c) => (c.arms || []).map((a) => ({ value: a.id, label: `${c.name} · ${a.name}` })));
    } catch (err) { window.SchoolOS.toast(`Could not load your classes (${err.message})`); return; }
    if (!armOptions.length) { window.SchoolOS.toast('None of your classes for this subject have any arms yet'); return; }
    window.SchoolOS.formModal({
      eyebrow: 'Results', title: `${subjectName} marks`, sub: 'Choose one or more classes to load their student rosters.',
      fields: [{ name: 'armIds', label: 'Classes', type: 'checkboxes', options: armOptions }],
      submitLabel: 'Load roster',
      onSubmit: async (d) => {
        const armIds = [].concat(d.armIds || []);
        if (!armIds.length) { window.SchoolOS.toast('Select at least one class'); return; }
        openMarksEntryModal(subjectId, subjectName, armIds, armOptions);
      },
    });
  }
  async function openMarksEntryModal(subjectId, subjectName, armIds, armOptions) {
    let term;
    try {
      const sessions = await window.SchoolOS.api('/academic-sessions');
      const currentSession = sessions.find((s) => s.isCurrent) || sessions[0];
      if (!currentSession) { window.SchoolOS.toast('No academic session found'); return; }
      const terms = await window.SchoolOS.api(`/academic-sessions/${currentSession.id}/terms`);
      term = terms.find((t) => t.isCurrent) || terms[0];
      if (!term) { window.SchoolOS.toast('No term found for the current session'); return; }
    } catch (err) { window.SchoolOS.toast(`Could not load the current term (${err.message})`); return; }
    const armLabel = Object.fromEntries(armOptions.map((a) => [a.value, a.label]));
    let students = [];
    try {
      const rosters = await Promise.all(armIds.map((id) => window.SchoolOS.api('/students?classArmId=' + id)));
      students = rosters.flatMap((list, i) => list.map((s) => ({ ...s, armLabel: armLabel[armIds[i]] })));
    } catch (err) { window.SchoolOS.toast(`Could not load students (${err.message})`); return; }
    if (!students.length) { window.SchoolOS.toast('No students found in the selected classes'); return; }
    const rowsHtml = students.map((s, i) => `<div class="attendance-row"><span class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(s.firstName + ' ' + s.lastName)}</span>${s.firstName} ${s.lastName}<small style="display:block;color:var(--muted);font-size:10px">${s.armLabel}</small></span><input class="attendance-reason" name="ca-${i}" type="number" min="0" max="100" placeholder="CA /100"><input class="attendance-reason" name="exam-${i}" type="number" min="0" max="100" placeholder="Exam /100"></div>`).join('');
    window.SchoolOS.openModal(`<p class="eyebrow">Results</p><h2>${subjectName} marks · ${term.name}</h2><p class="modal-sub">Leave a student blank to skip them. Marks save as drafts — submit each for approval when ready.</p><form onsubmit="__marksSubmit(event)"><div class="attendance-list">${rowsHtml}</div><div class="form-actions"><button type="button" class="outline-button" data-modal-close>Cancel</button><button type="submit" class="new-button">Save marks</button></div></form>`);
    window.__marksSubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Saving…';
      let saved = 0, failed = 0;
      for (let i = 0; i < students.length; i++) {
        const ca = fd.get('ca-' + i), exam = fd.get('exam-' + i);
        if (!ca && !exam) continue;
        try {
          await window.SchoolOS.api('/results', { method: 'POST', body: JSON.stringify({ studentId: students[i].id, subjectId, academicSessionId: term.academicSessionId, termId: term.id, continuousAssessmentScore: ca ? Number(ca) : undefined, examScore: exam ? Number(exam) : undefined }) });
          saved++;
        } catch (err) { failed++; }
      }
      window.SchoolOS.closeModal();
      window.SchoolOS.toast(`${saved} mark${saved === 1 ? '' : 's'} saved${failed ? ` · ${failed} failed` : ''}`);
      loadRealTeacherResults();
    };
  }

  // ============ Assignments (student / teacher) ============
  function pageAssignmentsStudent(label) {
    return `<section class="page workspace-page" id="assignments"><div class="page-heading"><div><p class="eyebrow">My work</p><h1>${label}</h1><p class="subtitle">Live from the API — everything posted for your class.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Assignment</th><th>Description</th><th>Due date</th></tr></thead><tbody id="realStudentAssignmentsBody"><tr><td colspan="3">Sign in as a student to load assignments…</td></tr></tbody></table></section></section>`;
  }
  function pageAssignmentsTeacher(label) {
    return `<section class="page workspace-page" id="assignments"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Real assignments across the classes you teach.</p></div><button class="new-button" data-modal="new-assignment-real">+ New assignment</button></div><section class="data-card"><table class="data-table"><thead><tr><th>Assignment</th><th>Class</th><th>Subject</th><th>Due date</th></tr></thead><tbody id="realTeacherAssignmentsBody"><tr><td colspan="4">Sign in as a teacher to load assignments…</td></tr></tbody></table></section><p class="modal-sub" style="margin-top:14px">Submission tracking and an approval workflow aren't built on the backend yet — this is every real assignment you've posted, nothing more.</p></section>`;
  }
  async function loadRealTeacherAssignments() {
    const tbody = document.getElementById('realTeacherAssignmentsBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';
    try {
      const arms = await window.SchoolOS.api('/portal/teacher/class-arms');
      if (!arms.length) { tbody.innerHTML = '<tr><td colspan="4">You are not assigned to any class yet.</td></tr>'; return; }
      const lists = await Promise.all(arms.map((a) => window.SchoolOS.api('/class-arms/' + a.id + '/assignments').then((list) => list.map((x) => ({ ...x, armLabel: a.schoolClassName + ' · ' + a.armName })))));
      const assignments = lists.flat();
      tbody.innerHTML = assignments.length ? assignments.map((a) => `<tr><td><strong>${a.title}</strong></td><td>${a.armLabel}</td><td>${a.subject ? a.subject.name : '—'}</td><td>${a.dueDate ? new Date(a.dueDate).toDateString() : '—'}</td></tr>`).join('') : '<tr><td colspan="4">No assignments posted yet.</td></tr>';
    } catch (err) { tbody.innerHTML = `<tr><td colspan="4">Could not load assignments (${err.message})</td></tr>`; }
  }
  function pageAssignments(label) { return currentRole === 'teacher' ? pageAssignmentsTeacher(label) : pageAssignmentsStudent(label); }
  async function openNewAssignmentRealModal() {
    const user = window.SchoolOS.getUser();
    let arms = [];
    try {
      if (user && user.role === 'TEACHER') { arms = await window.SchoolOS.api('/portal/teacher/class-arms'); }
      else { const classes = await window.SchoolOS.api('/classes'); arms = classes.flatMap((c) => (c.arms || []).map((a) => ({ id: a.id, schoolClassName: c.name, armName: a.name }))); }
    } catch (err) { window.SchoolOS.toast(`Could not load your classes (${err.message})`); return; }
    if (!arms.length) { window.SchoolOS.toast('No classes available to post to yet'); return; }
    const armByLabel = Object.fromEntries(arms.map((a) => [`${a.schoolClassName} · ${a.armName}`, a.id]));
    window.SchoolOS.formModal({
      eyebrow: 'Assignments', title: 'Post assignment', sub: 'Creates a real assignment via the SchoolOS API and notifies students and parents in that class.',
      fields: [{ name: 'classArm', label: 'Class', type: 'select', options: Object.keys(armByLabel) }, { name: 'title', label: 'Title', placeholder: 'e.g. Algebra worksheet' }, { name: 'description', label: 'Description', type: 'textarea', placeholder: 'What should students do?' }, { name: 'dueDate', label: 'Due date', type: 'date' }],
      submitLabel: 'Post assignment',
      onSubmit: async (d) => {
        const payload = { classArmId: armByLabel[d.classArm], title: (d.title || '').trim(), description: (d.description || '').trim(), dueDate: d.dueDate || undefined };
        if (!payload.classArmId || !payload.title || !payload.description) { window.SchoolOS.toast('Class, title and description are required'); return; }
        try { await window.SchoolOS.api('/assignments', { method: 'POST', body: JSON.stringify(payload) }); window.SchoolOS.toast(`${payload.title} posted`); loadRealTeacherAssignments(); } catch (err) { window.SchoolOS.toast(`Could not post assignment (${err.message})`); }
      },
    });
  }

  // ============ CBT Exams (mock, real interactive engine) ============
  const cbtExams = [
    { id: 'math-cbt', subject: 'Mathematics', title: 'Third term CBT — Algebra & Geometry', duration: '3 min', questions: 5, status: 'Not started' },
    { subject: 'English', title: 'Third term CBT — Comprehension', duration: '40 min', questions: 25, status: 'Not started' },
    { subject: 'Basic Science', title: 'Third term CBT — Living things', duration: '30 min', questions: 20, status: 'Completed', score: '16/20' },
    { subject: 'Social Studies', title: 'Third term CBT — Government', duration: '30 min', questions: 20, status: 'In progress' },
  ];
  const examQuestionBank = { 'math-cbt': { duration: 180, questions: [{ q: 'Solve for x: 2x + 5 = 17', options: ['x = 5', 'x = 6', 'x = 7', 'x = 8'], correct: 1 }, { q: 'What is the sum of interior angles in a triangle?', options: ['90°', '180°', '270°', '360°'], correct: 1 }, { q: 'Simplify: 3(x + 4) − 2x', options: ['x + 12', 'x + 4', '5x + 12', 'x − 12'], correct: 0 }, { q: 'The area of a circle with radius 7cm is (use π = 22/7)', options: ['154 cm²', '44 cm²', '22 cm²', '77 cm²'], correct: 0 }, { q: 'If y = 2x + 3 and x = 4, what is y?', options: ['9', '10', '11', '12'], correct: 2 }] } };
  function pageCbtExamsStudent(label) {
    return `<section class="page workspace-page" id="cbt-exams"><div class="page-heading"><div><p class="eyebrow">Computer-based tests</p><h1>${label}</h1><p class="subtitle">No CBT exam data source is built yet — this isn't showing you fake data.</p></div></div><section class="data-card"><div class="empty-state"><span class="mini-avatar">✓</span><h3>Not available yet</h3><p>CBT exams (questions, timed attempts, auto-grading) haven't been built on the backend — it's a real feature, not a quick wire-up. Ask if you'd like it built.</p></div></section></section>`;
  }
  const teacherExams = [{ title: 'Third term CBT — Algebra & Geometry', cls: 'JSS 2A', questions: 30, status: 'Published' }, { title: 'Mid-term mock test', cls: 'JSS 2A', questions: 15, status: 'Pending approval' }, { title: 'Quick quiz — Fractions', cls: 'JSS 2B', questions: 10, status: 'Draft' }];
  function pageCbtExamsTeacher(label) {
    const kpis = [['Published', '1', 'Live for students'], ['Pending approval', '1', 'Awaiting principal sign-off'], ['Drafts', '1', 'Question bank in progress'], ['Avg completion', '92%', 'Across published exams']];
    const actionFor = (e) => e.status === 'Draft' ? `<button class="outline-button" data-submit-teacher-exam="${e.title}">Submit for approval</button>` : e.status === 'Pending approval' ? '<span class="view-only-badge">Awaiting approval</span>' : `<button class="outline-button" data-view-exam-results="${e.title}">View results</button>`;
    const rows = teacherExams.map((e) => `<tr class="${e.rejectionReason ? 'row-flagged' : ''}"><td><strong>${e.title}</strong>${e.rejectionReason ? `<br><small class="reason-note">Sent back: ${e.rejectionReason}</small>` : ''}</td><td>${e.cls}</td><td>${e.questions} questions</td><td><span class="status ${e.status !== 'Published' ? 'pending' : ''}">${e.status}</span></td><td class="row-action">${actionFor(e)}</td></tr>`).join('');
    return `<section class="page workspace-page" id="cbt-exams"><div class="page-heading"><div><p class="eyebrow">Set & manage exams</p><h1>${label}</h1><p class="subtitle">Build CBT question sets for your classes. New exams are reviewed before they go live.</p></div><button class="new-button" data-modal="new-exam">+ New CBT exam</button></div><div class="screen-kpis">${kpis.map((s) => `<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('')}</div><section class="data-card"><table class="data-table"><thead><tr><th>Exam</th><th>Class</th><th>Length</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></section></section>`;
  }
  function pageCbtExam(label) { return currentRole === 'teacher' ? pageCbtExamsTeacher(label) : pageCbtExamsStudent(label); }
  let cbtState = null;
  function cbtRenderGrid() { const bank = examQuestionBank[cbtState.id]; document.getElementById('cbtQGrid').innerHTML = bank.questions.map((_, i) => `<button data-q="${i}" class="${i === cbtState.current ? 'current' : ''} ${cbtState.answers[i] !== null ? 'answered' : ''}">${i + 1}</button>`).join(''); }
  function cbtRenderQuestion() {
    const bank = examQuestionBank[cbtState.id], q = bank.questions[cbtState.current];
    document.getElementById('cbtQNum').textContent = `Question ${cbtState.current + 1} of ${bank.questions.length}`;
    document.getElementById('cbtQText').textContent = q.q;
    document.getElementById('cbtOptions').innerHTML = q.options.map((o, i) => `<button class="cbt-option ${cbtState.answers[cbtState.current] === i ? 'selected' : ''}" data-opt="${i}">${o}</button>`).join('');
    document.getElementById('cbtPrevBtn').disabled = cbtState.current === 0;
    document.getElementById('cbtNextBtn').textContent = cbtState.current === bank.questions.length - 1 ? 'Finish' : 'Next →';
    cbtRenderGrid();
  }
  function cbtRenderTimer() { const m = String(Math.floor(cbtState.remaining / 60)).padStart(2, '0'), s = String(cbtState.remaining % 60).padStart(2, '0'); document.getElementById('cbtTimer').textContent = `${m}:${s}`; }
  function cbtTick() { cbtState.remaining--; cbtRenderTimer(); if (cbtState.remaining <= 0) cbtSubmitExam(); }
  function startCbtExam(id) {
    const bank = examQuestionBank[id], exam = cbtExams.find((e) => e.id === id);
    if (!bank) return;
    cbtState = { id, answers: new Array(bank.questions.length).fill(null), current: 0, remaining: bank.duration, timer: null };
    document.getElementById('cbtExamSubject').textContent = exam.subject;
    document.getElementById('cbtExamTitle').textContent = exam.title;
    document.getElementById('cbtListView').style.display = 'none';
    document.getElementById('cbtResultView').style.display = 'none';
    document.getElementById('cbtRunner').style.display = 'block';
    cbtRenderQuestion(); cbtRenderTimer();
    cbtState.timer = setInterval(cbtTick, 1000);
  }
  function cbtSelectOption(i) { cbtState.answers[cbtState.current] = i; cbtRenderQuestion(); }
  function cbtGoTo(i) { cbtState.current = i; cbtRenderQuestion(); }
  function cbtNext() { const bank = examQuestionBank[cbtState.id]; if (cbtState.current < bank.questions.length - 1) { cbtState.current++; cbtRenderQuestion(); } else cbtSubmitExam(); }
  function cbtPrev() { if (cbtState.current > 0) { cbtState.current--; cbtRenderQuestion(); } }
  function cbtSubmitExam() {
    clearInterval(cbtState.timer);
    const bank = examQuestionBank[cbtState.id], total = bank.questions.length, correct = bank.questions.filter((q, i) => cbtState.answers[i] === q.correct).length, pct = Math.round(correct / total * 100);
    document.getElementById('cbtRunner').style.display = 'none';
    const rv = document.getElementById('cbtResultView');
    rv.style.display = 'block';
    rv.innerHTML = `<section class="data-card cbt-result-card"><p class="eyebrow">Exam submitted</p><h2>${correct} / ${total} correct</h2><div class="cbt-score-bar"><span style="width:${pct}%"></span></div><p class="cbt-score-note">${pct >= 50 ? 'Well done — you passed.' : 'Keep practising — review the topics you missed.'}</p><button class="new-button" id="cbtBackBtn">Back to exams</button></section>`;
    cbtState = null;
  }
  function openNewExamModal() {
    window.SchoolOS.openModal(`<p class="eyebrow">CBT Exams</p><h2>New CBT exam</h2><p class="modal-sub">Add your questions below — each needs 4 options and a correct answer.</p>
      <form onsubmit="__examSubmit(event)">
        <div class="form-row"><div class="form-field"><label>Exam title</label><input name="title" placeholder="e.g. Mid-term mock test"></div><div class="form-field"><label>Class</label><select name="cls">${['JSS 2A', 'JSS 2B', 'JSS 3B', 'SS 1A'].map((c) => `<option>${c}</option>`).join('')}</select></div></div>
        <div class="form-field"><label>Duration (minutes)</label><input name="duration" type="number" placeholder="30"></div>
        <div id="examQuestions" class="question-builder"></div>
        <button type="button" class="outline-button" id="addExamQuestionBtn">+ Add question</button>
        <div class="form-actions"><button type="button" class="outline-button" data-modal-close>Cancel</button><button type="submit" class="new-button">Save as draft</button></div>
      </form>`);
    let qCount = 0;
    const addQ = () => {
      qCount++;
      const box = document.createElement('div'); box.className = 'question-block';
      box.innerHTML = `<p class="question-label">Question ${qCount}</p><input placeholder="Question text" class="eq-text"><div class="form-row"><input placeholder="Option A" class="eq-opt"><input placeholder="Option B" class="eq-opt"></div><div class="form-row"><input placeholder="Option C" class="eq-opt"><input placeholder="Option D" class="eq-opt"></div><select class="eq-correct"><option value="0">Correct: A</option><option value="1">Correct: B</option><option value="2">Correct: C</option><option value="3">Correct: D</option></select>`;
      document.getElementById('examQuestions').appendChild(box);
    };
    document.getElementById('addExamQuestionBtn').addEventListener('click', addQ);
    addQ();
    window.__examSubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const title = fd.get('title') || 'Untitled exam', cls = fd.get('cls');
      const blocks = document.querySelectorAll('#examQuestions .question-block');
      const questions = Array.from(blocks).map((b) => ({ q: b.querySelector('.eq-text').value || 'Untitled question', options: Array.from(b.querySelectorAll('.eq-opt')).map((o) => o.value || 'Option'), correct: Number(b.querySelector('.eq-correct').value) }));
      teacherExams.push({ title, cls, questions: questions.length, status: 'Draft', questionBank: questions });
      window.SchoolOS.closeModal();
      renderRoleSections(currentRole);
      window.SchoolOS.toast(`Draft saved · ${title} (${questions.length} question${questions.length === 1 ? '' : 's'})`);
    };
  }
  function submitTeacherExam(title) {
    const e = teacherExams.find((x) => x.title === title); if (!e) return;
    e.status = 'Pending approval'; delete e.rejectionReason;
    renderRoleSections(currentRole);
    window.SchoolOS.toast(`Submitted for approval · ${title}`);
  }
  function openOwnExamResultModal(title) {
    const e = cbtExams.find((x) => x.title === title); if (!e) return;
    window.SchoolOS.detailModal({ eyebrow: e.subject, title: e.title, rows: [['Your score', e.score || '—'], ['Class average', '78%'], ['Questions', String(e.questions)]] });
  }
  function openExamResultsModal(title) {
    window.SchoolOS.detailModal({ eyebrow: 'Exam results', title, rows: [['Average score', '78%'], ['Highest score', '96%'], ['Lowest score', '42%'], ['Completion rate', '92%']] });
  }

  // ============ Lessons ============
  // No Lesson model exists anywhere in the backend (checked the Prisma
  // schema and every module — nothing) — there is no real data to show
  // for any role here, so this is an honest "Coming soon" for everyone,
  // same as pageContentApprovals below.
  function pageLessons(label) {
    return `<section class="page workspace-page" id="lessons"><div class="page-heading"><div><p class="eyebrow">Lessons</p><h1>${label}</h1><p class="subtitle">No lesson/resource data source is built yet — this isn't showing you fake data.</p></div></div><section class="data-card"><div class="empty-state"><span class="mini-avatar">▤</span><h3>Coming soon</h3><p>Lesson notes and resources haven't been built on the backend at all yet. Assignments (with attached resource links) already work — check that page instead.</p></div></section></section>`;
  }

  // ============ Content Approvals (stub) ============
  function pageContentApprovals(label) {
    return `<section class="page workspace-page" id="content-approvals"><div class="page-heading"><div><p class="eyebrow">Academic content</p><h1>${label}</h1><p class="subtitle">No approval workflow is built yet — this isn't showing you fake data.</p></div></div><section class="data-card"><div class="empty-state"><span class="mini-avatar">✓</span><h3>Coming soon</h3><p>Assignments post directly today (see Assignments) — a review/approval step before publishing hasn't been built on the backend. CBT exams have no data source at all yet.</p></div></section></section>`;
  }

  // ============ Timetable (standalone, teacher / student) ============
  function pageTimetable(label) {
    if (currentRole === 'student') {
      return `<section class="page workspace-page" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">My timetable</p><h1>${label}</h1><p class="subtitle">No timetable data source is built yet — this isn't showing you fake data.</p></div></div><section class="data-card"><div class="empty-state"><span class="mini-avatar">▤</span><h3>Not available yet</h3><p>Timetable scheduling hasn't been built on the backend. When it is, this page will show your real weekly schedule.</p></div></section></section>`;
    }
    if (currentRole === 'teacher') {
      const cls = teacherClassMap['Tunde Bello']?.cls || 'JSS 2A';
      const grid = classTimetables[cls] || classTimetables['JSS 2A'];
      const ttRows = timetablePeriods.map((p, r) => `<tr><td class="tt-period">${p}</td>${timetableDays.map((d, c) => `<td class="${grid[r][c].startsWith('—') ? 'tt-break' : ''}">${grid[r][c]}</td>`).join('')}</tr>`).join('');
      return `<section class="page workspace-page" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">My timetable</p><h1>${label}</h1><p class="subtitle">${cls} · Third term. Set by the academic team.</p></div></div><section class="data-card"><table class="data-table timetable-grid"><thead><tr><th></th>${timetableDays.map((d) => `<th>${d}</th>`).join('')}</tr></thead><tbody>${ttRows}</tbody></table></section></section>`;
    }
    return window.SchoolOS.renderGenericPage(label);
  }

  // ============ Student's own Classes / Notices / Profile ============
  function pageStudentClasses(label) {
    return `<section class="page workspace-page" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">My classes</p><h1>${label}</h1><p class="subtitle">Live from the API — subjects and teachers for your class.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Subject</th><th>Teacher</th></tr></thead><tbody id="realStudentSubjectsBody"><tr><td colspan="2">Sign in as a student to load subjects…</td></tr></tbody></table></section></section>`;
  }
  function pageStudentNoticesReal(label) {
    return `<section class="page workspace-page" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Real in-app notifications for your account.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Notice</th><th>When</th><th></th></tr></thead><tbody id="realStudentNoticesBody"><tr><td colspan="3">Sign in as a student to load notices…</td></tr></tbody></table></section></section>`;
  }
  function pageStudentProfileReal(label) {
    return `<section class="page workspace-page" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Your real student record.</p></div></div><section class="data-card" id="realStudentProfileCard"><p>Sign in as a student to load your profile…</p></section></section>`;
  }
  async function loadRealStudentPortalData() {
    const resultsBody = document.getElementById('realStudentResultsBody');
    const assignmentsBody = document.getElementById('realStudentAssignmentsBody');
    const subjectsBody = document.getElementById('realStudentSubjectsBody');
    const noticesBody = document.getElementById('realStudentNoticesBody');
    const profileCard = document.getElementById('realStudentProfileCard');
    if (!resultsBody && !assignmentsBody && !subjectsBody && !noticesBody && !profileCard) return;

    const user = window.SchoolOS.getUser();
    const isRealStudent = !!(user && user.role === 'STUDENT' && window.SchoolOS.getAccessToken());
    if (!isRealStudent) {
      const msg = 'Sign in as a real student account to see live data.';
      if (resultsBody) resultsBody.innerHTML = `<tr><td colspan="6">${msg}</td></tr>`;
      if (assignmentsBody) assignmentsBody.innerHTML = `<tr><td colspan="3">${msg}</td></tr>`;
      if (subjectsBody) subjectsBody.innerHTML = `<tr><td colspan="2">${msg}</td></tr>`;
      if (noticesBody) noticesBody.innerHTML = `<tr><td colspan="3">${msg}</td></tr>`;
      if (profileCard) profileCard.innerHTML = `<p>${msg}</p>`;
      return;
    }

    if (subjectsBody) {
      subjectsBody.innerHTML = '<tr><td colspan="2">Loading…</td></tr>';
      try { const subjects = await window.SchoolOS.api('/portal/student/subjects'); subjectsBody.innerHTML = subjects.length ? subjects.map((s) => `<tr><td><strong>${s.subject?.name || '—'}</strong></td><td>${s.staffProfile?.user ? s.staffProfile.user.firstName + ' ' + s.staffProfile.user.lastName : '—'}</td></tr>`).join('') : '<tr><td colspan="2">No subjects assigned to your class yet.</td></tr>'; } catch (err) { subjectsBody.innerHTML = `<tr><td colspan="2">Could not load subjects (${err.message})</td></tr>`; }
    }
    if (noticesBody) {
      noticesBody.innerHTML = '<tr><td colspan="3">Loading…</td></tr>';
      try { const notices = await window.SchoolOS.api('/notifications/me'); noticesBody.innerHTML = notices.length ? notices.map((n) => `<tr><td><strong>${n.title}</strong><br><small>${n.body}</small></td><td>${new Date(n.createdAt).toLocaleString()}</td><td>${n.readAt ? '<span class="status">Read</span>' : '<span class="status pending">Unread</span>'}</td></tr>`).join('') : '<tr><td colspan="3">No notices yet.</td></tr>'; } catch (err) { noticesBody.innerHTML = `<tr><td colspan="3">Could not load notices (${err.message})</td></tr>`; }
    }
    if (profileCard) {
      profileCard.innerHTML = '<p>Loading…</p>';
      try {
        const p = await window.SchoolOS.api('/portal/student/me');
        const cls = p.currentClassArm ? `${p.currentClassArm.schoolClass.name} · ${p.currentClassArm.name}` : 'Not yet assigned to a class';
        const guardians = p.guardianLinks.length ? p.guardianLinks.map((g) => `${g.guardian.firstName} ${g.guardian.lastName} (${g.relationship.toLowerCase()})`).join(', ') : 'No guardian linked yet';
        profileCard.innerHTML = `<div class="modal-detail"><div class="modal-detail-row"><span>Name</span><strong>${p.firstName} ${p.lastName}</strong></div><div class="modal-detail-row"><span>Admission No.</span><strong>${p.admissionNo}</strong></div><div class="modal-detail-row"><span>Class</span><strong>${cls}</strong></div><div class="modal-detail-row"><span>Status</span><strong>${p.status}</strong></div><div class="modal-detail-row"><span>Gender</span><strong>${p.gender || '—'}</strong></div><div class="modal-detail-row"><span>Date of birth</span><strong>${p.dateOfBirth ? new Date(p.dateOfBirth).toDateString() : '—'}</strong></div><div class="modal-detail-row"><span>Guardian(s)</span><strong>${guardians}</strong></div></div>`;
      } catch (err) { profileCard.innerHTML = `<p>Could not load profile (${err.message})</p>`; }
    }
    if (resultsBody) {
      resultsBody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';
      try { const results = await window.SchoolOS.api('/portal/student/results'); resultsBody.innerHTML = results.length ? results.map((r) => `<tr><td>${r.subject?.name || '—'}</td><td>${r.term?.name || '—'}</td><td>${r.continuousAssessmentScore ?? '—'}</td><td>${r.examScore ?? '—'}</td><td>${r.totalScore ?? '—'}</td><td>${r.grade || '—'}</td></tr>`).join('') : '<tr><td colspan="6">No published results yet.</td></tr>'; } catch (err) { resultsBody.innerHTML = `<tr><td colspan="6">Could not load results (${err.message})</td></tr>`; }
    }
    if (assignmentsBody) {
      assignmentsBody.innerHTML = '<tr><td colspan="3">Loading…</td></tr>';
      try { const assignments = await window.SchoolOS.api('/portal/student/assignments'); assignmentsBody.innerHTML = assignments.length ? assignments.map((a) => `<tr><td><strong>${a.title}</strong></td><td>${a.description}</td><td>${a.dueDate ? new Date(a.dueDate).toDateString() : '—'}</td></tr>`).join('') : '<tr><td colspan="3">No assignments posted yet.</td></tr>'; } catch (err) { assignmentsBody.innerHTML = `<tr><td colspan="3">Could not load assignments (${err.message})</td></tr>`; }
    }
  }

  // ============ Section orchestration (mirrors the old SPA's workspacePages) ============
  const bespokePages = {
    academics: pageAcademics, teachers: pageTeachersReal, 'content-approvals': pageContentApprovals,
    lessons: pageLessons, timetable: pageTimetable, results: pageResults, assignments: pageAssignments,
    'cbt-exams': pageCbtExam, classes: pageStudentClasses, notices: pageStudentNoticesReal, profile: pageStudentProfileReal,
    'my-classes': pageMyClassesTeacher,
  };

  function renderRoleSections(role) {
    const items = ITEMS_BY_ROLE[role] || [];
    const tabsEl = document.getElementById('academicsOuterTabs');
    const sectionsEl = document.getElementById('academicsSections');
    tabsEl.style.display = items.length > 1 ? 'flex' : 'none';
    tabsEl.innerHTML = items.map((item, i) => `<button data-tab="${window.SchoolOS.slug(item)}" class="${i === 0 ? 'active' : ''}">${item}</button>`).join('');
    sectionsEl.innerHTML = items.map((item) => {
      const s = window.SchoolOS.slug(item);
      return bespokePages[s] ? bespokePages[s](item) : window.SchoolOS.renderGenericPage(item);
    }).join('');
    bindTabs();

    const wanted = location.hash ? location.hash.slice(1) : (items[0] ? window.SchoolOS.slug(items[0]) : '');
    showTab(document.getElementById(wanted) ? wanted : (items[0] ? window.SchoolOS.slug(items[0]) : ''));

    // Fire every loader — each is individually DOM-guarded, matching the
    // original SPA's "run them all on every render" pattern.
    loadRealTeachers(); loadRealClasses(); loadRealSubjects(); loadRealAcademicsResults();
    loadRealTeacherResults(); loadRealParentResults(); loadRealTeacherAssignments(); loadRealStudentPortalData();
    loadRealMyClasses();
  }
  function showTab(id) {
    document.querySelectorAll('#academicsSections .workspace-page').forEach((p) => p.classList.toggle('visible', p.id === id));
    document.querySelectorAll('#academicsOuterTabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
  }

  function renderForRole(role) {
    currentRole = role;
    renderRoleSections(role);
  }

  window.SchoolOS.modalOpeners = Object.assign(window.SchoolOS.modalOpeners || {}, {
    'new-teacher': openNewTeacherModal, 'new-class': openNewClassModal, 'new-subject': openNewSubjectModal,
    'add-marks': openAddMarksModal, 'new-assignment-real': openNewAssignmentRealModal, 'new-timetable': openNewTimetableModal,
    'new-exam': openNewExamModal,
  });

  document.addEventListener('click', (e) => {
    const outerTab = e.target.closest('#academicsOuterTabs button');
    if (outerTab) { showTab(outerTab.dataset.tab); history.replaceState(null, '', '#' + outerTab.dataset.tab); }
    const gt = e.target.closest('[data-goto-tab]'); if (gt) { const tb = document.querySelector('.workspace-page.visible [data-tab="' + gt.dataset.gotoTab + '"]'); if (tb) tb.click(); }
    const addArm = e.target.closest('[data-add-arm]'); if (addArm) openNewClassArmModal(addArm.dataset.addArm);
    const viewClass = e.target.closest('[data-view-class]'); if (viewClass) openClassDetailModal(viewClass.dataset.viewClass);
    const viewTeacher = e.target.closest('[data-view-teacher]'); if (viewTeacher) openTeacherDetailModal(viewTeacher.dataset.viewTeacher);
    const submitResultBtn = e.target.closest('[data-submit-result]'); if (submitResultBtn) submitResult(submitResultBtn.dataset.submitResult);
    const approveBtn = e.target.closest('[data-approve-real-result]'); if (approveBtn) approveRealResult(approveBtn.dataset.approveRealResult);
    const publishBtn = e.target.closest('[data-publish-real-result]'); if (publishBtn) publishRealResult(publishBtn.dataset.publishRealResult);
    const eg = e.target.closest('[data-edit-grade]'); if (eg) openEditGradeModal(eg.dataset.editGrade);
    const ec = e.target.closest('[data-edit-cell]'); if (ec) { const [r, c] = ec.dataset.editCell.split(',').map(Number); openEditTimetableCellModal(r, c); }
    const ste = e.target.closest('[data-submit-teacher-exam]'); if (ste) submitTeacherExam(ste.dataset.submitTeacherExam);
    const ver = e.target.closest('[data-view-exam-results]'); if (ver) openExamResultsModal(ver.dataset.viewExamResults);
    const vor = e.target.closest('[data-view-own-result]'); if (vor) openOwnExamResultModal(vor.dataset.viewOwnResult);
    const start = e.target.closest('[data-cbt-start]'); if (start) startCbtExam(start.dataset.cbtStart);
    const opt = e.target.closest('.cbt-option'); if (opt) cbtSelectOption(Number(opt.dataset.opt));
    const qbtn = e.target.closest('#cbtQGrid button'); if (qbtn) cbtGoTo(Number(qbtn.dataset.q));
    if (e.target.closest('#cbtNextBtn')) cbtNext();
    if (e.target.closest('#cbtPrevBtn')) cbtPrev();
    if (e.target.closest('#cbtSubmitBtn')) cbtSubmitExam();
    if (e.target.closest('#cbtBackBtn')) { document.getElementById('cbtResultView').style.display = 'none'; document.getElementById('cbtListView').style.display = ''; }
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'timetableClassSelect') selectTimetableClass(e.target.value); });

  window.SchoolOS.ready.then((role) => {
    if (!role) return;
    window.SchoolOS.onRoleChange = renderForRole;
    window.SchoolOS.onCreateNew = () => {
      const visible = document.querySelector('#academicsSections .workspace-page.visible');
      const id = visible ? visible.id : '';
      if (id === 'academics') openNewClassModal();
      else if (id === 'academics-teachers' || id === 'teachers') openNewTeacherModal();
      else if (id === 'assignments' && currentRole === 'teacher') openNewAssignmentRealModal();
      else if (id === 'cbt-exams' && currentRole === 'teacher') openNewExamModal();
      else window.SchoolOS.toast('Open a tab that supports creating a record');
    };
    renderForRole(role);
  });
})();
