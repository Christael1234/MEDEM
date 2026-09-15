// Students & Admissions module. Students is real (SchoolOS API); Admissions
// is the original interactive demo kanban (no backend admissions pipeline
// exists yet); both were separate top-level nav items in the old SPA,
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
  const LEVEL_LABELS = { NURSERY: 'Nursery', PRIMARY: 'Primary', JUNIOR_SECONDARY: 'Junior Secondary', SENIOR_SECONDARY: 'Senior Secondary' };
  const STREAM_LABELS = { SCIENCE: 'Science', ART: 'Art' };
  let lastLoadedStudents = [];
  let lastLoadedClasses = [];
  let lastArmInfoById = {};
  async function loadRealStudents() {
    const tbody = document.getElementById('realStudentsBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5">Loading students…</td></tr>';
    try {
      const [students, classes] = await Promise.all([window.SchoolOS.api('/students'), window.SchoolOS.api('/classes').catch(() => [])]);
      lastLoadedStudents = students;
      lastLoadedClasses = classes;
      lastArmInfoById = {};
      classes.forEach((c) => (c.arms || []).forEach((a) => { lastArmInfoById[a.id] = { classId: c.id, className: c.name, armName: a.name, level: c.level }; }));
      populateStudentsClassArmFilters();
      renderStudentsTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5">Could not load students (${err.message})</td></tr>`;
    }
  }
  /** Level -> Class -> Arm cascading filter: each select's options
   * narrow to what the level(s) above it actually allow, current
   * selections are preserved across a reload where still valid (e.g.
   * after adding a student), and picking a level/class resets whatever
   * is below it since the old choice may no longer apply. */
  function populateStudentsClassArmFilters() {
    const levelSelect = document.getElementById('studentsLevelFilter');
    const classSelect = document.getElementById('studentsClassFilter');
    const armSelect = document.getElementById('studentsArmFilter');
    if (!levelSelect || !classSelect || !armSelect) return;
    const level = levelSelect.value;
    const previousClass = classSelect.value;
    const classesForLevel = lastLoadedClasses.filter((c) => !level || c.level === level);
    classSelect.innerHTML = '<option value="">All classes</option>' + classesForLevel.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
    classSelect.value = classesForLevel.some((c) => c.id === previousClass) ? previousClass : '';
    classSelect.disabled = !classesForLevel.length;

    const classId = classSelect.value;
    const selectedClass = lastLoadedClasses.find((c) => c.id === classId);
    const previousArm = armSelect.value;
    const armsForClass = selectedClass ? selectedClass.arms || [] : [];
    armSelect.innerHTML = '<option value="">All arms</option>' + armsForClass.map((a) => `<option value="${a.id}">${a.name}</option>`).join('');
    armSelect.value = armsForClass.some((a) => a.id === previousArm) ? previousArm : '';
    armSelect.disabled = !armsForClass.length;
  }
  function renderStudentsTable() {
    const tbody = document.getElementById('realStudentsBody');
    if (!tbody) return;
    const level = document.getElementById('studentsLevelFilter')?.value || '';
    const classId = document.getElementById('studentsClassFilter')?.value || '';
    const armId = document.getElementById('studentsArmFilter')?.value || '';
    const students = lastLoadedStudents.filter((s) => {
      const arm = lastArmInfoById[s.currentClassArmId];
      if (armId) return s.currentClassArmId === armId;
      if (classId) return arm?.classId === classId;
      if (level) return arm?.level === level;
      return true;
    });
    tbody.innerHTML = students.length ? students.map((s) => {
      const arm = lastArmInfoById[s.currentClassArmId];
      return `<tr><td><div class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(s.firstName + ' ' + s.lastName)}</span>${s.firstName} ${s.lastName}</div></td><td>${s.admissionNo}</td><td>${arm ? `${arm.className} · ${arm.armName}` : '—'}</td><td><span class="status">${s.status}</span></td><td class="row-action"><button class="outline-button" data-view-student="${s.id}">View</button></td></tr>`;
    }).join('') : `<tr><td colspan="5">No students match this filter yet.</td></tr>`;
  }

  const GUARDIAN_RELATIONSHIPS = [['MOTHER', 'Mother'], ['FATHER', 'Father'], ['GRANDPARENT', 'Grandparent'], ['SIBLING', 'Sibling'], ['LEGAL_GUARDIAN', 'Legal guardian'], ['OTHER', 'Other']];

  function guardianBlockHtml(idx, required) {
    return `<div class="detail-section" data-guardian-block="${idx}">
      <p class="eyebrow">Parent / guardian ${idx}${required ? ' (required)' : ''}</p>
      <div class="form-field">
        <label>Search an existing parent</label>
        <input type="text" data-guardian-search="${idx}" placeholder="Type a name to find a parent already on file…" autocomplete="off">
        <div data-guardian-results="${idx}" class="guardian-search-results"></div>
      </div>
      <div data-guardian-selected="${idx}" class="guardian-selected-chip" style="display:none"></div>
      <div data-guardian-new-fields="${idx}">
        <p class="modal-sub" style="margin:6px 0">Or add a new parent:</p>
        <div class="inline-edit-row">
          <input data-guardian-first="${idx}" placeholder="First name" aria-label="Parent ${idx} first name">
          <input data-guardian-last="${idx}" placeholder="Last name" aria-label="Parent ${idx} last name">
        </div>
        <div class="inline-edit-row">
          <input data-guardian-phone="${idx}" placeholder="Phone (optional)" aria-label="Parent ${idx} phone">
          <input data-guardian-email="${idx}" placeholder="Email (optional)" aria-label="Parent ${idx} email">
        </div>
      </div>
      <div class="form-field">
        <label>Relationship to student</label>
        <select data-guardian-relationship="${idx}" aria-label="Parent ${idx} relationship">${GUARDIAN_RELATIONSHIPS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
      </div>
    </div>`;
  }

  /** Wires the search-as-you-type + select/clear behavior for one guardian
   * block. Selecting a search result hides the new-guardian fields (the
   * selection takes precedence) and shows a "Selected: Name ✕" chip. */
  function wireGuardianBlock(idx) {
    const search = document.querySelector(`[data-guardian-search="${idx}"]`);
    const results = document.querySelector(`[data-guardian-results="${idx}"]`);
    const selected = document.querySelector(`[data-guardian-selected="${idx}"]`);
    const newFields = document.querySelector(`[data-guardian-new-fields="${idx}"]`);
    const block = document.querySelector(`[data-guardian-block="${idx}"]`);
    let debounceTimer;
    search.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const q = search.value.trim();
      if (q.length < 2) { results.innerHTML = ''; return; }
      debounceTimer = setTimeout(async () => {
        try {
          const matches = await window.SchoolOS.api('/guardians?search=' + encodeURIComponent(q));
          results.innerHTML = matches.length
            ? matches.map((g) => `<div class="guardian-search-result-row" data-pick-guardian="${g.id}" data-pick-guardian-name="${g.firstName} ${g.lastName}">${g.firstName} ${g.lastName}${g.phone ? ' · ' + g.phone : ''}</div>`).join('')
            : '<div class="guardian-search-result-row guardian-search-empty">No match, add a new parent below</div>';
        } catch (err) { results.innerHTML = ''; }
      }, 250);
    });
    results.addEventListener('click', (e) => {
      const row = e.target.closest('[data-pick-guardian]');
      if (!row) return;
      block.dataset.selectedGuardianId = row.dataset.pickGuardian;
      selected.style.display = '';
      selected.innerHTML = `Selected: <strong>${row.dataset.pickGuardianName}</strong> <button type="button" class="outline-button" data-clear-guardian="${idx}">✕</button>`;
      newFields.style.display = 'none';
      search.value = ''; results.innerHTML = '';
    });
    selected.addEventListener('click', (e) => {
      if (!e.target.closest('[data-clear-guardian]')) return;
      delete block.dataset.selectedGuardianId;
      selected.style.display = 'none'; selected.innerHTML = '';
      newFields.style.display = '';
    });
  }

  /** Reads one guardian block's state (a picked existing guardian takes
   * precedence over the new-guardian fields) into the payload shape
   * StudentsService.create expects. Returns null if the block is
   * completely empty (used to treat guardian 2 as "not provided"). */
  function readGuardianBlock(idx) {
    const block = document.querySelector(`[data-guardian-block="${idx}"]`);
    const relationship = document.querySelector(`[data-guardian-relationship="${idx}"]`).value;
    if (block.dataset.selectedGuardianId) {
      return { idKey: block.dataset.selectedGuardianId, relationship };
    }
    const firstName = document.querySelector(`[data-guardian-first="${idx}"]`).value.trim();
    const lastName = document.querySelector(`[data-guardian-last="${idx}"]`).value.trim();
    if (!firstName && !lastName) return null;
    const phone = document.querySelector(`[data-guardian-phone="${idx}"]`).value.trim();
    const email = document.querySelector(`[data-guardian-email="${idx}"]`).value.trim();
    return { firstName, lastName, phone: phone || undefined, email: email || undefined, relationship };
  }

  /** No Campus field and no arm/section picker: a class already belongs
   * to one campus (SchoolClass.campusId), so picking a class fixes the
   * campus implicitly, and the arm within it is assigned at random from
   * whichever arms that class has (real schools don't let a parent or
   * admin cherry-pick a section). Senior Secondary students pick a
   * Science/Art stream instead, which is what determines which class
   * they actually belong in; that stream is saved right after creation
   * via the same PATCH /students/:id/stream endpoint the admin/self-serve
   * stream editors already use. */
  async function openNewStudentModal() {
    let campuses = [], classes = [];
    try {
      [campuses, classes] = await Promise.all([window.SchoolOS.api('/campuses'), window.SchoolOS.api('/classes')]);
    } catch (err) { window.SchoolOS.toast(`Could not load classes (${err.message})`); return; }

    const campusNameById = Object.fromEntries(campuses.map((c) => [c.id, c.name]));
    const multiCampus = new Set(classes.map((c) => c.campusId)).size > 1;
    const classById = Object.fromEntries(classes.map((c) => [c.id, c]));
    const classesByLevel = {};
    classes.forEach((c) => { (classesByLevel[c.level] ||= []).push(c); });
    const levelsWithClasses = Object.keys(LEVEL_LABELS).filter((lvl) => (classesByLevel[lvl] || []).length);
    if (!levelsWithClasses.length) { window.SchoolOS.toast('No classes found, add a class first (Academics → Classes)'); return; }

    const classOptionsHtml = (level) => (classesByLevel[level] || []).map((c) => `<option value="${c.id}">${c.name}${multiCampus ? ' · ' + (campusNameById[c.campusId] || '') : ''}</option>`).join('');

    window.SchoolOS.openModal(`<p class="eyebrow">Students</p><h2>Add student</h2>
      <p class="modal-sub">A parent/guardian is required. The class arm/section is assigned automatically.</p>
      <form onsubmit="__addStudentSubmit(event)">
        <div class="form-field"><label>First name</label><input name="firstName" placeholder="e.g. Ada"></div>
        <div class="form-field"><label>Last name</label><input name="lastName" placeholder="e.g. Okafor"></div>
        <div class="form-field"><label>Level</label><select name="level" id="studentLevelSelect">${levelsWithClasses.map((l) => `<option value="${l}">${LEVEL_LABELS[l]}</option>`).join('')}</select></div>
        <div class="form-field"><label>Class</label><select name="schoolClass" id="studentClassSelect">${classOptionsHtml(levelsWithClasses[0])}</select></div>
        <div class="form-field" id="studentStreamField" style="${levelsWithClasses[0] === 'SENIOR_SECONDARY' ? '' : 'display:none'}"><label>Stream</label><select name="stream" id="studentStreamSelect2"><option value="">— Choose —</option>${Object.entries(STREAM_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div class="form-field"><label>Gender</label><select name="gender"><option>—</option><option>Male</option><option>Female</option></select></div>
        <div class="form-field"><label>Date of birth</label><input name="dateOfBirth" type="date"></div>
        ${guardianBlockHtml(1, true)}
        <button type="button" class="outline-button" id="addSecondGuardianBtn">+ Add a second parent/guardian</button>
        <div id="secondGuardianContainer"></div>
        <div class="form-actions"><button type="button" class="outline-button" data-modal-close>Cancel</button><button type="submit" class="new-button">Add student</button></div>
      </form>`);

    const levelSelect = document.getElementById('studentLevelSelect');
    const classSelect = document.getElementById('studentClassSelect');
    const streamField = document.getElementById('studentStreamField');
    levelSelect.addEventListener('change', () => {
      classSelect.innerHTML = classOptionsHtml(levelSelect.value);
      streamField.style.display = levelSelect.value === 'SENIOR_SECONDARY' ? '' : 'none';
    });

    wireGuardianBlock(1);
    document.getElementById('addSecondGuardianBtn').addEventListener('click', (e) => {
      document.getElementById('secondGuardianContainer').innerHTML = guardianBlockHtml(2, false);
      wireGuardianBlock(2);
      e.target.style.display = 'none';
    }, { once: true });

    window.__addStudentSubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const firstName = (fd.get('firstName') || '').trim();
      const lastName = (fd.get('lastName') || '').trim();
      const level = fd.get('level');
      const schoolClassId = fd.get('schoolClass');
      const stream = fd.get('stream');
      const gender = fd.get('gender');
      const dateOfBirth = fd.get('dateOfBirth');
      if (!firstName || !lastName || !schoolClassId) { window.SchoolOS.toast('First name, last name and class are required'); return; }
      if (level === 'SENIOR_SECONDARY' && !stream) { window.SchoolOS.toast('Choose a stream (Science or Art) for a Senior Secondary student'); return; }

      const cls = classById[schoolClassId];
      // For Senior Secondary, the chosen stream is what actually picks the
      // class; only arms an admin has tagged for that stream are
      // eligible, never a stream-agnostic arm from this class.
      const eligibleArms = level === 'SENIOR_SECONDARY' ? (cls.arms || []).filter((a) => a.stream === stream) : (cls.arms || []);
      if (!eligibleArms.length) {
        window.SchoolOS.toast(level === 'SENIOR_SECONDARY'
          ? `No ${STREAM_LABELS[stream]} arms configured for ${cls.name} yet, tag one first (Academics → Classes → ${cls.name})`
          : `${cls.name} has no arms/sections yet, add one first (Academics → Classes)`);
        return;
      }
      const randomArm = eligibleArms[Math.floor(Math.random() * eligibleArms.length)];

      const guardian1 = readGuardianBlock(1);
      if (!guardian1) { window.SchoolOS.toast('A parent/guardian is required, search for an existing one or enter a name'); return; }
      const guardian2 = document.querySelector('[data-guardian-block="2"]') ? readGuardianBlock(2) : null;

      const payload = {
        campusId: cls.campusId, firstName, lastName,
        gender: gender && gender !== '—' ? gender : undefined, dateOfBirth: dateOfBirth || undefined,
        currentClassArmId: randomArm.id,
        guardianRelationship: guardian1.relationship,
        ...(guardian1.idKey ? { guardianId: guardian1.idKey } : { guardianFirstName: guardian1.firstName, guardianLastName: guardian1.lastName, guardianPhone: guardian1.phone, guardianEmail: guardian1.email }),
        ...(guardian2 ? {
          secondGuardianRelationship: guardian2.relationship,
          ...(guardian2.idKey ? { secondGuardianId: guardian2.idKey } : { secondGuardianFirstName: guardian2.firstName, secondGuardianLastName: guardian2.lastName, secondGuardianPhone: guardian2.phone, secondGuardianEmail: guardian2.email }),
        } : {}),
      };

      try {
        const created = await window.SchoolOS.api('/students', { method: 'POST', body: JSON.stringify(payload) });
        if (level === 'SENIOR_SECONDARY' && stream) {
          try { await window.SchoolOS.api('/students/' + created.id + '/stream', { method: 'PATCH', body: JSON.stringify({ stream }) }); } catch (err) { window.SchoolOS.toast(`Student added, but could not set stream (${err.message})`); }
        }
        window.SchoolOS.toast(`${firstName} ${lastName} added to ${cls.name} · ${randomArm.name}`);
        loadRealStudents();
        window.SchoolOS.closeModal();
        if (created && created.loginCredentials) {
          const guardianRows = (created.guardianLoginCredentials || []).flatMap((g) => [[`${g.name} (parent)`, g.email], ['— password', g.password]]);
          window.SchoolOS.detailModal({
            eyebrow: 'Students', title: 'Login(s) created',
            sub: `Portal logins were generated automatically for ${firstName} ${lastName}${guardianRows.length ? ' and any newly added parent(s)' : ''}. Share these directly; they won't be shown again. (A reused existing parent keeps their existing login.)`,
            rows: [['Student', created.loginCredentials.email], ['— password', created.loginCredentials.password], ...guardianRows],
          });
        }
      } catch (err) { window.SchoolOS.toast(`Could not add student (${err.message})`); }
    };
  }

  async function openStudentDetailModal(studentId) {
    let s, classes = [], sessions = [];
    try {
      [s, classes, sessions] = await Promise.all([
        window.SchoolOS.api('/students/' + studentId),
        window.SchoolOS.api('/classes'),
        window.SchoolOS.api('/academic-sessions'),
      ]);
    } catch (err) { window.SchoolOS.toast(`Could not load student (${err.message})`); return; }
    const user = window.SchoolOS.getUser();
    const canManage = user && (user.role === 'PROPRIETOR' || user.role === 'PRINCIPAL');
    const className = s.currentClassArm ? `${s.currentClassArm.schoolClass.name} · ${s.currentClassArm.name}` : 'Unassigned';
    const guardiansHtml = (s.guardianLinks || []).map((g) => `<div class="modal-detail-row"><span>${g.guardian.firstName} ${g.guardian.lastName} (${g.relationship})</span><strong>${g.guardian.phone || g.guardian.email || '—'}</strong></div>`).join('') || '<p class="modal-sub" style="margin:0">No guardians linked yet.</p>';

    const classArms = classes.flatMap((c) => (c.arms || []).map((a) => ({ id: a.id, label: `${c.name} · ${a.name}` })));
    const armByLabel = Object.fromEntries(classArms.map((a) => [a.label, a.id]));
    const currentSession = sessions.find((sess) => sess.isCurrent) || sessions[0];

    window.__renameStudentSubmit = async (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      try {
        await window.SchoolOS.api('/students/' + studentId, { method: 'PATCH', body: JSON.stringify({ firstName: data.get('firstName'), lastName: data.get('lastName'), middleName: data.get('middleName') || undefined }) });
        window.SchoolOS.toast('Student updated');
        loadRealStudents();
        window.SchoolOS.closeModal();
      } catch (err) { window.SchoolOS.toast(`Could not update student (${err.message})`); }
    };

    /** Real promotion/transfer, not a raw field edit: POST /students/:id/promote
     * also records StudentClassHistory (CLAUDE.md treats this as an
     * audited trail, not a silent overwrite). */
    window.__moveStudentClassSubmit = async (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      const classArmId = armByLabel[data.get('classArm')];
      const reason = (data.get('reason') || '').trim() || undefined;
      if (!classArmId) { window.SchoolOS.toast('Choose a class'); return; }
      if (!currentSession) { window.SchoolOS.toast('No academic session configured yet'); return; }
      try {
        await window.SchoolOS.api('/students/' + studentId + '/promote', {
          method: 'POST',
          body: JSON.stringify({ classArmId, academicSessionId: currentSession.id, reason }),
        });
        window.SchoolOS.toast('Class updated');
        loadRealStudents();
        window.SchoolOS.closeModal();
      } catch (err) { window.SchoolOS.toast(`Could not change class (${err.message})`); }
    };

    const isSeniorSecondary = s.currentClassArm && s.currentClassArm.schoolClass.level === 'SENIOR_SECONDARY';
    const streamHtml = isSeniorSecondary
      ? (canManage
          ? `<div class="inline-edit-row"><select id="studentStreamSelect" aria-label="Stream"><option value="">— Not set —</option>${Object.entries(STREAM_LABELS).map(([k, v]) => `<option value="${k}" ${s.stream === k ? 'selected' : ''}>${v}</option>`).join('')}</select><button type="button" class="outline-button" data-save-student-stream="${studentId}">Save</button></div>`
          : `<div class="modal-detail-row"><span>Stream</span><strong>${s.stream ? STREAM_LABELS[s.stream] : 'Not set'}</strong></div>`)
      : '';

    window.SchoolOS.openModal(`<p class="eyebrow">Students</p><h2>Student details</h2>
      ${canManage ? `<form onsubmit="__renameStudentSubmit(event)">
        <div class="inline-edit-row"><input name="firstName" value="${s.firstName}" aria-label="First name"><input name="lastName" value="${s.lastName}" aria-label="Last name"></div>
        <div class="inline-edit-row"><input name="middleName" value="${s.middleName || ''}" placeholder="Middle name (optional)" aria-label="Middle name"></div>
        <div class="form-actions" style="margin-top:10px"><button type="submit" class="new-button">Save changes</button></div>
      </form>` : `<p class="modal-sub">${s.firstName} ${s.lastName}</p>`}
      <div class="modal-detail-row"><span>Admission No.</span><strong>${s.admissionNo}</strong></div>
      <div class="modal-detail-row"><span>Status</span><strong>${s.status}</strong></div>
      ${canManage ? `<form class="inline-edit-row" onsubmit="__moveStudentClassSubmit(event)"><select name="classArm" aria-label="Class">${classArms.map((a) => `<option ${a.label === className ? 'selected' : ''}>${a.label}</option>`).join('')}</select><input name="reason" placeholder="Reason (optional)" aria-label="Reason for class change"><button type="submit" class="outline-button">Save</button></form>` : `<div class="modal-detail-row"><span>Class</span><strong>${className}</strong></div>`}
      <div class="modal-detail-row"><span>Gender</span><strong>${s.gender || '—'}</strong></div>
      ${isSeniorSecondary ? `<div class="detail-section"><p class="eyebrow">Stream</p>${streamHtml}</div>` : ''}
      <div class="detail-section"><p class="eyebrow">Guardians</p>${guardiansHtml}</div>
      <div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>`);
  }
  async function saveStudentStream(studentId) {
    const select = document.getElementById('studentStreamSelect');
    if (!select.value) { window.SchoolOS.toast('Choose a stream first'); return; }
    try {
      await window.SchoolOS.api('/students/' + studentId + '/stream', { method: 'PATCH', body: JSON.stringify({ stream: select.value }) });
      window.SchoolOS.toast('Stream updated');
      loadRealStudents();
      openStudentDetailModal(studentId);
    } catch (err) { window.SchoolOS.toast(`Could not update stream (${err.message})`); }
  }

  function renderStudentsAddRow(role) {
    const row = document.getElementById('studentsAddRow');
    if (!row) return;
    const canManage = role === 'proprietor' || role === 'principal';
    const filterHtml = `<select id="studentsLevelFilter" class="level-filter-select" aria-label="Filter students by level"><option value="">All levels</option>${Object.entries(LEVEL_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><select id="studentsClassFilter" class="level-filter-select" aria-label="Filter students by class"><option value="">All classes</option></select><select id="studentsArmFilter" class="level-filter-select" aria-label="Filter students by arm"><option value="">All arms</option></select>`;
    const streamReqBtn = canManage ? '<button class="outline-button" id="streamRequestsBtn">Stream requests<span id="streamRequestsBadge"></span></button>' : '';
    const addBtn = canManage ? '<button class="new-button" id="addStudentBtn">+ Add student</button>' : '';
    row.innerHTML = filterHtml + streamReqBtn + addBtn;
    const btn = document.getElementById('addStudentBtn');
    if (btn) btn.addEventListener('click', openNewStudentModal);
    const levelSelect = document.getElementById('studentsLevelFilter');
    if (levelSelect) levelSelect.addEventListener('change', () => { populateStudentsClassArmFilters(); renderStudentsTable(); });
    const classSelect = document.getElementById('studentsClassFilter');
    if (classSelect) classSelect.addEventListener('change', () => { populateStudentsClassArmFilters(); renderStudentsTable(); });
    const armSelect = document.getElementById('studentsArmFilter');
    if (armSelect) armSelect.addEventListener('change', renderStudentsTable);
    const streamReqEl = document.getElementById('streamRequestsBtn');
    if (streamReqEl) {
      streamReqEl.addEventListener('click', openStreamRequestsModal);
      window.SchoolOS.api('/students/stream-requests?status=PENDING').then((reqs) => {
        const badge = document.getElementById('streamRequestsBadge');
        if (badge && reqs.length) badge.textContent = ' · ' + reqs.length;
      }).catch(() => {});
    }
  }

  /** Admin review queue for self-service stream-switch requests (SS1
   * students only; see StudentsService.requestStreamChange). Approving
   * moves the student's stream (and, if the class has an arm tagged for
   * it, the student into that arm) server-side; nothing here mutates
   * the student directly. */
  async function openStreamRequestsModal() {
    let requests = [];
    try { requests = await window.SchoolOS.api('/students/stream-requests?status=PENDING'); } catch (err) { window.SchoolOS.toast(`Could not load stream requests (${err.message})`); return; }
    const rowsHtml = requests.length ? requests.map((r) => `<div class="modal-detail-row"><span>${r.student.firstName} ${r.student.lastName} (${r.student.admissionNo})</span><span>Wants ${STREAM_LABELS[r.requestedStream]}${r.reason ? '; ' + r.reason : ''}</span><span class="row-action"><button class="outline-button" data-approve-stream-request="${r.id}">Approve</button> <button class="outline-button" data-reject-stream-request="${r.id}">Reject</button></span></div>`).join('') : '<p class="modal-sub" style="margin:0">No pending stream requests.</p>';
    window.SchoolOS.openModal(`<p class="eyebrow">Students</p><h2>Stream change requests</h2><p class="modal-sub">Only SS1 students can submit these. Approving moves the student into a matching arm if one is tagged for the new stream.</p>${rowsHtml}<div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>`);
  }
  async function reviewStreamRequest(id, approve) {
    let reviewNote;
    if (!approve) { reviewNote = window.prompt('Reason for rejecting (optional):') || undefined; }
    try {
      await window.SchoolOS.api('/students/stream-requests/' + id + '/review', { method: 'PATCH', body: JSON.stringify({ approve, reviewNote }) });
      window.SchoolOS.toast(approve ? 'Stream change approved' : 'Stream change rejected');
      loadRealStudents();
      openStreamRequestsModal();
    } catch (err) { window.SchoolOS.toast(`Could not review request (${err.message})`); }
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
    const saveStream = e.target.closest('[data-save-student-stream]'); if (saveStream) saveStudentStream(saveStream.dataset.saveStudentStream);
    const approveStreamReq = e.target.closest('[data-approve-stream-request]'); if (approveStreamReq) reviewStreamRequest(approveStreamReq.dataset.approveStreamRequest, true);
    const rejectStreamReq = e.target.closest('[data-reject-stream-request]'); if (rejectStreamReq) reviewStreamRequest(rejectStreamReq.dataset.rejectStreamRequest, false);
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
