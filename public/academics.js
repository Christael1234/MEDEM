// Academics module, everything academic-cluster: Academics (timetable/
// marks/results/grading-scale/classes/subjects), Teachers, Results,
// Assignments, CBT Exams, Lessons, Content Approvals, standalone
// Timetable, and the student's own Classes/Notices/Profile. These were
// separate top-level SPA pages sharing heavy role-branching logic, kept
// together here rather than split further, mirroring the original app's
// own show/hide-by-id pattern (all sections render, one is visible).
(function () {
  let currentRole = 'proprietor';

  // Which of this module's sections are relevant to each role, in nav
  // order; mirrors the academics-cluster subset of shared.js's `navs`.
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
    return `<section class="page workspace-page" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Staff</p><h1>${label}</h1><p class="subtitle">Real teaching staff for the signed-in tenant.</p></div>${addButton}</div><section class="data-card"><div class="data-toolbar"><span class="tt-class-label">Filter by level</span><select id="teachersLevelFilter" class="level-filter-select" aria-label="Filter teachers by level"><option value="">All levels</option>${Object.entries(LEVEL_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div><table class="data-table"><thead><tr><th>Teacher</th><th>Staff ID</th><th>Department</th><th>Login email</th><th></th></tr></thead><tbody id="realTeachersBody"><tr><td colspan="5">Sign in to load teachers…</td></tr></tbody></table></section></section>`;
  }
  async function openNewTeacherModal() {
    let campuses = [], classes = [], subjects = [];
    try {
      [campuses, classes, subjects] = await Promise.all([window.SchoolOS.api('/campuses'), window.SchoolOS.api('/classes'), window.SchoolOS.api('/subjects')]);
    } catch (err) { window.SchoolOS.toast(`Could not load campuses/classes/subjects (${err.message})`); return; }
    if (!campuses.length) { window.SchoolOS.toast('No campuses found for this tenant'); return; }
    const campusByName = Object.fromEntries(campuses.map((c) => [c.name, c.id]));
    const subjectByName = Object.fromEntries(subjects.map((s) => [s.name, s.id]));

    // Class-teacher candidates: only arms with no classTeacherId yet
    // (mirrors the server's own check), grouped by campus since a class
    // teacher should be based at their class's campus; the dropdown
    // re-filters when the Campus field changes, see below.
    const unassignedArmsByCampusId = {};
    classes.forEach((c) => {
      const openArms = (c.arms || []).filter((a) => !a.classTeacherId).map((a) => ({ id: a.id, label: `${c.name} · ${a.name}` }));
      if (openArms.length) (unassignedArmsByCampusId[c.campusId] ||= []).push(...openArms);
    });
    const armOptionsFor = (campusName) => unassignedArmsByCampusId[campusByName[campusName]] || [];

    window.SchoolOS.formModal({
      eyebrow: 'Teachers', title: 'Add teacher',
      sub: 'Optionally make them class teacher of one unassigned class at their campus, and/or the subject teacher for one or more classes.',
      fields: [
        { name: 'firstName', label: 'First name', placeholder: 'e.g. Amina' }, { name: 'lastName', label: 'Last name', placeholder: 'e.g. Yusuf' },
        { name: 'campus', label: 'Campus', type: 'select', options: campuses.map((c) => c.name) },
        { name: 'department', label: 'Department', placeholder: 'e.g. Academics' }, { name: 'position', label: 'Position', placeholder: 'e.g. Class Teacher' },
        { name: 'classArm', label: 'Class teacher of (optional)', type: 'select', options: ['None', ...armOptionsFor(campuses[0].name).map((a) => a.label)] },
        { name: 'subject', label: 'Subject to teach (optional)', type: 'select', options: ['None', ...subjects.map((s) => s.name)] },
        { name: 'classIds', label: 'Classes they teach this subject in', type: 'checkboxes', options: classes.map((c) => ({ value: c.id, label: c.name })) },
      ],
      submitLabel: 'Add teacher',
      onSubmit: async (d) => {
        const armByLabel = Object.fromEntries(armOptionsFor(d.campus).map((a) => [a.label, a.id]));
        const payload = {
          campusId: campusByName[d.campus], firstName: (d.firstName || '').trim(), lastName: (d.lastName || '').trim(),
          department: d.department || undefined, position: d.position || undefined,
          classArmId: d.classArm && d.classArm !== 'None' ? armByLabel[d.classArm] : undefined,
        };
        if (!payload.firstName || !payload.lastName || !payload.campusId) { window.SchoolOS.toast('First name, last name and campus are required'); return; }
        const chosenClassIds = [].concat(d.classIds || []);
        const subjectId = d.subject && d.subject !== 'None' ? subjectByName[d.subject] : null;
        if (chosenClassIds.length && !subjectId) { window.SchoolOS.toast('Select a subject to assign to those classes'); return; }
        const hasAnyAssignment = payload.classArmId || (subjectId && chosenClassIds.length);
        if (!hasAnyAssignment && !window.confirm(`${payload.firstName} ${payload.lastName} won't be a class teacher or assigned to teach any subject yet. Add them anyway?`)) return;
        try {
          const created = await window.SchoolOS.api('/staff-profiles/teachers', { method: 'POST', body: JSON.stringify(payload) });
          loadRealTeachers();
          const notes = [];
          if (payload.classArmId) notes.push(`class teacher of ${d.classArm}`);
          if (subjectId && chosenClassIds.length) {
            for (const schoolClassId of chosenClassIds) {
              await window.SchoolOS.api('/teacher-subject-assignments', { method: 'POST', body: JSON.stringify({ staffProfileId: created.id, schoolClassId, subjectId }) });
            }
            notes.push(`assigned ${d.subject} in ${chosenClassIds.length} class${chosenClassIds.length > 1 ? 'es' : ''}`);
          }
          window.SchoolOS.toast(`${payload.firstName} ${payload.lastName} added${notes.length ? ' · ' + notes.join(' · ') : ''}`);
          if (created && created.loginCredentials) {
            window.SchoolOS.detailModal({ eyebrow: 'Teachers', title: 'Login created', sub: `A teacher portal login was generated automatically for ${payload.firstName} ${payload.lastName}. Share these with them directly; they won't be shown again.`, rows: [['Email', created.loginCredentials.email], ['Password', created.loginCredentials.password]] });
          }
        } catch (err) { window.SchoolOS.toast(`Could not add teacher (${err.message})`); }
      },
    });

    const form = document.querySelector('.modal-overlay form');
    const campusSelect = form && form.querySelector('select[name="campus"]');
    const armSelect = form && form.querySelector('select[name="classArm"]');
    if (campusSelect && armSelect) {
      campusSelect.addEventListener('change', () => {
        armSelect.innerHTML = ['None', ...armOptionsFor(campusSelect.value).map((a) => a.label)].map((o) => `<option>${o}</option>`).join('');
      });
    }
  }
  let lastLoadedTeachers = [];
  let lastTeacherLevelsById = {};
  async function loadRealTeachers() {
    const tbody = document.getElementById('realTeachersBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="5">Loading teachers…</td></tr>';
    try {
      const [staff, classes] = await Promise.all([window.SchoolOS.api('/staff-profiles'), window.SchoolOS.api('/classes')]);
      lastLoadedTeachers = staff.filter((s) => s.user && s.user.role === 'TEACHER');

      // A teacher's level(s) come from two signals: being class teacher of
      // an arm (arm.classTeacherId, level via its class), or being the
      // subject teacher for a class (teacher-subject-assignments);
      // fetched per class since the list endpoint doesn't include them.
      const levelsById = {};
      const addLevel = (staffProfileId, level) => { (levelsById[staffProfileId] ||= new Set()).add(level); };
      classes.forEach((c) => (c.arms || []).forEach((a) => { if (a.classTeacherId) addLevel(a.classTeacherId, c.level); }));
      const assignmentsByClass = await Promise.all(classes.map((c) => window.SchoolOS.api(`/classes/${c.id}/teacher-subject-assignments`).catch(() => [])));
      classes.forEach((c, i) => assignmentsByClass[i].forEach((a) => addLevel(a.staffProfileId, c.level)));
      lastTeacherLevelsById = Object.fromEntries(Object.entries(levelsById).map(([k, v]) => [k, [...v]]));

      renderTeachersTable();
    } catch (err) { tbody.innerHTML = `<tr><td colspan="5">Could not load teachers (${err.message})</td></tr>`; }
  }
  function renderTeachersTable() {
    const tbody = document.getElementById('realTeachersBody');
    if (!tbody) return;
    const filterSelect = document.getElementById('teachersLevelFilter');
    const level = filterSelect ? filterSelect.value : '';
    const teachers = level ? lastLoadedTeachers.filter((s) => (lastTeacherLevelsById[s.id] || []).includes(level)) : lastLoadedTeachers;
    tbody.innerHTML = teachers.length ? teachers.map((s) => `<tr><td><div class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(s.user.firstName + ' ' + s.user.lastName)}</span>${s.user.firstName} ${s.user.lastName}</div></td><td>${s.staffId}</td><td>${s.department || '—'}</td><td>${s.user.email}</td><td class="row-action"><button class="outline-button" data-view-teacher="${s.id}">View</button></td></tr>`).join('') : `<tr><td colspan="5">No teachers${level ? ' at this level' : ''} yet.</td></tr>`;
  }
  async function openTeacherDetailModal(staffProfileId, editMode) {
    editMode = !!editMode;
    let t, subjects = [], classes = [];
    try {
      [t, subjects, classes] = await Promise.all([
        window.SchoolOS.api('/staff-profiles/' + staffProfileId),
        window.SchoolOS.api('/subjects'),
        window.SchoolOS.api('/classes'),
      ]);
    } catch (err) { window.SchoolOS.toast(`Could not load teacher (${err.message})`); return; }
    const user = window.SchoolOS.getUser();
    const canManage = user && (user.role === 'PROPRIETOR' || user.role === 'PRINCIPAL');
    const canEditNow = canManage && editMode;
    const ledHtml = (t.classArmsLed || []).map((a) => `<div class="modal-detail-row"><span>${a.name}</span><strong>${a.schoolClass.name}</strong></div>`).join('') || '<p class="modal-sub" style="margin:0">Not a class teacher for any arm.</p>';
    const taughtHtml = (t.teacherAssignments || []).map((a) => `<div class="modal-detail-row"><span>${a.subject.name}</span><strong>${a.schoolClass.name}</strong>${canEditNow ? ` <button type="button" class="outline-button" data-remove-assignment="${a.id}" data-subject-name="${a.subject.name}" data-class-name="${a.schoolClass.name}" data-teacher-name="${t.user.firstName} ${t.user.lastName}">Remove</button>` : ''}</div>`).join('') || '<p class="modal-sub" style="margin:0">No subjects assigned yet.</p>';

    const subjectByName = Object.fromEntries(subjects.map((sj) => [sj.name, sj.id]));
    const classByName = Object.fromEntries(classes.map((c) => [c.name, c.id]));

    window.__renameTeacherSubmit = async (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      try {
        await window.SchoolOS.api('/staff-profiles/' + staffProfileId, { method: 'PATCH', body: JSON.stringify({ firstName: data.get('firstName'), lastName: data.get('lastName'), department: data.get('department'), position: data.get('position') }) });
        window.SchoolOS.toast('Teacher updated'); loadRealTeachers(); window.SchoolOS.closeModal();
      } catch (err) { window.SchoolOS.toast(`Could not update teacher (${err.message})`); }
    };
    window.__addAssignmentSubmit = async (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      const subjectId = subjectByName[data.get('subject')];
      const schoolClassId = classByName[data.get('cls')];
      if (!subjectId || !schoolClassId) { window.SchoolOS.toast('Choose a subject and a class'); return; }
      try {
        await window.SchoolOS.api('/teacher-subject-assignments', { method: 'POST', body: JSON.stringify({ staffProfileId, schoolClassId, subjectId }) });
        window.SchoolOS.toast('Subject assignment added'); loadRealTeachers(); window.SchoolOS.closeModal();
      } catch (err) { window.SchoolOS.toast(`Could not add assignment (${err.message})`); }
    };
    const editToggleBtn = canManage
      ? (editMode
          ? `<button type="button" class="outline-button" data-cancel-edit-teacher="${staffProfileId}">Cancel</button>`
          : `<button type="button" class="outline-button" data-edit-teacher="${staffProfileId}"><i class="fa-solid fa-pen"></i> Edit</button>`)
      : '';
    window.SchoolOS.openModal(`<p class="eyebrow">Teachers</p><div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><h2 style="margin:0">Teacher details</h2>${editToggleBtn}</div>
      ${canEditNow ? `<form onsubmit="__renameTeacherSubmit(event)">
        <div class="inline-edit-row"><input name="firstName" value="${t.user.firstName}" aria-label="First name"><input name="lastName" value="${t.user.lastName}" aria-label="Last name"></div>
        <div class="inline-edit-row"><input name="department" value="${t.department || ''}" placeholder="Department" aria-label="Department"><input name="position" value="${t.position || ''}" placeholder="Position" aria-label="Position"></div>
        <div class="form-actions" style="margin-top:10px"><button type="submit" class="new-button">Save changes</button></div>
      </form>` : `<p class="modal-sub">${t.user.firstName} ${t.user.lastName} · ${t.department || '—'} · ${t.position || '—'}</p>`}
      <div class="modal-detail-row"><span>Staff ID</span><strong>${t.staffId}</strong></div>
      <div class="modal-detail-row"><span>Login email</span><strong>${t.user.email}</strong></div>
      <div class="detail-section"><p class="eyebrow">Class teacher (homeroom) for</p>${ledHtml}<p class="modal-sub" style="margin:8px 0 0">Change this from Academics → Classes → the class in question.</p></div>
      <div class="detail-section"><p class="eyebrow">Subjects taught</p>${taughtHtml}
        ${canEditNow ? `<form class="inline-edit-row" style="margin-top:10px" onsubmit="__addAssignmentSubmit(event)"><select name="subject" aria-label="Subject to add">${subjects.map((sj) => `<option>${sj.name}</option>`).join('')}</select><select name="cls" aria-label="Class to add">${classes.map((c) => `<option>${c.name}</option>`).join('')}</select><button type="submit" class="outline-button">+ Add</button></form>` : ''}
      </div>
      <div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>`);
  }
  async function removeTeacherAssignment(assignmentId) {
    try {
      await window.SchoolOS.api('/teacher-subject-assignments/' + assignmentId, { method: 'DELETE' });
      window.SchoolOS.toast('Subject assignment removed');
      loadRealTeachers();
      window.SchoolOS.closeModal();
    } catch (err) { window.SchoolOS.toast(`Could not remove assignment (${err.message})`); }
  }

  // ============ My Classes (real, teacher) ============
  // Two real, independent views of the same underlying scope: the
  // subjects a teacher is assigned to teach (TeacherSubjectAssignment,
  // at the SchoolClass level) and the actual class arms that scope
  // covers (what Attendance/Assignments/Results already restrict them
  // to). Teachers only ever had a generic mock page here before.
  function pageMyClassesTeacher(label) {
    return `<section class="page workspace-page" id="my-classes"><div class="page-heading"><div><p class="eyebrow">Teaching</p><h1>${label}</h1><p class="subtitle">The subjects and classes you're assigned to teach.</p></div></div><section class="data-card"><div class="data-toolbar"><span class="tt-class-label">Subjects you teach</span></div><table class="data-table"><thead><tr><th>Subject</th><th>Class</th></tr></thead><tbody id="realMyClassesSubjectsBody"><tr><td colspan="2">Loading…</td></tr></tbody></table></section><section class="data-card" style="margin-top:14px"><div class="data-toolbar"><span class="tt-class-label">Class arms in your scope</span></div><table class="data-table"><thead><tr><th>Class</th><th>Arm</th></tr></thead><tbody id="realMyClassesArmsBody"><tr><td colspan="2">Loading…</td></tr></tbody></table></section></section>`;
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
  // Timetable is real, generated data (POST /timetable/generate runs a
  // conflict-free scheduler server-side), no client-side mock state here.
  // `timetableSelectedArm` tracks the picked class-arm per rendering
  // context (the Academics-tab picker and the standalone Timetable tab can
  // both be in the DOM at once for PRINCIPAL, so each needs its own scope).
  const timetableSelectedArm = {};

  /** Periods and admin-configured breaks (Timetable Settings) are
   * interleaved by clock time, not shown as fixed trailing rows: a break
   * can fall anywhere in the day now, not just at the end. A Nursery
   * arm's `data.periods` is only as long as its own subject count (see
   * TimetableService.generate), so its grid simply has fewer period rows
   * than a Junior/Senior one; the same table markup handles both. */
  function timetableGridHtml(data, cellFn) {
    if (!data) return '<p class="modal-sub">Loading…</p>';
    const byKey = {};
    (data.slots || []).forEach((s) => { byKey[`${s.dayOfWeek}-${s.periodIndex}`] = s; });
    const rows = [
      ...(data.periods || []).map((p) => ({ sortKey: p.startTime, kind: 'period', p })),
      ...(data.breaks || []).map((b) => ({ sortKey: b.startTime, kind: 'break', b })),
    ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    const rowsHtml = rows.map((r) => {
      if (r.kind === 'break') {
        return `<tr><td class="tt-period">${r.b.startTime}–${r.b.endTime}</td>${data.days.map(() => `<td class="tt-break">${r.b.label}</td>`).join('')}</tr>`;
      }
      const p = r.p;
      const cells = data.days.map((d) => {
        const s = byKey[`${d.value}-${p.index}`];
        return `<td>${s ? cellFn(s) : '<span class="tt-empty">Free</span>'}</td>`;
      }).join('');
      return `<tr><td class="tt-period">P${p.index + 1} · ${p.startTime}</td>${cells}</tr>`;
    }).join('');
    return `<table class="data-table timetable-grid"><thead><tr><th></th>${data.days.map((d) => `<th>${d.label.slice(0, 3)}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
  }
  const classArmCellFn = (s) => `${s.subjectName}<br><small>${s.teacherName}</small>`;
  const teacherCellFn = (s) => `${s.subjectName}<br><small>${s.className} · ${s.armName}</small>`;

  async function loadTimetableGridByFetch(containerId, apiPath, cellFn) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<p class="modal-sub">Loading…</p>';
    try { el.innerHTML = timetableGridHtml(await window.SchoolOS.api(apiPath), cellFn); } catch (err) { el.innerHTML = `<p class="modal-sub">Could not load timetable (${err.message})</p>`; }
  }

  /** Renders the class-arm picker + generate button + grid used by both
   * the Academics tab's Timetable panel (scope 'academics') and
   * PRINCIPAL's standalone Timetable tab (scope 'ttStandalone'). */
  async function renderAdminTimetableSection(scope) {
    const container = document.getElementById(`${scope}TimetableContainer`);
    if (!container || !window.SchoolOS.getAccessToken()) return;
    container.innerHTML = '<p class="modal-sub">Loading…</p>';
    let arms = [];
    try {
      const classes = await window.SchoolOS.api('/classes');
      arms = classes.flatMap((c) => (c.arms || []).map((a) => ({ id: a.id, label: `${c.name} · ${a.name}` })));
    } catch (err) { container.innerHTML = `<p class="modal-sub">Could not load classes (${err.message})</p>`; return; }
    if (!arms.length) { container.innerHTML = '<p class="modal-sub">No classes yet, add a class and arm first.</p>'; return; }
    if (!timetableSelectedArm[scope] || !arms.some((a) => a.id === timetableSelectedArm[scope])) timetableSelectedArm[scope] = arms[0].id;
    const canManage = currentRole === 'proprietor' || currentRole === 'principal';
    container.innerHTML = `<div class="data-toolbar"><select data-timetable-arm-select="${scope}" aria-label="Select class timetable">${arms.map((a) => `<option value="${a.id}" ${a.id === timetableSelectedArm[scope] ? 'selected' : ''}>${a.label}</option>`).join('')}</select>${canManage ? `<button class="outline-button" data-open-timetable-settings>Break times…</button><button class="new-button" data-generate-timetable="${scope}">Generate timetable</button>` : ''}</div><div id="${scope}TimetableGrid"></div>`;
    await loadTimetableGridByFetch(`${scope}TimetableGrid`, `/timetable/class-arm/${timetableSelectedArm[scope]}`, classArmCellFn);
  }

  /** Admin sets the day's break windows (and, if needed, its start/end)
   * BEFORE generating: Generate always rebuilds from whatever's saved
   * here at that moment (TimetableService.generate reads settings fresh
   * every time). Periods are always 30 minutes each; that's not
   * configurable, only where the breaks fall within the day is. */
  let timetableBreaksDraft = [];
  async function openTimetableSettingsModal() {
    let settings;
    try { settings = await window.SchoolOS.api('/timetable/settings'); } catch (err) { window.SchoolOS.toast(`Could not load timetable settings (${err.message})`); return; }
    timetableBreaksDraft = (settings.breaks || []).map((b) => ({ label: b.label, startTime: b.startTime, endTime: b.endTime }));

    const render = () => {
      window.SchoolOS.openModal(`<p class="eyebrow">Timetable</p><h2>Break times</h2>
        <p class="modal-sub">Every period is 30 minutes. Set the school day's start/end and its break windows here before generating: the generator skips over these rather than scheduling a class across them.</p>
        <div class="inline-edit-row"><div class="form-field"><label>Day starts</label><input type="time" id="ttDayStart" value="${settings.dayStartTime}"></div><div class="form-field"><label>Day ends</label><input type="time" id="ttDayEnd" value="${settings.dayEndTime}"></div></div>
        <div class="detail-section"><p class="eyebrow">Breaks</p><div id="ttBreaksList">${breaksListHtml()}</div><button type="button" class="outline-button" id="ttAddBreakBtn">+ Add break</button></div>
        <div class="form-actions"><button type="button" class="outline-button" data-modal-close>Cancel</button><button type="button" class="new-button" id="ttSaveSettingsBtn">Save</button></div>`);
      document.getElementById('ttAddBreakBtn').addEventListener('click', () => {
        timetableBreaksDraft.push({ label: '', startTime: '', endTime: '' });
        document.getElementById('ttBreaksList').innerHTML = breaksListHtml();
        wireBreakRows();
      });
      wireBreakRows();
      document.getElementById('ttSaveSettingsBtn').addEventListener('click', saveTimetableSettings);
    };
    const breaksListHtml = () => timetableBreaksDraft.length
      ? timetableBreaksDraft.map((b, i) => `<div class="inline-edit-row" data-break-row="${i}"><input placeholder="Label (e.g. Short break)" value="${b.label}" data-break-field="label" data-break-index="${i}"><input type="time" value="${b.startTime}" data-break-field="startTime" data-break-index="${i}"><input type="time" value="${b.endTime}" data-break-field="endTime" data-break-index="${i}"><button type="button" class="outline-button" data-remove-break="${i}">✕</button></div>`).join('')
      : '<p class="modal-sub" style="margin:0">No breaks configured yet.</p>';
    const wireBreakRows = () => {
      document.querySelectorAll('[data-break-field]').forEach((el) => {
        el.addEventListener('input', () => { timetableBreaksDraft[Number(el.dataset.breakIndex)][el.dataset.breakField] = el.value; });
      });
      document.querySelectorAll('[data-remove-break]').forEach((el) => {
        el.addEventListener('click', () => {
          timetableBreaksDraft.splice(Number(el.dataset.removeBreak), 1);
          document.getElementById('ttBreaksList').innerHTML = breaksListHtml();
          wireBreakRows();
        });
      });
    };
    async function saveTimetableSettings() {
      const dayStartTime = document.getElementById('ttDayStart').value;
      const dayEndTime = document.getElementById('ttDayEnd').value;
      if (!dayStartTime || !dayEndTime) { window.SchoolOS.toast('Day start and end times are required'); return; }
      const breaks = timetableBreaksDraft.filter((b) => b.label && b.startTime && b.endTime);
      if (breaks.length !== timetableBreaksDraft.length) { window.SchoolOS.toast('Every break needs a label, start and end time'); return; }
      try {
        await window.SchoolOS.api('/timetable/settings', { method: 'PUT', body: JSON.stringify({ dayStartTime, dayEndTime, breaks }) });
        window.SchoolOS.toast('Timetable settings saved, regenerate the timetable to apply them');
        window.SchoolOS.closeModal();
      } catch (err) { window.SchoolOS.toast(`Could not save settings (${err.message})`); }
    }
    render();
  }

  async function generateTimetableAndReload() {
    window.SchoolOS.toast('Generating timetable…');
    let result;
    try { result = await window.SchoolOS.api('/timetable/generate', { method: 'POST' }); } catch (err) { window.SchoolOS.toast(`Could not generate timetable (${err.message})`); return; }
    if (result.armsWithConflicts.length) console.warn('Timetable: classes that could not be scheduled without a conflict:', result.armsWithConflicts);
    if (result.armsSkipped.length) console.info('Timetable: classes skipped (no subject teachers assigned yet):', result.armsSkipped);
    const conflictNote = result.armsWithConflicts.length ? `; ${result.armsWithConflicts.length} class(es) couldn't be scheduled without a clash (see browser console)` : '';
    window.SchoolOS.toast(`Timetable generated: ${result.slotsCreated} periods scheduled${conflictNote}`);
    ['academics', 'ttStandalone'].forEach((scope) => { if (document.getElementById(`${scope}TimetableContainer`)) renderAdminTimetableSection(scope); });
  }
  // Grading scale is real, proprietor-managed data; a result's grade is
  // computed automatically against these bands when the teacher enters
  // scores (ResultsService.create), never typed in by hand.
  async function loadGradingScale() {
    const tbody = document.getElementById('realGradingScaleBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';
    try {
      const bands = await window.SchoolOS.api('/grading-scale');
      const canManage = currentRole === 'proprietor';
      tbody.innerHTML = bands.length
        ? bands.map((b) => `<tr><td><strong>${b.grade}</strong></td><td>${b.minScore}–${b.maxScore}</td><td>${b.meaning || '—'}</td><td class="row-action">${canManage ? `<button class="outline-button" data-edit-grade-band="${b.id}" data-grade="${b.grade}" data-min="${b.minScore}" data-max="${b.maxScore}" data-meaning="${b.meaning || ''}">Edit</button> <button class="outline-button" data-delete-grade-band="${b.id}" data-grade="${b.grade}">Delete</button>` : ''}</td></tr>`).join('')
        : '<tr><td colspan="4">No grading scale set yet.</td></tr>';
    } catch (err) { tbody.innerHTML = `<tr><td colspan="4">Could not load grading scale (${err.message})</td></tr>`; }
  }
  function openNewGradeBandModal() {
    window.SchoolOS.formModal({
      eyebrow: 'Grading scale', title: 'Add grade', sub: 'New results are graded automatically against this scale as scores are entered.',
      fields: [{ name: 'grade', label: 'Grade', placeholder: 'e.g. A' }, { name: 'min', label: 'Min score', type: 'number', placeholder: '70' }, { name: 'max', label: 'Max score', type: 'number', placeholder: '100' }, { name: 'meaning', label: 'Meaning (optional)', placeholder: 'e.g. Excellent' }],
      submitLabel: 'Add grade',
      onSubmit: async (d) => {
        const grade = (d.grade || '').trim();
        if (!grade || d.min === '' || d.max === '') { window.SchoolOS.toast('Grade, min and max score are required'); return; }
        try {
          await window.SchoolOS.api('/grading-scale', { method: 'POST', body: JSON.stringify({ grade, minScore: Number(d.min), maxScore: Number(d.max), meaning: d.meaning || undefined }) });
          window.SchoolOS.toast(`${grade} added`); loadGradingScale();
        } catch (err) { window.SchoolOS.toast(`Could not add grade (${err.message})`); }
      },
    });
  }
  function openEditGradeBandModal(id, grade, min, max, meaning) {
    window.SchoolOS.formModal({
      eyebrow: 'Grading scale', title: `Edit grade ${grade}`,
      fields: [{ name: 'grade', label: 'Grade', value: grade }, { name: 'min', label: 'Min score', type: 'number', value: min }, { name: 'max', label: 'Max score', type: 'number', value: max }, { name: 'meaning', label: 'Meaning', value: meaning }],
      submitLabel: 'Save',
      onSubmit: async (d) => {
        try {
          await window.SchoolOS.api('/grading-scale/' + id, { method: 'PATCH', body: JSON.stringify({ grade: d.grade || undefined, minScore: d.min !== '' ? Number(d.min) : undefined, maxScore: d.max !== '' ? Number(d.max) : undefined, meaning: d.meaning || undefined }) });
          window.SchoolOS.toast('Grading scale updated'); loadGradingScale();
        } catch (err) { window.SchoolOS.toast(`Could not update (${err.message})`); }
      },
    });
  }
  async function deleteGradeBand(id, grade) {
    if (!window.confirm(`Delete grade ${grade} from the scale? Results already graded keep their grade; this only changes how new ones are graded.`)) return;
    try { await window.SchoolOS.api('/grading-scale/' + id, { method: 'DELETE' }); window.SchoolOS.toast('Grade removed'); loadGradingScale(); } catch (err) { window.SchoolOS.toast(`Could not delete (${err.message})`); }
  }
  function pageAcademics(label) {
    const kpis = [['Classes live', '—', 'Live count', 'academicsClassesLiveKpi'], ['Timetable', 'Generate to view', 'Click Generate timetable below', null], ['Marks entries flagged', '—', 'Total > 100, or missing a score after submit', 'academicsFlaggedKpi'], ['Results awaiting approval', '—', 'Submitted, not yet approved', 'academicsResultsAwaitingKpi']];
    const canManageClasses = currentRole === 'proprietor' || currentRole === 'principal';
    const addClassButton = canManageClasses ? '<button class="new-button" data-modal="new-class">+ Add class</button>' : '';
    const addSubjectButton = canManageClasses ? '<button class="new-button" data-modal="new-subject">+ Add subject</button>' : '';
    const addGradeButton = currentRole === 'proprietor' ? '<button class="new-button" data-modal="new-grade-band">+ Add grade</button>' : '';
    return `<section class="page workspace-page" id="academics"><div class="page-heading"><div><p class="eyebrow">Academic management</p><h1>${label}</h1><p class="subtitle">Timetable, marks entry and result approval for every class.</p></div><button class="new-button" data-goto-tab="marks">+ Enter marks</button></div><div class="screen-kpis">${kpis.map((s, i) => `<article class="screen-kpi"><p>${s[0]}</p><strong${s[3] ? ` id="${s[3]}"` : ''}>${s[1]}</strong><small class="${i === 1 || i === 2 ? 'warn' : ''}">${s[2]}</small></article>`).join('')}</div><div class="screen-tabs" data-tabs><button class="active" data-tab="timetable">Timetable</button><button data-tab="marks">Marks entry</button><button data-tab="results">Result approval</button><button data-tab="scale">Grading scale</button><button data-tab="classes">Classes</button><button data-tab="subjects">Subjects</button></div><div data-tab-panel="timetable" class="tab-panel visible"><section class="data-card"><p class="tt-hint">Generate builds a conflict-free weekly schedule for every class from the subject teachers already assigned; a teacher is never double-booked across classes.</p><div id="academicsTimetableContainer"><p class="modal-sub">Loading…</p></div></section></div><div data-tab-panel="marks" class="tab-panel"><section class="data-card"><div class="data-toolbar"><span class="tt-class-label">Drafts not yet submitted</span></div><table class="data-table"><thead><tr><th>Student</th><th>Subject</th><th>Term</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th></tr></thead><tbody id="realMarksEntryBody"><tr><td colspan="7">Sign in to load marks…</td></tr></tbody></table></section></div><div data-tab-panel="results" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Student</th><th>Subject</th><th>Term</th><th>Total</th><th>Grade</th><th>Status</th><th></th></tr></thead><tbody id="realResultApprovalsBody"><tr><td colspan="7">Sign in to load results…</td></tr></tbody></table></section></div><div data-tab-panel="scale" class="tab-panel"><section class="data-card"><div class="data-toolbar"><span class="tt-class-label">Results are auto-graded against this scale</span>${addGradeButton}</div><table class="data-table"><thead><tr><th>Grade</th><th>Range</th><th>Meaning</th><th></th></tr></thead><tbody id="realGradingScaleBody"><tr><td colspan="4">Sign in to load the grading scale…</td></tr></tbody></table></section></div><div data-tab-panel="classes" class="tab-panel"><section class="data-card"><div class="data-toolbar"><span class="tt-class-label">Filter by grade band</span><select id="classesLevelFilter" class="level-filter-select" aria-label="Filter classes by grade band"><option value="">All grade bands</option>${Object.entries(GRADE_TIER_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>${addClassButton}</div><table class="data-table"><thead><tr><th>Class</th><th>Grade band</th><th>Campus</th><th>Arms</th><th></th></tr></thead><tbody id="realClassesBody"><tr><td colspan="5">Sign in to load classes…</td></tr></tbody></table></section></div><div data-tab-panel="subjects" class="tab-panel"><section class="data-card"><div class="data-toolbar"><span class="tt-class-label">Filter by grade band</span><select id="subjectsLevelFilter" class="level-filter-select" aria-label="Filter subjects by grade band"><option value="">All grade bands</option>${Object.entries(GRADE_TIER_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>${addSubjectButton}</div><table class="data-table"><thead><tr><th>Subject</th><th>Code</th><th>Grade bands</th><th>Stream</th><th></th></tr></thead><tbody id="realSubjectsBody"><tr><td colspan="5">Sign in to load subjects…</td></tr></tbody></table></section></div></section>`;
  }
  function renderAcademicsPanel() {
    const el = document.getElementById('academics');
    if (!el) return;
    const wasVisible = el.classList.contains('visible');
    el.outerHTML = pageAcademics('Academics');
    if (wasVisible) document.getElementById('academics').classList.add('visible');
    bindTabs();
    loadRealClasses(); loadRealSubjects(); loadRealAcademicsResults(); loadGradingScale(); renderAdminTimetableSection('academics');
  }
  let lastLoadedClasses = [];
  let lastCampusNameById = {};
  async function loadRealClasses() {
    const tbody = document.getElementById('realClassesBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="5">Loading classes…</td></tr>';
    try {
      const [classes, campuses] = await Promise.all([window.SchoolOS.api('/classes'), window.SchoolOS.api('/campuses')]);
      lastLoadedClasses = classes;
      lastCampusNameById = Object.fromEntries(campuses.map((c) => [c.id, c.name]));
      renderClassesTable();
    } catch (err) { tbody.innerHTML = `<tr><td colspan="5">Could not load classes (${err.message})</td></tr>`; }
  }
  function renderClassesTable() {
    const tbody = document.getElementById('realClassesBody');
    if (!tbody) return;
    const filterSelect = document.getElementById('classesLevelFilter');
    const gradeTier = filterSelect ? filterSelect.value : '';
    const classes = gradeTier ? lastLoadedClasses.filter((c) => c.gradeTier === gradeTier) : lastLoadedClasses;
    tbody.innerHTML = classes.length ? classes.map((c) => `<tr><td>${c.name}</td><td>${GRADE_TIER_LABELS[c.gradeTier] || c.gradeTier}</td><td>${lastCampusNameById[c.campusId] || '—'}</td><td>${(c.arms || []).map((a) => a.name).join(', ') || '—'}</td><td class="row-action"><button class="outline-button" data-view-class="${c.id}">View</button></td></tr>`).join('') : `<tr><td colspan="5">No classes${gradeTier ? ' in this grade band' : ''} yet.</td></tr>`;
  }
  async function openClassDetailModal(classId) {
    let cls, staff = [], allClasses = [];
    try {
      [cls, staff, allClasses] = await Promise.all([
        window.SchoolOS.api('/classes/' + classId),
        window.SchoolOS.api('/staff-profiles'),
        window.SchoolOS.api('/classes'),
      ]);
    } catch (err) { window.SchoolOS.toast(`Could not load class (${err.message})`); return; }
    const user = window.SchoolOS.getUser();
    const canManage = user && (user.role === 'PROPRIETOR' || user.role === 'PRINCIPAL');
    // Same-campus teachers only; mirrors the campus rule enforced
    // server-side (StaffProfilesService.createTeacher / ClassesService.updateArm).
    const teachersAtCampus = staff.filter((s) => s.user && s.user.role === 'TEACHER' && s.campusId === cls.campusId);
    const allTeachers = staff.filter((s) => s.user && s.user.role === 'TEACHER');
    const isSeniorSecondaryClass = cls.level === 'SENIOR_SECONDARY';
    const armsHtml = (cls.arms || []).map((a) => {
      const teacherName = a.classTeacher ? `${a.classTeacher.user.firstName} ${a.classTeacher.user.lastName}` : 'Unassigned';
      const teacherControl = canManage
        ? `<small>Class teacher (${a.name})</small><select data-set-class-teacher="${a.id}" data-arm-name="${a.name}" data-previous-value="${a.classTeacherId || ''}" aria-label="Class teacher for ${a.name}"><option value="">Unassigned</option>${teachersAtCampus.map((s) => `<option value="${s.id}" ${a.classTeacherId === s.id ? 'selected' : ''}>${s.user.firstName} ${s.user.lastName}</option>`).join('')}</select>`
        : `<small>${teacherName}</small>`;
      const streamControl = !isSeniorSecondaryClass ? '' : canManage
        ? `<small>Stream (${a.name})</small><select id="armStreamSelect-${a.id}" aria-label="Stream for ${a.name}"><option value="">Not stream-specific</option>${Object.entries(STREAM_LABELS).map(([k, v]) => `<option value="${k}" ${a.stream === k ? 'selected' : ''}>${v}</option>`).join('')}</select><button type="button" class="outline-button" data-save-arm-stream="${a.id}" data-arm-class-id="${classId}">Save</button>`
        : `<small>Stream: ${a.stream ? STREAM_LABELS[a.stream] : 'Not stream-specific'}</small>`;
      const promoteBtn = canManage ? `<button type="button" class="outline-button" data-promote-arm="${a.id}" data-arm-label="${cls.name} · ${a.name}">Promote students…</button>` : '';
      return canManage
        ? `<form class="inline-edit-row" onsubmit="__renameArmSubmit(event,'${a.id}')"><input name="name" value="${a.name}" aria-label="Arm name"><button type="submit" class="outline-button">Save</button></form><div class="inline-edit-row">${teacherControl}</div>${streamControl ? `<div class="inline-edit-row">${streamControl}</div>` : ''}<div class="inline-edit-row">${promoteBtn}</div>`
        : `<div class="modal-detail-row"><span>${a.name}</span><strong>${teacherName}</strong></div>${isSeniorSecondaryClass ? `<div class="modal-detail-row"><span></span>${streamControl}</div>` : ''}`;
    }).join('') || '<p class="modal-sub" style="margin:0">No arms yet.</p>';
    const subjectsHtml = (cls.teacherAssignments || []).map((t) => {
      const label = `${t.subject.name}`;
      const control = canManage
        ? `<select data-reassign-subject-teacher="${classId}" data-subject-id="${t.subject.id}" data-subject-name="${t.subject.name}" data-previous-value="${t.staffProfile.id}" aria-label="Teacher for ${t.subject.name}">${allTeachers.map((s) => `<option value="${s.id}" ${t.staffProfile.id === s.id ? 'selected' : ''}>${s.user.firstName} ${s.user.lastName}</option>`).join('')}</select>`
        : `<strong>${t.staffProfile.user.firstName} ${t.staffProfile.user.lastName}</strong>`;
      return `<div class="modal-detail-row"><span>${label}</span>${control}</div>`;
    }).join('') || '<p class="modal-sub" style="margin:0">No subject teachers assigned yet.</p>';

    const otherClasses = allClasses.filter((c) => c.id !== classId);
    const promotesToHtml = canManage ? `<div class="inline-edit-row"><select id="promotesToSelect" aria-label="Promotes to"><option value="">— None (students graduate) —</option>${otherClasses.map((c) => `<option value="${c.id}" ${cls.promotesToClassId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select><button type="button" class="outline-button" data-save-promotes-to="${classId}">Save</button></div>` : `<p class="modal-sub" style="margin:0">${cls.promotesToClass ? cls.promotesToClass.name : 'None — this is the final class (students graduate).'}</p>`;
    const levelHtml = canManage ? `<div class="inline-edit-row"><select id="levelSelect" aria-label="Grade band">${Object.entries(GRADE_TIER_LABELS).map(([k, v]) => `<option value="${k}" ${cls.gradeTier === k ? 'selected' : ''}>${v}</option>`).join('')}</select><button type="button" class="outline-button" data-save-level="${classId}">Save</button></div>` : `<p class="modal-sub" style="margin:0">${GRADE_TIER_LABELS[cls.gradeTier] || cls.gradeTier}</p>`;

    window.__renameClassSubmit = async (e) => {
      e.preventDefault();
      const name = new FormData(e.target).get('name');
      try { await window.SchoolOS.api('/classes/' + classId, { method: 'PATCH', body: JSON.stringify({ name }) }); window.SchoolOS.toast('Class renamed'); loadRealClasses(); window.SchoolOS.closeModal(); } catch (err) { window.SchoolOS.toast(`Could not rename class (${err.message})`); }
    };
    window.__renameArmSubmit = async (e, armId) => {
      e.preventDefault();
      const name = new FormData(e.target).get('name');
      try { await window.SchoolOS.api('/class-arms/' + armId, { method: 'PATCH', body: JSON.stringify({ name }) }); window.SchoolOS.toast('Arm renamed'); loadRealClasses(); window.SchoolOS.closeModal(); } catch (err) { window.SchoolOS.toast(`Could not rename arm (${err.message})`); }
    };
    window.SchoolOS.openModal(`<p class="eyebrow">Academics</p><h2>Class details</h2>
      ${canManage ? `<form class="inline-edit-row" onsubmit="__renameClassSubmit(event)"><input name="name" value="${cls.name}" aria-label="Class name"><button type="submit" class="outline-button">Save</button></form>` : `<p class="modal-sub">${cls.name}</p>`}
      <div class="detail-section"><p class="eyebrow">Grade band</p>${levelHtml}</div>
      <div class="detail-section"><p class="eyebrow">Promotes to (next class, end of session)</p>${promotesToHtml}</div>
      <div class="detail-section"><p class="eyebrow">Arms</p>${armsHtml}${canManage ? `<button class="outline-button" style="margin-top:10px" data-add-arm="${classId}">+ Add arm</button>` : ''}</div>
      <div class="detail-section"><p class="eyebrow">Subject teachers</p>${subjectsHtml}</div>
      <div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>`);
  }
  async function saveArmStream(armId, classId) {
    const select = document.getElementById('armStreamSelect-' + armId);
    const payload = select.value ? { stream: select.value } : { clearStream: true };
    try {
      await window.SchoolOS.api('/class-arms/' + armId, { method: 'PATCH', body: JSON.stringify(payload) });
      window.SchoolOS.toast('Arm stream updated');
      loadRealClasses();
      if (classId) openClassDetailModal(classId);
    } catch (err) { window.SchoolOS.toast(`Could not update arm stream (${err.message})`); }
  }
  async function saveClassLevel(classId) {
    const select = document.getElementById('levelSelect');
    try { await window.SchoolOS.api('/classes/' + classId, { method: 'PATCH', body: JSON.stringify({ gradeTier: select.value }) }); window.SchoolOS.toast('Grade band updated'); loadRealClasses(); openClassDetailModal(classId); } catch (err) { window.SchoolOS.toast(`Could not update grade band (${err.message})`); }
  }
  async function saveClassPromotesTo(classId) {
    const select = document.getElementById('promotesToSelect');
    const payload = select.value ? { promotesToClassId: select.value } : { clearPromotesTo: true };
    try { await window.SchoolOS.api('/classes/' + classId, { method: 'PATCH', body: JSON.stringify(payload) }); window.SchoolOS.toast('Promotion target updated'); openClassDetailModal(classId); } catch (err) { window.SchoolOS.toast(`Could not update promotion target (${err.message})`); }
  }
  async function reassignSubjectTeacher(schoolClassId, subjectId, staffProfileId) {
    try {
      await window.SchoolOS.api('/teacher-subject-assignments/reassign', { method: 'POST', body: JSON.stringify({ schoolClassId, subjectId, staffProfileId }) });
      window.SchoolOS.toast('Subject teacher reassigned');
      openClassDetailModal(schoolClassId);
    } catch (err) { window.SchoolOS.toast(`Could not reassign (${err.message})`); }
  }

  /** End-of-session bulk promotion; the backend only allows this during
   * Third Term (AcademicSessionsService.assertCurrentTermIsThird), so a
   * mistimed attempt surfaces as a normal toast error here rather than
   * needing its own separate "is it Third Term" check client-side. Every
   * student defaults to the class's configured "promotes to" target (or
   * Graduate, for a terminal class) but stays individually editable:
   * "Repeat this class" is always available so a student can be held
   * back without being sent anywhere. */
  async function openPromotionModal(classArmId, armLabel) {
    let sessions, preview;
    try {
      sessions = await window.SchoolOS.api('/academic-sessions');
    } catch (err) { window.SchoolOS.toast(`Could not load academic sessions (${err.message})`); return; }
    const currentSession = sessions.find((s) => s.isCurrent) || sessions[0];
    if (!currentSession) { window.SchoolOS.toast('No academic session found'); return; }

    try {
      preview = await window.SchoolOS.api(`/students/promotion-preview?classArmId=${classArmId}&targetAcademicSessionId=${currentSession.id}`);
    } catch (err) { window.SchoolOS.toast(`Could not start promotion (${err.message})`); return; }

    if (!preview.students.length) { window.SchoolOS.toast('No active students in this class to promote'); return; }

    const rowHtml = (s) => {
      const options = preview.isGraduating
        ? [{ value: '__graduate__', label: 'Graduate', selected: true }, { value: '__repeat__', label: 'Repeat this class', selected: false }]
        : [
            { value: '__repeat__', label: 'Repeat this class', selected: !s.defaultTargetClassArmId },
            ...preview.targetArms.map((a) => ({ value: a.id, label: `${preview.targetClass.name} · ${a.name}`, selected: s.defaultTargetClassArmId === a.id })),
          ];
      const optionsHtml = options.map((o) => `<option value="${o.value}" ${o.selected ? 'selected' : ''}>${o.label}</option>`).join('');
      return `<div class="attendance-row"><span class="person-cell">${s.firstName} ${s.lastName}</span><select data-promotion-target="${s.id}" aria-label="Outcome for ${s.firstName} ${s.lastName}">${optionsHtml}</select><span></span></div>`;
    };
    const sub = preview.isGraduating
      ? `${preview.students.length} student(s) default to Graduate: ${armLabel} has no next class configured. Switch any to "Repeat this class" if they need to stay.`
      : `${preview.students.length} student(s) default to moving into ${preview.targetClass.name}. Adjust individuals below (e.g. to hold a student back) before confirming.`;

    window.SchoolOS.openModal(`<p class="eyebrow">Promotion</p><h2>Promote ${armLabel}</h2><p class="modal-sub">${sub}</p><div class="attendance-list">${preview.students.map(rowHtml).join('')}</div><div class="form-actions"><button class="outline-button" data-modal-close>Cancel</button><button class="new-button" id="confirmPromoteBtn">Confirm</button></div>`);

    document.getElementById('confirmPromoteBtn').addEventListener('click', async () => {
      const assignments = [];
      let repeating = 0;
      for (const s of preview.students) {
        const value = document.querySelector(`[data-promotion-target="${s.id}"]`).value;
        if (value === '__repeat__') { repeating += 1; continue; }
        assignments.push(value === '__graduate__' ? { studentId: s.id } : { studentId: s.id, targetClassArmId: value });
      }
      const graduating = assignments.filter((a) => !a.targetClassArmId).length;
      const moving = assignments.length - graduating;
      const parts = [];
      if (moving) parts.push(`promote ${moving} to ${preview.targetClass ? preview.targetClass.name : 'the next class'}`);
      if (graduating) parts.push(`graduate ${graduating}`);
      if (repeating) parts.push(`keep ${repeating} repeating ${armLabel}`);
      if (!assignments.length) { window.SchoolOS.toast('Every student is set to repeat, nothing to confirm'); return; }
      if (!window.confirm(`${parts.join(', ')}? This cannot be easily undone.`)) return;
      try {
        const res = await window.SchoolOS.api('/students/promote-bulk', { method: 'POST', body: JSON.stringify({ classArmId, targetAcademicSessionId: currentSession.id, assignments }) });
        window.SchoolOS.toast(`Promoted ${res.promoted}, graduated ${res.graduated}`);
        window.SchoolOS.closeModal();
        loadRealClasses();
      } catch (err) { window.SchoolOS.toast(`Could not promote (${err.message})`); }
    });
  }
  /** Reassign/remove a class teacher after the fact; the create-teacher
   * modal only covers assigning one at creation time; this is the other
   * (and only other) place ClassArm.classTeacherId can change. */
  async function setArmClassTeacher(armId, staffProfileId) {
    const payload = staffProfileId ? { classTeacherId: staffProfileId } : { removeClassTeacher: true };
    try {
      await window.SchoolOS.api('/class-arms/' + armId, { method: 'PATCH', body: JSON.stringify(payload) });
      window.SchoolOS.toast(staffProfileId ? 'Class teacher updated' : 'Class teacher removed');
      loadRealClasses();
      window.SchoolOS.closeModal();
    } catch (err) { window.SchoolOS.toast(`Could not update class teacher (${err.message})`); }
  }
  const LEVEL_LABELS = { NURSERY: 'Nursery', PRIMARY: 'Primary', JUNIOR_SECONDARY: 'Junior Secondary', SENIOR_SECONDARY: 'Senior Secondary' };
  // GradeTier is the finer-grained scoping field (splits Primary into
  // Lower/Upper bands, matching the Nigerian curriculum's different core
  // subject lists for Primary 1-3 vs 4-6); SchoolClass.level is derived
  // from it server-side, never set directly (see ClassesService).
  const GRADE_TIER_LABELS = { NURSERY: 'Nursery', LOWER_PRIMARY: 'Primary 1–3', UPPER_PRIMARY: 'Primary 4–6', JUNIOR_SECONDARY: 'Junior Secondary', SENIOR_SECONDARY: 'Senior Secondary' };
  const gradeTierByLabel = Object.fromEntries(Object.entries(GRADE_TIER_LABELS).map(([k, v]) => [v, k]));
  const STREAM_LABELS = { SCIENCE: 'Science', ART: 'Art' };

  // ---- Student self-service: Senior Secondary subject selection ----
  let mySubjectsEditMode = false;
  let lastSubjectOptions = null;
  async function renderMySubjectsRow(p) {
    if (!p.stream) {
      return '<div class="detail-section"><p class="eyebrow">My Subjects</p><p class="modal-sub" style="margin:0">Set your stream first — subject selection depends on it.</p></div>';
    }
    let selection = [];
    try { selection = await window.SchoolOS.api('/portal/student/subject-selection'); } catch (err) { /* treat as not-yet-selected */ }
    if (selection.length && !mySubjectsEditMode) {
      const names = selection.map((s) => s.subject.name).sort().join(', ');
      return `<div class="detail-section"><p class="eyebrow">My Subjects (${selection.length})</p><p class="modal-sub" style="margin:0 0 8px">${names}</p><button type="button" class="outline-button" id="changeSubjectSelectionBtn">Change selection</button></div>`;
    }
    try { lastSubjectOptions = await window.SchoolOS.api('/portal/student/subject-options'); } catch (err) {
      return `<div class="detail-section"><p class="eyebrow">My Subjects</p><p class="modal-sub" style="margin:0">Could not load subject options (${err.message})</p></div>`;
    }
    const options = lastSubjectOptions;
    const selectedIds = new Set(selection.map((s) => s.subjectId));
    const electives = options.electives[p.stream] || [];
    const compulsoryNames = options.compulsory.map((s) => s.name).join(', ') || 'None configured yet';
    const tradeOptionsHtml = options.coreTrade.map((s) => `<option value="${s.id}" ${selectedIds.has(s.id) ? 'selected' : ''}>${s.name}</option>`).join('');
    const electiveCheckboxesHtml = electives.map((s) => `<label class="checkbox-option"><input type="checkbox" name="mySubjectElective" value="${s.id}" ${selectedIds.has(s.id) ? 'checked' : ''}>${s.name}</label>`).join('');
    return `<div class="detail-section"><p class="eyebrow">My Subjects</p>
      <p class="modal-sub" style="margin:0 0 8px">Compulsory (always included): ${compulsoryNames}</p>
      <div class="form-field"><label>Trade subject</label><select id="mySubjectTradeSelect" aria-label="Trade subject"><option value="">— Choose —</option>${tradeOptionsHtml}</select></div>
      <div class="form-field"><label>${STREAM_LABELS[p.stream]} electives</label><div class="checkbox-group" id="mySubjectElectivesGroup">${electiveCheckboxesHtml || '<p class="modal-sub" style="margin:0">None configured yet.</p>'}</div></div>
      <p class="modal-sub" id="mySubjectsCounter" style="margin:0 0 8px"></p>
      <div class="form-actions"><button type="button" class="new-button" id="submitSubjectSelectionBtn">Save selection</button></div>
    </div>`;
  }
  function updateMySubjectsCounter() {
    const counter = document.getElementById('mySubjectsCounter');
    if (!counter || !lastSubjectOptions) return;
    const tradeSelect = document.getElementById('mySubjectTradeSelect');
    const checkedCount = document.querySelectorAll('#mySubjectElectivesGroup input:checked').length;
    const total = lastSubjectOptions.compulsory.length + (tradeSelect && tradeSelect.value ? 1 : 0) + checkedCount;
    counter.textContent = total >= 8 && total <= 9 ? `${total} of 8-9 selected ✓` : `${total} of 8-9 selected — adjust to reach 8 or 9`;
  }
  function bindMySubjectsHandlers() {
    const changeBtn = document.getElementById('changeSubjectSelectionBtn');
    if (changeBtn) changeBtn.addEventListener('click', () => { mySubjectsEditMode = true; loadRealStudentPortalData(); });

    const tradeSelect = document.getElementById('mySubjectTradeSelect');
    const electivesGroup = document.getElementById('mySubjectElectivesGroup');
    const submitBtn = document.getElementById('submitSubjectSelectionBtn');
    if (!submitBtn) return;
    if (tradeSelect) tradeSelect.addEventListener('change', updateMySubjectsCounter);
    if (electivesGroup) electivesGroup.addEventListener('change', updateMySubjectsCounter);
    updateMySubjectsCounter();

    submitBtn.addEventListener('click', async () => {
      const tradeSubjectId = tradeSelect ? tradeSelect.value : '';
      const electiveSubjectIds = Array.from(document.querySelectorAll('#mySubjectElectivesGroup input:checked')).map((el) => el.value);
      if (!tradeSubjectId) { window.SchoolOS.toast('Choose a trade subject'); return; }
      try {
        await window.SchoolOS.api('/portal/student/subject-selection', { method: 'POST', body: JSON.stringify({ tradeSubjectId, electiveSubjectIds }) });
        mySubjectsEditMode = false;
        window.SchoolOS.toast('Subjects saved');
        loadRealStudentPortalData();
      } catch (err) { window.SchoolOS.toast(`Could not save subjects (${err.message})`); }
    });
  }

  async function openNewClassModal() {
    let campuses = [];
    try { campuses = await window.SchoolOS.api('/campuses'); } catch (err) { window.SchoolOS.toast(`Could not load campuses (${err.message})`); return; }
    if (!campuses.length) { window.SchoolOS.toast('No campuses found for this tenant'); return; }
    const campusByName = Object.fromEntries(campuses.map((c) => [c.name, c.id]));
    window.SchoolOS.formModal({
      eyebrow: 'Academics', title: 'Add class', sub: 'e.g. Nursery 1, Primary 3, JSS 2, SS1.',
      fields: [
        { name: 'name', label: 'Class name', placeholder: 'e.g. JSS 3' },
        { name: 'level', label: 'Grade band', type: 'select', options: Object.values(GRADE_TIER_LABELS) },
        { name: 'campus', label: 'Campus', type: 'select', options: campuses.map((c) => c.name) },
      ],
      submitLabel: 'Add class',
      onSubmit: async (d) => {
        const payload = { campusId: campusByName[d.campus], name: (d.name || '').trim(), gradeTier: gradeTierByLabel[d.level] };
        if (!payload.name || !payload.campusId) { window.SchoolOS.toast('Class name and campus are required'); return; }
        try { await window.SchoolOS.api('/classes', { method: 'POST', body: JSON.stringify(payload) }); window.SchoolOS.toast(`${payload.name} added`); loadRealClasses(); } catch (err) { window.SchoolOS.toast(`Could not add class (${err.message})`); }
      },
    });
  }
  async function openNewClassArmModal(schoolClassId) {
    let teachers = [], schoolClass;
    try {
      [teachers, schoolClass] = await Promise.all([
        window.SchoolOS.api('/staff-profiles').then((staff) => staff.filter((s) => s.user && s.user.role === 'TEACHER')),
        window.SchoolOS.api('/classes/' + schoolClassId),
      ]);
    } catch (err) { window.SchoolOS.toast(`Could not load teachers (${err.message})`); return; }
    const teacherLabel = (s) => `${s.user.firstName} ${s.user.lastName}`;
    const teacherByLabel = Object.fromEntries(teachers.map((s) => [teacherLabel(s), s.id]));
    const isSeniorSecondary = schoolClass.level === 'SENIOR_SECONDARY';
    window.SchoolOS.formModal({
      eyebrow: 'Academics', title: 'Add class arm', sub: 'A section of this class, e.g. "Gold" or "Diamond".',
      fields: [
        { name: 'name', label: 'Arm name', placeholder: 'e.g. Gold' },
        { name: 'teacher', label: 'Class teacher', type: 'select', options: ['Unassigned', ...teachers.map(teacherLabel)] },
        ...(isSeniorSecondary ? [{ name: 'stream', label: 'Stream (for Senior Secondary students in this arm)', type: 'select', options: ['Not stream-specific', ...Object.values(STREAM_LABELS)] }] : []),
      ],
      submitLabel: 'Add arm',
      onSubmit: async (d) => {
        const payload = {
          schoolClassId, name: (d.name || '').trim(),
          classTeacherId: d.teacher && d.teacher !== 'Unassigned' ? teacherByLabel[d.teacher] : undefined,
          stream: d.stream && d.stream !== 'Not stream-specific' ? Object.keys(STREAM_LABELS).find((k) => STREAM_LABELS[k] === d.stream) : undefined,
        };
        if (!payload.name) { window.SchoolOS.toast('Arm name is required'); return; }
        try { await window.SchoolOS.api('/class-arms', { method: 'POST', body: JSON.stringify(payload) }); window.SchoolOS.toast(`${payload.name} added`); loadRealClasses(); } catch (err) { window.SchoolOS.toast(`Could not add class arm (${err.message})`); }
      },
    });
  }
  let lastLoadedSubjects = [];
  async function loadRealSubjects() {
    const tbody = document.getElementById('realSubjectsBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="3">Loading subjects…</td></tr>';
    try {
      lastLoadedSubjects = await window.SchoolOS.api('/subjects');
      renderSubjectsTable();
    } catch (err) { tbody.innerHTML = `<tr><td colspan="3">Could not load subjects (${err.message})</td></tr>`; }
  }
  function renderSubjectsTable() {
    const tbody = document.getElementById('realSubjectsBody');
    if (!tbody) return;
    const filterSelect = document.getElementById('subjectsLevelFilter');
    const gradeTier = filterSelect ? filterSelect.value : '';
    const subjects = gradeTier ? lastLoadedSubjects.filter((s) => s.gradeTiers.includes(gradeTier)) : lastLoadedSubjects;
    const streamsCell = (s) => s.isCompulsory ? 'Compulsory' : s.isCoreTrade ? 'Core trade' : (s.streams && s.streams.length ? s.streams.map((st) => STREAM_LABELS[st] || st).join(', ') : '—');
    const canManage = currentRole === 'proprietor' || currentRole === 'principal';
    const actionsCell = (s) => canManage ? `<button class="outline-button" data-edit-subject="${s.id}">Edit</button> <button class="outline-button" data-delete-subject="${s.id}" data-subject-name="${s.name}">Delete</button>` : '';
    tbody.innerHTML = subjects.length ? subjects.map((s) => `<tr><td>${s.name}</td><td>${s.code || '—'}</td><td>${s.gradeTiers.length ? s.gradeTiers.map((l) => GRADE_TIER_LABELS[l] || l).join(', ') : '—'}</td><td>${s.gradeTiers.includes('SENIOR_SECONDARY') ? streamsCell(s) : '—'}</td><td class="row-action">${actionsCell(s)}</td></tr>`).join('') : `<tr><td colspan="5">No subjects${gradeTier ? ' in this grade band' : ''} yet.</td></tr>`;
  }
  const SUBJECT_TYPE_LABELS = { REGULAR: 'Regular (stream-specific)', COMPULSORY: 'Compulsory (every SS student)', CORE_TRADE: 'Core trade subject (student picks one)' };
  const subjectTypeByLabel = Object.fromEntries(Object.entries(SUBJECT_TYPE_LABELS).map(([k, v]) => [v, k]));
  const subjectTypeOf = (s) => s.isCompulsory ? 'COMPULSORY' : s.isCoreTrade ? 'CORE_TRADE' : 'REGULAR';
  function openEditSubjectModal(id) {
    const s = lastLoadedSubjects.find((x) => x.id === id);
    if (!s) return;
    window.SchoolOS.formModal({
      eyebrow: 'Academics', title: `Edit ${s.name}`, sub: 'Which grade band(s) is this taught at? A regular Senior Secondary subject needs at least one stream (Science or Art) — only compulsory and core trade subjects can skip that.',
      fields: [
        { name: 'name', label: 'Subject name', value: s.name },
        { name: 'code', label: 'Code (optional)', value: s.code || '' },
        { name: 'levels', label: 'Grade bands', type: 'checkboxes', options: Object.entries(GRADE_TIER_LABELS).map(([k, v]) => ({ value: k, label: v })), value: s.gradeTiers },
        { name: 'subjectType', label: 'Subject type', type: 'select', options: Object.values(SUBJECT_TYPE_LABELS), value: SUBJECT_TYPE_LABELS[subjectTypeOf(s)] },
        { name: 'streams', label: 'Senior Secondary streams', type: 'checkboxes', options: Object.entries(STREAM_LABELS).map(([k, v]) => ({ value: k, label: v })), value: s.streams },
      ],
      submitLabel: 'Save',
      onSubmit: async (d) => {
        const name = (d.name || '').trim();
        const gradeTiers = [].concat(d.levels || []).filter(Boolean);
        const streams = [].concat(d.streams || []).filter(Boolean);
        const subjectType = subjectTypeByLabel[d.subjectType] || 'REGULAR';
        if (!name) { window.SchoolOS.toast('Subject name is required'); return; }
        if (!gradeTiers.length) { window.SchoolOS.toast('Choose at least one grade band'); return; }
        try {
          await window.SchoolOS.api('/subjects/' + id, { method: 'PATCH', body: JSON.stringify({ name, code: d.code || undefined, gradeTiers, streams, isCompulsory: subjectType === 'COMPULSORY', isCoreTrade: subjectType === 'CORE_TRADE' }) });
          window.SchoolOS.toast(`${name} updated`); loadRealSubjects();
        } catch (err) { window.SchoolOS.toast(`Could not update subject (${err.message})`); }
      },
    });
  }
  async function deleteSubjectRow(id, name) {
    if (!window.confirm(`Delete ${name}? This can't be undone, and only works if no results have been entered for it yet.`)) return;
    try { await window.SchoolOS.api('/subjects/' + id, { method: 'DELETE' }); window.SchoolOS.toast(`${name} deleted`); loadRealSubjects(); } catch (err) { window.SchoolOS.toast(`Could not delete subject (${err.message})`); }
  }
  function openNewSubjectModal() {
    window.SchoolOS.formModal({
      eyebrow: 'Academics', title: 'Add subject', sub: 'Which grade band(s) is this taught at? A regular Senior Secondary subject needs at least one stream (Science or Art) — only compulsory and core trade subjects can skip that.',
      fields: [
        { name: 'name', label: 'Subject name', placeholder: 'e.g. Further Mathematics' },
        { name: 'code', label: 'Code (optional)', placeholder: 'e.g. FMTH' },
        { name: 'levels', label: 'Grade bands', type: 'checkboxes', options: Object.entries(GRADE_TIER_LABELS).map(([k, v]) => ({ value: k, label: v })) },
        { name: 'subjectType', label: 'Subject type', type: 'select', options: Object.values(SUBJECT_TYPE_LABELS), value: SUBJECT_TYPE_LABELS.REGULAR },
        { name: 'streams', label: 'Senior Secondary streams', type: 'checkboxes', options: Object.entries(STREAM_LABELS).map(([k, v]) => ({ value: k, label: v })) },
      ],
      submitLabel: 'Add subject',
      onSubmit: async (d) => {
        const name = (d.name || '').trim();
        const gradeTiers = [].concat(d.levels || []).filter(Boolean);
        const streams = [].concat(d.streams || []).filter(Boolean);
        const subjectType = subjectTypeByLabel[d.subjectType] || 'REGULAR';
        if (!name) { window.SchoolOS.toast('Subject name is required'); return; }
        if (!gradeTiers.length) { window.SchoolOS.toast('Choose at least one grade band'); return; }
        try { await window.SchoolOS.api('/subjects', { method: 'POST', body: JSON.stringify({ name, code: d.code || undefined, gradeTiers, streams, isCompulsory: subjectType === 'COMPULSORY', isCoreTrade: subjectType === 'CORE_TRADE' }) }); window.SchoolOS.toast(`${name} added`); loadRealSubjects(); } catch (err) { window.SchoolOS.toast(`Could not add subject (${err.message})`); }
      },
    });
  }
  /** A result entry is "flagged for review" when either: (a) its total
   * exceeds 100 — CA and exam are each capped 0-100 independently at
   * entry, so a total over 100 means the two components together don't
   * add up to a valid percentage, a real data-entry problem; or (b) it
   * was submitted (or further along) with a score component still
   * missing — submit() has no completeness check, so this genuinely can
   * happen and is worth a reviewer's attention before it reaches
   * approval/publish. */
  function flagReasonFor(r) {
    if (r.totalScore !== null && r.totalScore !== undefined && Number(r.totalScore) > 100) return 'Total exceeds 100';
    if (r.status !== 'DRAFT' && (r.continuousAssessmentScore === null || r.continuousAssessmentScore === undefined || r.examScore === null || r.examScore === undefined)) return 'Missing a score component';
    return null;
  }
  async function loadRealAcademicsResults() {
    const marksBody = document.getElementById('realMarksEntryBody');
    const approvalsBody = document.getElementById('realResultApprovalsBody');
    const classesKpi = document.getElementById('academicsClassesLiveKpi');
    const resultsKpi = document.getElementById('academicsResultsAwaitingKpi');
    const flaggedKpi = document.getElementById('academicsFlaggedKpi');
    if ((!marksBody && !approvalsBody && !classesKpi && !resultsKpi && !flaggedKpi) || !window.SchoolOS.getAccessToken()) return;
    if (classesKpi) { try { const classes = await window.SchoolOS.api('/classes'); classesKpi.textContent = classes.length; } catch (err) { classesKpi.textContent = '—'; } }
    if (!marksBody && !approvalsBody && !resultsKpi && !flaggedKpi) return;
    let results = [];
    try { results = await window.SchoolOS.api('/results'); } catch (err) {
      if (marksBody) marksBody.innerHTML = `<tr><td colspan="7">Could not load marks (${err.message})</td></tr>`;
      if (approvalsBody) approvalsBody.innerHTML = `<tr><td colspan="7">Could not load results (${err.message})</td></tr>`;
      if (flaggedKpi) flaggedKpi.textContent = '—';
      return;
    }
    if (marksBody) {
      const drafts = results.filter((r) => r.status === 'DRAFT');
      marksBody.innerHTML = drafts.length ? drafts.map((r) => {
        const flag = flagReasonFor(r);
        return `<tr class="${flag ? 'row-flagged' : ''}"><td>${r.student ? r.student.firstName + ' ' + r.student.lastName : '—'}</td><td>${r.subject?.name || '—'}</td><td>${r.term?.name || '—'}</td><td>${r.continuousAssessmentScore ?? '—'}</td><td>${r.examScore ?? '—'}</td><td>${r.totalScore ?? '—'}${flag ? ` <span class="status pending" title="${flag}">Flagged</span>` : ''}</td><td>${r.grade || '—'}</td></tr>`;
      }).join('') : '<tr><td colspan="7">No draft marks yet.</td></tr>';
    }
    if (approvalsBody) {
      const relevant = results.filter((r) => r.status === 'SUBMITTED' || r.status === 'APPROVED' || r.status === 'PUBLISHED');
      approvalsBody.innerHTML = relevant.length ? relevant.map((r) => {
        const studentName = r.student ? `${r.student.firstName} ${r.student.lastName}` : 'this student';
        const subjectName = r.subject?.name || 'this subject';
        const flag = flagReasonFor(r);
        const actions = [];
        // Grade is computed automatically from the score against the
        // grading scale at entry time (ResultsService.create); nothing to
        // set here, the column below just displays it.
        if (r.status === 'SUBMITTED') actions.push(`<button class="outline-button" data-approve-real-result="${r.id}" data-student-name="${studentName}" data-subject-name="${subjectName}">Approve</button>`);
        else if (r.status === 'APPROVED') actions.push(`<button class="outline-button" data-publish-real-result="${r.id}" data-student-name="${studentName}" data-subject-name="${subjectName}">Publish</button>`);
        return `<tr class="${flag ? 'row-flagged' : ''}"><td>${r.student ? r.student.firstName + ' ' + r.student.lastName : '—'}</td><td>${r.subject?.name || '—'}</td><td>${r.term?.name || '—'}</td><td>${r.totalScore ?? '—'}${flag ? ` <span class="status pending" title="${flag}">Flagged</span>` : ''}</td><td>${r.grade || '—'}</td><td><span class="status ${r.status !== 'PUBLISHED' ? 'pending' : ''}">${r.status}</span></td><td class="row-action">${actions.join(' ') || '<span>→</span>'}</td></tr>`;
      }).join('') : '<tr><td colspan="7">No submitted results yet.</td></tr>';
    }
    if (resultsKpi) resultsKpi.textContent = results.filter((r) => r.status === 'SUBMITTED').length;
    if (flaggedKpi) flaggedKpi.textContent = results.filter((r) => flagReasonFor(r)).length;
  }
  function openSetGradeModal(id, currentGrade, studentName, subjectName) {
    window.SchoolOS.formModal({
      eyebrow: 'Results', title: `${currentGrade ? 'Edit' : 'Set'} grade: ${studentName}`,
      sub: `${subjectName}. Only the Proprietor or Principal can set a result's grade.`,
      fields: [{ name: 'grade', label: 'Grade', value: currentGrade || '', placeholder: 'e.g. A' }],
      submitLabel: 'Save grade',
      onSubmit: async (d) => {
        const grade = (d.grade || '').trim();
        if (!grade) { window.SchoolOS.toast('Grade is required'); return; }
        try {
          await window.SchoolOS.api('/results/' + id + '/grade', { method: 'PATCH', body: JSON.stringify({ grade }) });
          window.SchoolOS.toast('Grade saved');
          loadRealAcademicsResults();
        } catch (err) { window.SchoolOS.toast(`Could not save grade (${err.message})`); }
      },
    });
  }
  async function approveRealResult(id) {
    try { await window.SchoolOS.api('/results/' + id + '/approve', { method: 'PATCH' }); window.SchoolOS.toast('Result approved'); loadRealAcademicsResults(); } catch (err) { window.SchoolOS.toast(`Could not approve (${err.message})`); }
  }
  async function publishRealResult(id) {
    try { await window.SchoolOS.api('/results/' + id + '/publish', { method: 'PATCH' }); window.SchoolOS.toast('Result published'); loadRealAcademicsResults(); } catch (err) { window.SchoolOS.toast(`Could not publish (${err.message})`); }
  }

  // ============ Results (student / parent / teacher) ============
  function pageStudentResults(label) {
    return `<section class="page workspace-page" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Results</p><h1>${label}</h1><p class="subtitle">Every published result for your account.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Subject</th><th>Term</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th></tr></thead><tbody id="realStudentResultsBody"><tr><td colspan="6">Sign in as a student to load results…</td></tr></tbody></table></section></section>`;
  }
  function pageParentResults(label) {
    return `<section class="page workspace-page" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Results</p><h1>${label}</h1><p class="subtitle">Published results for your linked children.</p></div></div><div id="realParentResultsBlocks"><p class="modal-sub">Sign in as a parent to load results…</p></div></section>`;
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
    return `<section class="page workspace-page" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Results</p><h1>${label}</h1><p class="subtitle">Enter marks for the subjects and classes you teach.</p></div><button class="new-button" data-modal="add-marks">+ Add marks</button></div><section class="data-card"><table class="data-table"><thead><tr><th>Student</th><th>Subject</th><th>Term</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody id="realTeacherResultsBody"><tr><td colspan="6">Sign in as a teacher to load results…</td></tr></tbody></table></section></section>`;
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
      eyebrow: 'Results', title: 'Add marks', sub: 'Pick the subject you want to enter marks for, you’ll then choose one or more of your classes.',
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
    window.SchoolOS.openModal(`<p class="eyebrow">Results</p><h2>${subjectName} marks · ${term.name}</h2><p class="modal-sub">Leave a student blank to skip them. Marks save as drafts. Submit each for approval when ready.</p><form onsubmit="__marksSubmit(event)"><div class="attendance-list">${rowsHtml}</div><div class="form-actions"><button type="button" class="outline-button" data-modal-close>Cancel</button><button type="submit" class="new-button">Save marks</button></div></form>`);
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
    return `<section class="page workspace-page" id="assignments"><div class="page-heading"><div><p class="eyebrow">My work</p><h1>${label}</h1><p class="subtitle">Everything posted for your class.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Assignment</th><th>Description</th><th>Due date</th></tr></thead><tbody id="realStudentAssignmentsBody"><tr><td colspan="3">Sign in as a student to load assignments…</td></tr></tbody></table></section></section>`;
  }
  function pageAssignmentsTeacher(label) {
    return `<section class="page workspace-page" id="assignments"><div class="page-heading"><div><p class="eyebrow">Assignments</p><h1>${label}</h1><p class="subtitle">Real assignments across the classes you teach.</p></div><button class="new-button" data-modal="new-assignment-real">+ New assignment</button></div><section class="data-card"><table class="data-table"><thead><tr><th>Assignment</th><th>Class</th><th>Subject</th><th>Due date</th></tr></thead><tbody id="realTeacherAssignmentsBody"><tr><td colspan="4">Sign in as a teacher to load assignments…</td></tr></tbody></table></section><p class="modal-sub" style="margin-top:14px">Submission tracking and an approval workflow aren't built on the backend yet — this is every real assignment you've posted, nothing more.</p></section>`;
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

  // ============ CBT Exams (real, DRAFT -> SUBMITTED -> PUBLISHED) ============
  let studentCbtExams = [];

  function pageCbtExamsTeacher(label) {
    return `<section class="page workspace-page" id="cbt-exams"><div class="page-heading"><div><p class="eyebrow">CBT Exams</p><h1>${label}</h1><p class="subtitle">Build CBT question sets for your classes. New exams are reviewed by the principal/proprietor before they go live.</p></div><button class="new-button" data-modal="new-exam">+ New CBT exam</button></div><div class="screen-kpis" id="cbtTeacherKpis"></div><section class="data-card"><table class="data-table"><thead><tr><th>Exam</th><th>Class</th><th>Questions</th><th>Status</th><th></th></tr></thead><tbody id="realCbtTeacherBody"><tr><td colspan="5">Loading…</td></tr></tbody></table></section></section>`;
  }
  async function loadRealCbtExamsTeacher() {
    const tbody = document.getElementById('realCbtTeacherBody');
    const kpiEl = document.getElementById('cbtTeacherKpis');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="5">Loading…</td></tr>';
    try {
      const arms = await window.SchoolOS.api('/portal/teacher/class-arms');
      if (!arms.length) { tbody.innerHTML = '<tr><td colspan="5">You are not assigned to any class yet.</td></tr>'; if (kpiEl) kpiEl.innerHTML = ''; return; }
      const lists = await Promise.all(arms.map((a) => window.SchoolOS.api('/class-arms/' + a.id + '/cbt-exams').then((list) => list.map((ex) => ({ ...ex, armLabel: a.schoolClassName + ' · ' + a.armName })))));
      const allExams = lists.flat();
      if (kpiEl) {
        const published = allExams.filter((ex) => ex.status === 'PUBLISHED').length;
        const submitted = allExams.filter((ex) => ex.status === 'SUBMITTED').length;
        const drafts = allExams.filter((ex) => ex.status === 'DRAFT').length;
        kpiEl.innerHTML = [['Published', String(published), 'Live for students'], ['Pending approval', String(submitted), 'Awaiting principal sign-off'], ['Drafts', String(drafts), 'Question bank in progress']].map((s) => `<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('');
      }
      tbody.innerHTML = allExams.length ? allExams.map((ex) => {
        const statusLabel = ex.status === 'DRAFT' ? 'Draft' : ex.status === 'SUBMITTED' ? 'Pending approval' : 'Published';
        const action = ex.status === 'DRAFT' ? `<button class="outline-button" data-submit-teacher-exam="${ex.id}">Submit for approval</button>` : ex.status === 'SUBMITTED' ? '<span class="view-only-badge">Awaiting approval</span>' : `<button class="outline-button" data-view-exam-results="${ex.id}">View results</button>`;
        return `<tr class="${ex.rejectionReason ? 'row-flagged' : ''}"><td><strong>${ex.title}</strong>${ex.rejectionReason ? `<br><small class="reason-note">Sent back: ${ex.rejectionReason}</small>` : ''}</td><td>${ex.armLabel}</td><td>${ex._count.questions} questions</td><td><span class="status ${ex.status !== 'PUBLISHED' ? 'pending' : ''}">${statusLabel}</span></td><td class="row-action">${action}</td></tr>`;
      }).join('') : '<tr><td colspan="5">No CBT exams yet.</td></tr>';
    } catch (err) { tbody.innerHTML = `<tr><td colspan="5">Could not load exams (${err.message})</td></tr>`; }
  }
  async function submitTeacherExam(id) {
    try { await window.SchoolOS.api('/cbt-exams/' + id + '/submit', { method: 'POST' }); window.SchoolOS.toast('Submitted for approval'); loadRealCbtExamsTeacher(); } catch (err) { window.SchoolOS.toast(`Could not submit (${err.message})`); }
  }
  async function openExamResultsModal(id) {
    try {
      const data = await window.SchoolOS.api('/cbt-exams/' + id + '/attempts');
      const s = data.stats, pctOr = (v) => v === null ? '—' : `${v}%`;
      window.SchoolOS.detailModal({ eyebrow: 'Exam results', title: 'Results', rows: [['Average score', pctOr(s.averagePct)], ['Highest score', pctOr(s.highestPct)], ['Lowest score', pctOr(s.lowestPct)], ['Completion rate', pctOr(s.completionRate)], ['Attempts submitted', String(data.attempts.filter((a) => a.status === 'SUBMITTED').length)]] });
    } catch (err) { window.SchoolOS.toast(`Could not load results (${err.message})`); }
  }
  /** Independent class + subject pickers, same reasoning as
   * openNewLessonModal; mirrors what CbtExamsService actually validates
   * server-side rather than a TeacherSubjectAssignment cross-check. */
  async function openNewExamModal() {
    let arms = [], assignments = [];
    try {
      [arms, assignments] = await Promise.all([window.SchoolOS.api('/portal/teacher/class-arms'), window.SchoolOS.api('/portal/teacher/classes')]);
    } catch (err) { window.SchoolOS.toast(`Could not load your classes (${err.message})`); return; }
    if (!arms.length) { window.SchoolOS.toast('You are not assigned to any class yet'); return; }
    const subjectNames = [...new Set(assignments.map((a) => a.subject.name))];
    if (!subjectNames.length) { window.SchoolOS.toast('You are not assigned to teach any subject yet'); return; }
    const subjectByName = Object.fromEntries(assignments.map((a) => [a.subject.name, a.subject.id]));
    const armByLabel = Object.fromEntries(arms.map((a) => [`${a.schoolClassName} · ${a.armName}`, a.id]));

    window.SchoolOS.openModal(`<p class="eyebrow">CBT Exams</p><h2>New CBT exam</h2><p class="modal-sub">Creates a real exam via the SchoolOS API. Add your questions below: each needs 4 options and exactly one correct answer.</p>
      <form onsubmit="__examSubmit(event)">
        <div class="form-row"><div class="form-field"><label>Exam title</label><input name="title" placeholder="e.g. Mid-term mock test"></div><div class="form-field"><label>Class</label><select name="cls">${Object.keys(armByLabel).map((c) => `<option>${c}</option>`).join('')}</select></div></div>
        <div class="form-row"><div class="form-field"><label>Subject</label><select name="subject">${subjectNames.map((s) => `<option>${s}</option>`).join('')}</select></div><div class="form-field"><label>Duration (minutes)</label><input name="duration" type="number" placeholder="30"></div></div>
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
    window.__examSubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const title = (fd.get('title') || '').trim();
      const durationMinutes = Number(fd.get('duration'));
      const classArmId = armByLabel[fd.get('cls')];
      const subjectId = subjectByName[fd.get('subject')];
      if (!title || !durationMinutes || !classArmId || !subjectId) { window.SchoolOS.toast('Title, class, subject and duration are required'); return; }
      const blocks = document.querySelectorAll('#examQuestions .question-block');
      if (!blocks.length) { window.SchoolOS.toast('Add at least one question'); return; }
      const questions = [];
      for (const b of blocks) {
        const text = b.querySelector('.eq-text').value.trim();
        const opts = Array.from(b.querySelectorAll('.eq-opt')).map((o) => o.value.trim());
        if (!text || opts.some((o) => !o)) { window.SchoolOS.toast('Every question needs text and all 4 options filled in'); return; }
        const correctIndex = Number(b.querySelector('.eq-correct').value);
        questions.push({ text, options: opts.map((optText, i) => ({ text: optText, isCorrect: i === correctIndex })) });
      }
      try {
        await window.SchoolOS.api('/cbt-exams', { method: 'POST', body: JSON.stringify({ classArmId, subjectId, title, durationMinutes, questions }) });
        window.SchoolOS.closeModal();
        loadRealCbtExamsTeacher();
        window.SchoolOS.toast(`Draft saved · ${title} (${questions.length} question${questions.length === 1 ? '' : 's'})`);
      } catch (err) { window.SchoolOS.toast(`Could not save exam (${err.message})`); }
    };
  }

  function pageCbtExamsStudent(label) {
    return `<section class="page workspace-page" id="cbt-exams">
      <div id="cbtListView"><div class="page-heading"><div><p class="eyebrow">CBT Exams</p><h1>${label}</h1><p class="subtitle">Published CBT exams for your class.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Exam</th><th>Subject</th><th>Duration</th><th>Questions</th><th>Status</th><th></th></tr></thead><tbody id="realCbtStudentBody"><tr><td colspan="6">Loading…</td></tr></tbody></table></section></div>
      <div id="cbtRunner" style="display:none"></div>
      <div id="cbtResultView" style="display:none"></div>
    </section>`;
  }
  async function loadRealCbtExamsStudent() {
    const tbody = document.getElementById('realCbtStudentBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    const user = window.SchoolOS.getUser();
    if (!user || user.role !== 'STUDENT') { tbody.innerHTML = '<tr><td colspan="6">Sign in as a real student account to see live data.</td></tr>'; return; }
    tbody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';
    try {
      const me = await window.SchoolOS.api('/portal/student/me');
      if (!me.currentClassArmId) { tbody.innerHTML = '<tr><td colspan="6">Not yet assigned to a class.</td></tr>'; return; }
      const exams = await window.SchoolOS.api('/class-arms/' + me.currentClassArmId + '/cbt-exams');
      studentCbtExams = exams;
      tbody.innerHTML = exams.length ? exams.map((ex) => {
        const statusLabel = ex.myAttempt ? (ex.myAttempt.status === 'SUBMITTED' ? `Completed · ${ex.myAttempt.score}/${ex.myAttempt.totalMarks}` : 'In progress') : 'Not started';
        const action = ex.myAttempt && ex.myAttempt.status === 'SUBMITTED' ? `<button class="outline-button" data-view-own-result="${ex.id}">View result</button>` : `<button class="new-button" data-cbt-start="${ex.id}">${ex.myAttempt ? 'Resume' : 'Start'}</button>`;
        return `<tr><td><strong>${ex.title}</strong></td><td>${ex.subject?.name || '—'}</td><td>${ex.durationMinutes} min</td><td>${ex._count.questions}</td><td><span class="status ${ex.myAttempt?.status === 'SUBMITTED' ? '' : 'pending'}">${statusLabel}</span></td><td class="row-action">${action}</td></tr>`;
      }).join('') : '<tr><td colspan="6">No CBT exams published yet.</td></tr>';
    } catch (err) { tbody.innerHTML = `<tr><td colspan="6">Could not load exams (${err.message})</td></tr>`; }
  }
  function openOwnExamResultModal(examId) {
    const ex = studentCbtExams.find((x) => x.id === examId);
    if (!ex || !ex.myAttempt) return;
    window.SchoolOS.detailModal({ eyebrow: ex.subject?.name || 'CBT Exams', title: ex.title, rows: [['Your score', `${ex.myAttempt.score}/${ex.myAttempt.totalMarks}`], ['Questions', String(ex._count.questions)]] });
  }

  function pageCbtExam(label) { return currentRole === 'teacher' ? pageCbtExamsTeacher(label) : pageCbtExamsStudent(label); }

  // ---- CBT runner: starts a real attempt, walks real questions (options
  // never carry isCorrect for a STUDENT; see CbtExamsService.getOne),
  // submits and shows the real auto-graded score. ----
  let cbtState = null;
  function cbtRenderGrid() {
    const grid = document.getElementById('cbtQGrid'); if (!grid) return;
    grid.innerHTML = cbtState.questions.map((q, i) => `<button data-q="${i}" class="${i === cbtState.current ? 'current' : ''} ${cbtState.answers[q.id] ? 'answered' : ''}">${i + 1}</button>`).join('');
  }
  function cbtRenderQuestion() {
    const q = cbtState.questions[cbtState.current];
    document.getElementById('cbtQNum').textContent = `Question ${cbtState.current + 1} of ${cbtState.questions.length}`;
    document.getElementById('cbtQText').textContent = q.text;
    document.getElementById('cbtOptions').innerHTML = q.options.map((o) => `<button class="cbt-option ${cbtState.answers[q.id] === o.id ? 'selected' : ''}" data-opt="${o.id}">${o.text}</button>`).join('');
    document.getElementById('cbtPrevBtn').disabled = cbtState.current === 0;
    document.getElementById('cbtNextBtn').textContent = cbtState.current === cbtState.questions.length - 1 ? 'Finish' : 'Next →';
    cbtRenderGrid();
  }
  function cbtRenderTimer() {
    const el = document.getElementById('cbtTimer'); if (!el) return;
    const m = String(Math.floor(cbtState.remaining / 60)).padStart(2, '0'), s = String(cbtState.remaining % 60).padStart(2, '0');
    el.textContent = `${m}:${s}`;
  }
  function cbtTick() { cbtState.remaining--; cbtRenderTimer(); if (cbtState.remaining <= 0) cbtSubmitExam(); }
  async function startCbtExam(examId) {
    try {
      const attempt = await window.SchoolOS.api('/cbt-exams/' + examId + '/attempts', { method: 'POST' });
      if (attempt.status === 'SUBMITTED') { window.SchoolOS.toast('You have already submitted this exam'); openOwnExamResultModal(examId); return; }
      const detail = await window.SchoolOS.api('/cbt-exams/' + examId);
      cbtState = { examId, attemptId: attempt.id, title: detail.title, subject: detail.subject?.name || '', questions: detail.questions, answers: {}, current: 0, remaining: detail.durationMinutes * 60, timer: null };
      document.getElementById('cbtListView').style.display = 'none';
      document.getElementById('cbtResultView').style.display = 'none';
      const runner = document.getElementById('cbtRunner');
      runner.style.display = 'block';
      runner.innerHTML = `<div class="cbt-runner-head"><div><p class="eyebrow">${cbtState.subject}</p><h2>${cbtState.title}</h2></div><div class="cbt-timer" id="cbtTimer"></div></div><div class="cbt-runner-body"><div class="cbt-question-card"><p class="cbt-qnum" id="cbtQNum"></p><h3 id="cbtQText"></h3><div class="cbt-options" id="cbtOptions"></div><div class="cbt-runner-actions"><button type="button" class="outline-button" id="cbtPrevBtn">← Previous</button><button type="button" class="new-button" id="cbtNextBtn">Next →</button></div></div><div class="cbt-nav-panel"><p class="eyebrow">Questions</p><div class="cbt-qgrid" id="cbtQGrid"></div></div></div>`;
      cbtRenderQuestion(); cbtRenderTimer();
      cbtState.timer = setInterval(cbtTick, 1000);
    } catch (err) { window.SchoolOS.toast(`Could not start exam (${err.message})`); }
  }
  function cbtSelectOption(optionId) { cbtState.answers[cbtState.questions[cbtState.current].id] = optionId; cbtRenderQuestion(); }
  function cbtGoTo(i) { cbtState.current = i; cbtRenderQuestion(); }
  function cbtNext() { if (cbtState.current < cbtState.questions.length - 1) { cbtState.current++; cbtRenderQuestion(); } else cbtSubmitExam(); }
  function cbtPrev() { if (cbtState.current > 0) { cbtState.current--; cbtRenderQuestion(); } }
  async function cbtSubmitExam() {
    clearInterval(cbtState.timer);
    const { examId, attemptId, questions, answers } = cbtState;
    document.getElementById('cbtRunner').style.display = 'none';
    const rv = document.getElementById('cbtResultView');
    rv.style.display = 'block';
    rv.innerHTML = '<section class="data-card"><p>Submitting…</p></section>';
    try {
      const payload = { answers: questions.map((q) => ({ questionId: q.id, selectedOptionId: answers[q.id] })) };
      const result = await window.SchoolOS.api('/cbt-exams/' + examId + '/attempts/' + attemptId + '/submit', { method: 'POST', body: JSON.stringify(payload) });
      const pct = Math.round((result.score / result.totalMarks) * 100);
      rv.innerHTML = `<section class="data-card cbt-result-card"><p class="eyebrow">Exam submitted</p><h2>${result.score} / ${result.totalMarks} correct</h2><div class="cbt-score-bar"><span style="width:${pct}%"></span></div><p class="cbt-score-note">${pct >= 50 ? 'Well done. You passed.' : 'Keep practising. Review the topics you missed.'}</p><button class="new-button" id="cbtBackBtn">Back to exams</button></section>`;
    } catch (err) {
      rv.innerHTML = `<section class="data-card"><p>Could not submit exam (${err.message})</p><button class="new-button" id="cbtBackBtn">Back to exams</button></section>`;
    }
    cbtState = null;
  }

  // ============ Lessons (real) ============
  const resourceChipsFor = (l) => (l.resources && l.resources.length) ? l.resources.map((r) => `<span class="permission-chip">${r.type} · ${r.name}</span>`).join('') : '<small>No resources yet</small>';

  function pageLessonsTeacher(label) {
    return `<section class="page workspace-page" id="lessons"><div class="page-heading"><div><p class="eyebrow">Lessons</p><h1>${label}</h1><p class="subtitle">Create lessons and share resources with your assigned subject and class.</p></div><button class="new-button" data-modal="new-lesson">+ New lesson</button></div><section class="data-card"><table class="data-table"><thead><tr><th>Lesson</th><th>Subject</th><th>Class</th><th>Date</th><th>Resources</th><th></th></tr></thead><tbody id="realLessonsTeacherBody"><tr><td colspan="6">Loading…</td></tr></tbody></table></section></section>`;
  }
  async function loadRealLessonsTeacher() {
    const tbody = document.getElementById('realLessonsTeacherBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';
    try {
      const arms = await window.SchoolOS.api('/portal/teacher/class-arms');
      if (!arms.length) { tbody.innerHTML = '<tr><td colspan="6">You are not assigned to any class yet.</td></tr>'; return; }
      const lists = await Promise.all(arms.map((a) => window.SchoolOS.api('/class-arms/' + a.id + '/lessons').then((list) => list.map((l) => ({ ...l, armLabel: a.schoolClassName + ' · ' + a.armName })))));
      const allLessons = lists.flat();
      tbody.innerHTML = allLessons.length ? allLessons.map((l) => `<tr><td><strong>${l.title}</strong>${l.notes ? `<br><small>${l.notes}</small>` : ''}</td><td>${l.subject?.name || '—'}</td><td>${l.armLabel}</td><td>${new Date(l.createdAt).toDateString()}</td><td>${resourceChipsFor(l)}</td><td class="row-action"><button class="outline-button" data-add-resource="${l.id}">+ Resource</button></td></tr>`).join('') : '<tr><td colspan="6">No lessons posted yet.</td></tr>';
    } catch (err) { tbody.innerHTML = `<tr><td colspan="6">Could not load lessons (${err.message})</td></tr>`; }
  }
  /** Independent class + subject pickers; mirrors what LessonsService
   * actually validates server-side (teacher can act on the arm, subject
   * exists), which doesn't cross-check the pair the way TeacherSubjectAssignment
   * does for Results. */
  async function openNewLessonModal() {
    let arms = [], assignments = [];
    try {
      [arms, assignments] = await Promise.all([window.SchoolOS.api('/portal/teacher/class-arms'), window.SchoolOS.api('/portal/teacher/classes')]);
    } catch (err) { window.SchoolOS.toast(`Could not load your classes (${err.message})`); return; }
    if (!arms.length) { window.SchoolOS.toast('You are not assigned to any class yet'); return; }
    const subjectNames = [...new Set(assignments.map((a) => a.subject.name))];
    if (!subjectNames.length) { window.SchoolOS.toast('You are not assigned to teach any subject yet'); return; }
    const subjectByName = Object.fromEntries(assignments.map((a) => [a.subject.name, a.subject.id]));
    const armByLabel = Object.fromEntries(arms.map((a) => [`${a.schoolClassName} · ${a.armName}`, a.id]));

    window.SchoolOS.formModal({
      eyebrow: 'Lessons', title: 'New lesson', sub: 'Creates a real lesson via the SchoolOS API: POST /lessons.',
      fields: [
        { name: 'classArm', label: 'Class', type: 'select', options: Object.keys(armByLabel) },
        { name: 'subject', label: 'Subject', type: 'select', options: subjectNames },
        { name: 'title', label: 'Lesson title', placeholder: 'e.g. Introduction to fractions' },
        { name: 'notes', label: 'Notes for students', type: 'textarea', placeholder: 'What should students focus on?' },
      ],
      submitLabel: 'Save lesson',
      onSubmit: async (d) => {
        const payload = { classArmId: armByLabel[d.classArm], subjectId: subjectByName[d.subject], title: (d.title || '').trim(), notes: d.notes || undefined };
        if (!payload.classArmId || !payload.subjectId || !payload.title) { window.SchoolOS.toast('Class, subject and title are required'); return; }
        try {
          await window.SchoolOS.api('/lessons', { method: 'POST', body: JSON.stringify(payload) });
          window.SchoolOS.toast(`Lesson published · ${payload.title}`);
          loadRealLessonsTeacher();
        } catch (err) { window.SchoolOS.toast(`Could not post lesson (${err.message})`); }
      },
    });
  }
  /** No file-upload storage is built yet (CLAUDE.md's file storage
   * abstraction is still just an interface); url is a plain optional
   * link field, same honesty as Assignment.resourceUrl. */
  function openAddResourceModal(lessonId) {
    window.SchoolOS.formModal({
      eyebrow: 'Lesson resource', title: 'Add resource', sub: 'Creates a real resource entry via the SchoolOS API. A URL is optional: no file upload storage is built yet, so this just records a link.',
      fields: [{ name: 'name', label: 'File / link name', placeholder: 'e.g. Worked-examples.pdf' }, { name: 'type', label: 'Resource type', type: 'select', options: ['PDF', 'Doc', 'Slides', 'Video', 'Image', 'Link'] }, { name: 'url', label: 'URL (optional)', placeholder: 'https://...' }],
      submitLabel: 'Add resource',
      onSubmit: async (d) => {
        const name = (d.name || '').trim();
        if (!name) { window.SchoolOS.toast('Resource name is required'); return; }
        try {
          await window.SchoolOS.api('/lessons/' + lessonId + '/resources', { method: 'POST', body: JSON.stringify({ name, type: d.type, url: d.url || undefined }) });
          window.SchoolOS.toast(`Resource added · ${name}`);
          loadRealLessonsTeacher();
        } catch (err) { window.SchoolOS.toast(`Could not add resource (${err.message})`); }
      },
    });
  }

  function pageLessonsStudent(label) {
    return `<section class="page workspace-page" id="lessons"><div class="page-heading"><div><p class="eyebrow">Lessons</p><h1>${label}</h1><p class="subtitle">Lessons posted for your class.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Lesson</th><th>Subject</th><th>Date</th><th>Resources</th></tr></thead><tbody id="realLessonsStudentBody"><tr><td colspan="4">Loading…</td></tr></tbody></table></section></section>`;
  }
  async function loadRealLessonsStudent() {
    const tbody = document.getElementById('realLessonsStudentBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    const user = window.SchoolOS.getUser();
    if (!user || user.role !== 'STUDENT') { tbody.innerHTML = '<tr><td colspan="4">Sign in as a real student account to see live data.</td></tr>'; return; }
    tbody.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';
    try {
      const me = await window.SchoolOS.api('/portal/student/me');
      if (!me.currentClassArmId) { tbody.innerHTML = '<tr><td colspan="4">Not yet assigned to a class.</td></tr>'; return; }
      const lessons = await window.SchoolOS.api('/class-arms/' + me.currentClassArmId + '/lessons');
      tbody.innerHTML = lessons.length ? lessons.map((l) => `<tr><td><strong>${l.title}</strong>${l.notes ? `<br><small>${l.notes}</small>` : ''}</td><td>${l.subject?.name || '—'}</td><td>${new Date(l.createdAt).toDateString()}</td><td>${resourceChipsFor(l)}</td></tr>`).join('') : '<tr><td colspan="4">No lessons posted yet.</td></tr>';
    } catch (err) { tbody.innerHTML = `<tr><td colspan="4">Could not load lessons (${err.message})</td></tr>`; }
  }

  function pageLessonsParent(label) {
    return `<section class="page workspace-page" id="lessons"><div class="page-heading"><div><p class="eyebrow">Lessons</p><h1>${label}</h1><p class="subtitle">Lessons posted for your children's classes.</p></div></div><div id="realLessonsParentBlocks"><p class="modal-sub">Loading…</p></div></section>`;
  }
  async function loadRealLessonsParent() {
    const container = document.getElementById('realLessonsParentBlocks');
    if (!container || !window.SchoolOS.getAccessToken()) return;
    container.innerHTML = '<p class="modal-sub">Loading…</p>';
    try {
      const children = await window.SchoolOS.api('/portal/parent/children');
      if (!children.length) { container.innerHTML = '<div class="data-card"><div class="empty-state"><span class="mini-avatar">▤</span><h3>No children linked yet</h3><p>Ask the school to link your account to your child’s record.</p></div></div>'; return; }
      const blocks = await Promise.all(children.map(async (link) => {
        const s = link.student;
        let rows = '<tr><td colspan="3">Not yet assigned to a class.</td></tr>';
        if (s.currentClassArmId) {
          try {
            const lessons = await window.SchoolOS.api('/class-arms/' + s.currentClassArmId + '/lessons');
            rows = lessons.length ? lessons.map((l) => `<tr><td><strong>${l.title}</strong></td><td>${l.subject?.name || '—'}</td><td>${resourceChipsFor(l)}</td></tr>`).join('') : '<tr><td colspan="3">No lessons posted yet.</td></tr>';
          } catch (err) { rows = `<tr><td colspan="3">Could not load (${err.message})</td></tr>`; }
        }
        return `<section class="data-card fee-child-card"><div class="data-toolbar"><div class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(s.firstName + ' ' + s.lastName)}</span><div><strong>${s.firstName} ${s.lastName}</strong><small>${s.admissionNo}</small></div></div></div><table class="data-table"><thead><tr><th>Lesson</th><th>Subject</th><th>Resources</th></tr></thead><tbody>${rows}</tbody></table></section>`;
      }));
      container.innerHTML = `<div class="fee-child-grid">${blocks.join('')}</div>`;
    } catch (err) { container.innerHTML = `<p class="modal-sub">Could not load your children (${err.message})</p>`; }
  }

  function pageLessonsOversight(label) {
    return `<section class="page workspace-page" id="lessons"><div class="page-heading"><div><p class="eyebrow">Lessons</p><h1>${label}</h1><p class="subtitle">Lessons posted across every class, view only.</p></div><span class="view-only-badge">View only</span></div><section class="data-card"><table class="data-table"><thead><tr><th>Lesson</th><th>Subject</th><th>Class</th><th>Teacher</th><th>Date</th><th>Resources</th></tr></thead><tbody id="realLessonsOversightBody"><tr><td colspan="6">Loading…</td></tr></tbody></table></section></section>`;
  }
  async function loadRealLessonsOversight() {
    const tbody = document.getElementById('realLessonsOversightBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';
    try {
      const classes = await window.SchoolOS.api('/classes');
      const arms = classes.flatMap((c) => (c.arms || []).map((a) => ({ id: a.id, label: c.name + ' · ' + a.name })));
      if (!arms.length) { tbody.innerHTML = '<tr><td colspan="6">No classes yet.</td></tr>'; return; }
      const lists = await Promise.all(arms.map((a) => window.SchoolOS.api('/class-arms/' + a.id + '/lessons').then((list) => list.map((l) => ({ ...l, armLabel: a.label }))).catch(() => [])));
      const allLessons = lists.flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      tbody.innerHTML = allLessons.length ? allLessons.map((l) => `<tr><td><strong>${l.title}</strong></td><td>${l.subject?.name || '—'}</td><td>${l.armLabel}</td><td>${l.createdByStaffProfile?.user ? l.createdByStaffProfile.user.firstName + ' ' + l.createdByStaffProfile.user.lastName : '—'}</td><td>${new Date(l.createdAt).toDateString()}</td><td>${resourceChipsFor(l)}</td></tr>`).join('') : '<tr><td colspan="6">No lessons posted yet.</td></tr>';
    } catch (err) { tbody.innerHTML = `<tr><td colspan="6">Could not load lessons (${err.message})</td></tr>`; }
  }

  function pageLessons(label) {
    if (currentRole === 'teacher') return pageLessonsTeacher(label);
    if (currentRole === 'student') return pageLessonsStudent(label);
    if (currentRole === 'parent') return pageLessonsParent(label);
    return pageLessonsOversight(label);
  }

  // ============ Content Approvals (real, CBT exam review + bulk result approval) ============
  function pageContentApprovals(label) {
    return `<section class="page workspace-page" id="content-approvals"><div class="page-heading"><div><p class="eyebrow">Approvals</p><h1>${label}</h1><p class="subtitle">CBT exams a teacher has submitted, and results awaiting approval, for every teacher and class. Assignments and Lessons post directly today: no review step for those.</p></div><button class="new-button" data-approve-all>Approve all pending</button></div><section class="data-card"><table class="data-table"><thead><tr><th>Exam</th><th>Class</th><th>Subject</th><th>Teacher</th><th>Questions</th><th></th></tr></thead><tbody id="realPendingExamsBody"><tr><td colspan="6">Loading…</td></tr></tbody></table></section></section>`;
  }
  /** One button, everywhere: bulk-approves every pending CBT exam (goes
   * live to students immediately, same as the per-row Approve button) and
   * every SUBMITTED result (moves to Approved; publishing is still a
   * separate, deliberate step) across the whole school, not scoped to one
   * class or teacher. Uses the same single-item endpoints as the per-row
   * buttons, so RBAC and per-item audit logging are unchanged; this is a
   * client-side loop, not a new bulk endpoint. */
  async function bulkApproveAll() {
    let exams = [], results = [];
    try { exams = await window.SchoolOS.api('/cbt-exams/pending-review'); } catch (err) { window.SchoolOS.toast(`Could not load pending exams (${err.message})`); return; }
    try { results = (await window.SchoolOS.api('/results')).filter((r) => r.status === 'SUBMITTED'); } catch (err) { window.SchoolOS.toast(`Could not load pending results (${err.message})`); return; }

    if (!exams.length && !results.length) { window.SchoolOS.toast('Nothing pending, all caught up'); return; }

    const msg = `Approve ${exams.length} pending exam${exams.length === 1 ? '' : 's'} and ${results.length} pending result${results.length === 1 ? '' : 's'}, across every teacher and class?\n\nExams go live to students immediately. Results move to Approved (publishing to students/parents is still a separate step).`;
    if (!window.confirm(msg)) return;

    window.SchoolOS.toast('Approving…');
    const [examOutcomes, resultOutcomes] = await Promise.all([
      Promise.allSettled(exams.map((ex) => window.SchoolOS.api('/cbt-exams/' + ex.id + '/approve', { method: 'POST' }))),
      Promise.allSettled(results.map((r) => window.SchoolOS.api('/results/' + r.id + '/approve', { method: 'PATCH' }))),
    ]);
    const examOk = examOutcomes.filter((o) => o.status === 'fulfilled').length;
    const resultOk = resultOutcomes.filter((o) => o.status === 'fulfilled').length;
    const failed = (exams.length - examOk) + (results.length - resultOk);
    window.SchoolOS.toast(`Approved ${examOk}/${exams.length} exams and ${resultOk}/${results.length} results${failed ? `; ${failed} failed` : ''}`);
    loadRealPendingExams();
    loadRealAcademicsResults();
  }
  async function loadRealPendingExams() {
    const tbody = document.getElementById('realPendingExamsBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';
    try {
      const exams = await window.SchoolOS.api('/cbt-exams/pending-review');
      tbody.innerHTML = exams.length ? exams.map((ex) => `<tr><td><strong>${ex.title}</strong></td><td>${ex.classArm.schoolClass.name} · ${ex.classArm.name}</td><td>${ex.subject?.name || '—'}</td><td>${ex.createdByStaffProfile?.user ? ex.createdByStaffProfile.user.firstName + ' ' + ex.createdByStaffProfile.user.lastName : '—'}</td><td>${ex._count.questions}</td><td class="row-action"><button class="outline-button" data-approve-exam="${ex.id}" data-exam-title="${ex.title}">Approve</button> <button class="outline-button" data-reject-exam="${ex.id}">Reject</button></td></tr>`).join('') : '<tr><td colspan="6">Nothing pending review.</td></tr>';
    } catch (err) { tbody.innerHTML = `<tr><td colspan="6">Could not load pending exams (${err.message})</td></tr>`; }
  }
  async function approvePendingExam(id) {
    try { await window.SchoolOS.api('/cbt-exams/' + id + '/approve', { method: 'POST' }); window.SchoolOS.toast('Exam approved and published'); loadRealPendingExams(); } catch (err) { window.SchoolOS.toast(`Could not approve (${err.message})`); }
  }
  function rejectPendingExam(id) {
    window.SchoolOS.formModal({
      eyebrow: 'CBT Exams', title: 'Reject exam', sub: 'Sends this exam back to the teacher as a draft, with your reason attached.',
      fields: [{ name: 'reason', label: 'Reason', type: 'textarea', placeholder: 'What needs to change?' }],
      submitLabel: 'Reject exam',
      onSubmit: async (d) => {
        const reason = (d.reason || '').trim();
        if (!reason) { window.SchoolOS.toast('A reason is required'); return; }
        try {
          await window.SchoolOS.api('/cbt-exams/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) });
          window.SchoolOS.toast('Exam sent back to the teacher');
          loadRealPendingExams();
        } catch (err) { window.SchoolOS.toast(`Could not reject (${err.message})`); }
      },
    });
  }

  // ============ Timetable (standalone, teacher / student / parent / principal) ============
  function pageTimetable(label) {
    const id = window.SchoolOS.slug(label);
    if (currentRole === 'student') {
      return `<section class="page workspace-page" id="${id}"><div class="page-heading"><div><p class="eyebrow">My timetable</p><h1>${label}</h1><p class="subtitle">Your class's real weekly schedule.</p></div></div><section class="data-card"><div id="studentTimetableGrid"><p class="modal-sub">Sign in as a student to load your timetable…</p></div></section></section>`;
    }
    if (currentRole === 'teacher') {
      return `<section class="page workspace-page" id="${id}"><div class="page-heading"><div><p class="eyebrow">My timetable</p><h1>${label}</h1><p class="subtitle">Every period you teach, across every class, with real times.</p></div></div><section class="data-card"><div id="teacherTimetableGrid"><p class="modal-sub">Sign in as a teacher to load your timetable…</p></div></section></section>`;
    }
    if (currentRole === 'parent') {
      return `<section class="page workspace-page" id="${id}"><div class="page-heading"><div><p class="eyebrow">Timetable</p><h1>${label}</h1><p class="subtitle">Your linked children's weekly timetables.</p></div></div><div id="parentTimetableBlocks"><p class="modal-sub">Sign in as a parent to load timetables…</p></div></section>`;
    }
    // PRINCIPAL (and anyone else reaching this standalone tab): same
    // picker + grid as Academics > Timetable, just in its own scope so
    // both can render into the DOM at once without id collisions.
    return `<section class="page workspace-page" id="${id}"><div class="page-heading"><div><p class="eyebrow">Timetable</p><h1>${label}</h1><p class="subtitle">Weekly schedule, generated automatically.</p></div></div><section class="data-card"><div id="ttStandaloneTimetableContainer"><p class="modal-sub">Loading…</p></div></section></section>`;
  }
  async function loadTeacherTimetable() {
    if (!document.getElementById('teacherTimetableGrid') || !window.SchoolOS.getAccessToken()) return;
    await loadTimetableGridByFetch('teacherTimetableGrid', '/portal/teacher/timetable', teacherCellFn);
  }
  async function loadStudentTimetable() {
    if (!document.getElementById('studentTimetableGrid') || !window.SchoolOS.getAccessToken()) return;
    await loadTimetableGridByFetch('studentTimetableGrid', '/portal/student/timetable', classArmCellFn);
  }
  async function loadParentTimetable() {
    const container = document.getElementById('parentTimetableBlocks');
    if (!container || !window.SchoolOS.getAccessToken()) return;
    container.innerHTML = '<p class="modal-sub">Loading…</p>';
    try {
      const children = await window.SchoolOS.api('/portal/parent/children');
      if (!children.length) { container.innerHTML = '<div class="data-card"><div class="empty-state"><span class="mini-avatar">▤</span><h3>No children linked yet</h3><p>Ask the school to link your account to your child’s record.</p></div></div>'; return; }
      const blocks = await Promise.all(children.map(async (link) => {
        const s = link.student;
        let gridHtml = '<p class="modal-sub">Loading…</p>';
        try { gridHtml = timetableGridHtml(await window.SchoolOS.api('/portal/parent/children/' + s.id + '/timetable'), classArmCellFn); } catch (err) { gridHtml = `<p class="modal-sub">Could not load (${err.message})</p>`; }
        return `<section class="data-card fee-child-card"><div class="data-toolbar"><div class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(s.firstName + ' ' + s.lastName)}</span><div><strong>${s.firstName} ${s.lastName}</strong><small>${s.admissionNo}</small></div></div></div>${gridHtml}</section>`;
      }));
      container.innerHTML = blocks.join('');
    } catch (err) { container.innerHTML = `<p class="modal-sub">Could not load your children (${err.message})</p>`; }
  }

  // ============ Student's own Classes / Notices / Profile ============
  function pageStudentClasses(label) {
    return `<section class="page workspace-page" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">My classes</p><h1>${label}</h1><p class="subtitle">Subjects and teachers for your class.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Subject</th><th>Teacher</th></tr></thead><tbody id="realStudentSubjectsBody"><tr><td colspan="2">Sign in as a student to load subjects…</td></tr></tbody></table></section></section>`;
  }
  function pageStudentNoticesReal(label) {
    return `<section class="page workspace-page" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Notices</p><h1>${label}</h1><p class="subtitle">Real in-app notifications for your account.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Notice</th><th>When</th><th></th></tr></thead><tbody id="realStudentNoticesBody"><tr><td colspan="3">Sign in as a student to load notices…</td></tr></tbody></table></section></section>`;
  }
  async function markNoticeAsRead(id) {
    try {
      await window.SchoolOS.api('/notifications/' + id + '/read', { method: 'PATCH' });
      loadRealStudentPortalData();
    } catch (err) { window.SchoolOS.toast(`Could not mark as read (${err.message})`); }
  }
  function pageStudentProfileReal(label) {
    return `<section class="page workspace-page" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Profile</p><h1>${label}</h1><p class="subtitle">Your real student record.</p></div></div><section class="data-card" id="realStudentProfileCard"><p>Sign in as a student to load your profile…</p></section></section>`;
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
      try {
        const notices = await window.SchoolOS.api('/notifications/me');
        noticesBody.innerHTML = notices.length ? notices.map((n) => `<tr><td><strong>${n.title}</strong><br><small>${n.body}</small></td><td>${new Date(n.createdAt).toLocaleString()}</td><td class="row-action">${n.readAt ? '<span class="status">Read</span>' : `<span class="status pending">Unread</span> <button class="outline-button" data-mark-notice-read="${n.id}">Mark as read</button>`}</td></tr>`).join('') : '<tr><td colspan="3">No notices yet.</td></tr>';
      } catch (err) { noticesBody.innerHTML = `<tr><td colspan="3">Could not load notices (${err.message})</td></tr>`; }
    }
    if (profileCard) {
      profileCard.innerHTML = '<p>Loading…</p>';
      try {
        const p = await window.SchoolOS.api('/portal/student/me');
        const cls = p.currentClassArm ? `${p.currentClassArm.schoolClass.name} · ${p.currentClassArm.name}` : 'Not yet assigned to a class';
        const guardians = p.guardianLinks.length ? p.guardianLinks.map((g) => `${g.guardian.firstName} ${g.guardian.lastName} (${g.relationship.toLowerCase()})`).join(', ') : 'No guardian linked yet';
        const isSeniorSecondary = p.currentClassArm && p.currentClassArm.schoolClass.level === 'SENIOR_SECONDARY';
        // Stream itself is admin-assigned (at creation, or directly by an
        // admin later), a student never sets it instantly. Only a
        // student in their first Senior Secondary class (canRequestStreamChange,
        // computed server-side from the promotion chain) can even request
        // a switch, and it needs an admin's approval before anything
        // actually changes (see StudentsService.requestStreamChange).
        let streamRow = '';
        if (isSeniorSecondary) {
          const currentStreamLabel = p.stream ? STREAM_LABELS[p.stream] : 'Not set yet';
          streamRow = `<div class="modal-detail-row"><span>Stream</span><strong>${currentStreamLabel}</strong></div>`;
          if (p.canRequestStreamChange) {
            let pending = null;
            try { pending = (await window.SchoolOS.api('/portal/student/stream-requests')).find((r) => r.status === 'PENDING'); } catch (err) { /* non-fatal, just won't show pending state */ }
            streamRow += pending
              ? `<div class="modal-detail-row"><span>Switch request</span><strong>Pending: requested ${STREAM_LABELS[pending.requestedStream]}</strong></div>`
              : `<div class="modal-detail-row"><span>Switch stream</span><span class="inline-edit-row"><select id="requestStreamSelect" aria-label="Requested stream"><option value="">— Choose —</option>${Object.entries(STREAM_LABELS).filter(([k]) => k !== p.stream).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><button type="button" class="outline-button" id="requestStreamSwitchBtn">Request switch</button></span></div>`;
          }
        }
        const photoHtml = p.photoUrl
          ? `<img src="${p.photoUrl}" alt="" style="width:88px;height:88px;border-radius:50%;object-fit:cover;margin-bottom:16px">`
          : `<span class="mini-avatar" style="width:88px;height:88px;font-size:26px;margin-bottom:16px">${window.SchoolOS.initialsOf(p.firstName + " " + p.lastName)}</span>`;
        const mySubjectsRow = isSeniorSecondary ? await renderMySubjectsRow(p) : '';
        profileCard.innerHTML = `<div class="modal-detail">${photoHtml}<div class="modal-detail-row"><span>Name</span><strong>${p.firstName} ${p.lastName}</strong></div><div class="modal-detail-row"><span>Admission No.</span><strong>${p.admissionNo}</strong></div><div class="modal-detail-row"><span>Class</span><strong>${cls}</strong></div><div class="modal-detail-row"><span>Status</span><strong>${p.status}</strong></div><div class="modal-detail-row"><span>Gender</span><strong>${p.gender || '—'}</strong></div><div class="modal-detail-row"><span>Date of birth</span><strong>${p.dateOfBirth ? new Date(p.dateOfBirth).toDateString() : '—'}</strong></div><div class="modal-detail-row"><span>Guardian(s)</span><strong>${guardians}</strong></div>${streamRow}${mySubjectsRow}</div>`;
        const requestBtn = document.getElementById('requestStreamSwitchBtn');
        if (requestBtn) requestBtn.addEventListener('click', async () => {
          const requestedStream = document.getElementById('requestStreamSelect').value;
          if (!requestedStream) { window.SchoolOS.toast('Choose a stream first'); return; }
          try { await window.SchoolOS.api('/portal/student/stream-requests', { method: 'POST', body: JSON.stringify({ requestedStream }) }); window.SchoolOS.toast('Switch request submitted, awaiting admin approval'); loadRealStudentPortalData(); } catch (err) { window.SchoolOS.toast(`Could not submit request (${err.message})`); }
        });
        bindMySubjectsHandlers();
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

    // Fire every loader; each is individually DOM-guarded, matching the
    // original SPA's "run them all on every render" pattern.
    loadRealTeachers(); loadRealClasses(); loadRealSubjects(); loadRealAcademicsResults(); loadGradingScale();
    loadRealTeacherResults(); loadRealParentResults(); loadRealTeacherAssignments(); loadRealStudentPortalData();
    loadRealMyClasses();
    loadRealLessonsTeacher(); loadRealLessonsStudent(); loadRealLessonsParent(); loadRealLessonsOversight();
    loadRealCbtExamsTeacher(); loadRealCbtExamsStudent(); loadRealPendingExams();
    loadTeacherTimetable(); loadStudentTimetable(); loadParentTimetable();
    renderAdminTimetableSection('academics'); renderAdminTimetableSection('ttStandalone');
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
    'add-marks': openAddMarksModal, 'new-assignment-real': openNewAssignmentRealModal,
    'new-exam': openNewExamModal, 'new-lesson': openNewLessonModal, 'new-grade-band': openNewGradeBandModal,
  });

  document.addEventListener('click', (e) => {
    const outerTab = e.target.closest('#academicsOuterTabs button');
    if (outerTab) { showTab(outerTab.dataset.tab); history.replaceState(null, '', '#' + outerTab.dataset.tab); }
    const gt = e.target.closest('[data-goto-tab]'); if (gt) { const tb = document.querySelector('.workspace-page.visible [data-tab="' + gt.dataset.gotoTab + '"]'); if (tb) tb.click(); }
    const addArm = e.target.closest('[data-add-arm]'); if (addArm) openNewClassArmModal(addArm.dataset.addArm);
    const saveLevel = e.target.closest('[data-save-level]'); if (saveLevel) saveClassLevel(saveLevel.dataset.saveLevel);
    const saveArmStr = e.target.closest('[data-save-arm-stream]'); if (saveArmStr) saveArmStream(saveArmStr.dataset.saveArmStream, saveArmStr.dataset.armClassId);
    const savePromotesTo = e.target.closest('[data-save-promotes-to]'); if (savePromotesTo) saveClassPromotesTo(savePromotesTo.dataset.savePromotesTo);
    const promoteArm = e.target.closest('[data-promote-arm]'); if (promoteArm) openPromotionModal(promoteArm.dataset.promoteArm, promoteArm.dataset.armLabel);
    const viewClass = e.target.closest('[data-view-class]'); if (viewClass) openClassDetailModal(viewClass.dataset.viewClass);
    const viewTeacher = e.target.closest('[data-view-teacher]'); if (viewTeacher) openTeacherDetailModal(viewTeacher.dataset.viewTeacher);
    const editTeacher = e.target.closest('[data-edit-teacher]'); if (editTeacher) openTeacherDetailModal(editTeacher.dataset.editTeacher, true);
    const cancelEditTeacher = e.target.closest('[data-cancel-edit-teacher]'); if (cancelEditTeacher) openTeacherDetailModal(cancelEditTeacher.dataset.cancelEditTeacher, false);
    const rmAsg = e.target.closest('[data-remove-assignment]');
    if (rmAsg && window.confirm(`Remove ${rmAsg.dataset.teacherName} as the ${rmAsg.dataset.subjectName} teacher for ${rmAsg.dataset.className}?`)) removeTeacherAssignment(rmAsg.dataset.removeAssignment);
    const submitResultBtn = e.target.closest('[data-submit-result]'); if (submitResultBtn) submitResult(submitResultBtn.dataset.submitResult);
    const approveBtn = e.target.closest('[data-approve-real-result]');
    if (approveBtn && window.confirm(`Approve ${approveBtn.dataset.studentName}'s ${approveBtn.dataset.subjectName} result?`)) approveRealResult(approveBtn.dataset.approveRealResult);
    const publishBtn = e.target.closest('[data-publish-real-result]');
    if (publishBtn && window.confirm(`Publish ${publishBtn.dataset.studentName}'s ${publishBtn.dataset.subjectName} result? This makes it visible to the student and their parent(s).`)) publishRealResult(publishBtn.dataset.publishRealResult);
    const egb = e.target.closest('[data-edit-grade-band]'); if (egb) openEditGradeBandModal(egb.dataset.editGradeBand, egb.dataset.grade, egb.dataset.min, egb.dataset.max, egb.dataset.meaning);
    const dgb = e.target.closest('[data-delete-grade-band]'); if (dgb) deleteGradeBand(dgb.dataset.deleteGradeBand, dgb.dataset.grade);
    const editSubj = e.target.closest('[data-edit-subject]'); if (editSubj) openEditSubjectModal(editSubj.dataset.editSubject);
    const delSubj = e.target.closest('[data-delete-subject]'); if (delSubj) deleteSubjectRow(delSubj.dataset.deleteSubject, delSubj.dataset.subjectName);
    const genTt = e.target.closest('[data-generate-timetable]'); if (genTt) generateTimetableAndReload();
    const ttSettings = e.target.closest('[data-open-timetable-settings]'); if (ttSettings) openTimetableSettingsModal();
    const apAll = e.target.closest('[data-approve-all]'); if (apAll) bulkApproveAll();
    const mnr = e.target.closest('[data-mark-notice-read]'); if (mnr) markNoticeAsRead(mnr.dataset.markNoticeRead);
    const adr = e.target.closest('[data-add-resource]'); if (adr) openAddResourceModal(adr.dataset.addResource);
    const ste = e.target.closest('[data-submit-teacher-exam]'); if (ste) submitTeacherExam(ste.dataset.submitTeacherExam);
    const ver = e.target.closest('[data-view-exam-results]'); if (ver) openExamResultsModal(ver.dataset.viewExamResults);
    const vor = e.target.closest('[data-view-own-result]'); if (vor) openOwnExamResultModal(vor.dataset.viewOwnResult);
    const start = e.target.closest('[data-cbt-start]'); if (start) startCbtExam(start.dataset.cbtStart);
    const opt = e.target.closest('.cbt-option'); if (opt) cbtSelectOption(opt.dataset.opt);
    const qbtn = e.target.closest('#cbtQGrid button'); if (qbtn) cbtGoTo(Number(qbtn.dataset.q));
    if (e.target.closest('#cbtNextBtn')) cbtNext();
    if (e.target.closest('#cbtPrevBtn')) cbtPrev();
    if (e.target.closest('#cbtBackBtn')) { document.getElementById('cbtResultView').style.display = 'none'; document.getElementById('cbtListView').style.display = ''; loadRealCbtExamsStudent(); }
    const apEx = e.target.closest('[data-approve-exam]');
    if (apEx && window.confirm(`Approve and publish "${apEx.dataset.examTitle}"? Students will be able to attempt it immediately.`)) approvePendingExam(apEx.dataset.approveExam);
    const rjEx = e.target.closest('[data-reject-exam]'); if (rjEx) rejectPendingExam(rjEx.dataset.rejectExam);
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'classesLevelFilter') renderClassesTable();
    if (e.target.id === 'subjectsLevelFilter') renderSubjectsTable();
    if (e.target.id === 'teachersLevelFilter') renderTeachersTable();
    const ttSel = e.target.closest('[data-timetable-arm-select]');
    if (ttSel) { const scope = ttSel.dataset.timetableArmSelect; timetableSelectedArm[scope] = e.target.value; loadTimetableGridByFetch(`${scope}TimetableGrid`, `/timetable/class-arm/${e.target.value}`, classArmCellFn); }
    const sct = e.target.closest('[data-set-class-teacher]');
    if (sct) {
      const teacherName = e.target.value ? e.target.selectedOptions[0].textContent : null;
      const armName = sct.dataset.armName || 'this class';
      const message = teacherName ? `Make ${teacherName} the class teacher of ${armName}?` : `Remove the current class teacher from ${armName}?`;
      if (window.confirm(message)) {
        sct.dataset.previousValue = e.target.value;
        setArmClassTeacher(sct.dataset.setClassTeacher, e.target.value);
      } else {
        e.target.value = sct.dataset.previousValue || '';
      }
    }
    const rst = e.target.closest('[data-reassign-subject-teacher]');
    if (rst) {
      const teacherName = e.target.selectedOptions[0].textContent;
      if (window.confirm(`Make ${teacherName} the ${rst.dataset.subjectName} teacher for this class? This replaces the current subject teacher.`)) {
        reassignSubjectTeacher(rst.dataset.reassignSubjectTeacher, rst.dataset.subjectId, e.target.value);
      } else {
        e.target.value = rst.dataset.previousValue || '';
      }
    }
  });

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
      else if (id === 'lessons' && currentRole === 'teacher') openNewLessonModal();
      else window.SchoolOS.toast('Open a tab that supports creating a record');
    };
    renderForRole(role);
  });
})();
