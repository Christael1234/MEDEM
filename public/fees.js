// Fees & payments module — entirely mock (no fees/payments backend yet,
// per CLAUDE.md's Phase 2+ non-goals). Bursar's Invoices/Payments/Arrears/
// Reconciliation/Expenses nav items land here too via #hash, each showing
// the same generic mock page they always did.
(function () {
  const revenueRestrictedRoles = new Set(['principal']);

  const feeStructure = [
    { cls: 'Creche – KG', tuition: 95000, transport: 25000, boarding: 0, exam: 5000 },
    { cls: 'Primary 1–3', tuition: 120000, transport: 28000, boarding: 0, exam: 6000 },
    { cls: 'Primary 4–6', tuition: 135000, transport: 28000, boarding: 0, exam: 7000 },
    { cls: 'JSS 1–3', tuition: 165000, transport: 32000, boarding: 180000, exam: 9000 },
    { cls: 'SS 1–3', tuition: 210000, transport: 32000, boarding: 210000, exam: 12000 },
  ];
  const feeInstallments = [
    { student: 'Kemi Adeyemi · JSS 2', family: 'Adeyemi Family', amount: '₦95,000', due: '2 Sep', status: 'Paid' },
    { student: 'David Chukwu · SS 1', family: 'Chukwu Family', amount: '₦70,000', due: '2 Sep', status: 'Pending' },
    { student: 'Grace Adebayo · JSS 2', family: 'Adebayo Family', amount: '₦45,000', due: '15 Aug', status: 'Overdue' },
    { student: 'Zainab Bello · SS 2', family: 'Bello Family', amount: '₦80,000', due: '2 Sep', status: 'Pending' },
  ];
  const feeDiscounts = [
    { name: 'Sibling discount', rule: '3rd child and above, same household', value: '10% off tuition', applied: '62 families' },
    { name: 'Staff ward waiver', rule: 'Children of full-time staff', value: '50% off tuition', applied: '14 families' },
    { name: 'Merit scholarship', rule: 'Top 5 per class, prior term result', value: '100% tuition waiver', applied: '15 students' },
    { name: 'Early payment discount', rule: 'Full term fee paid before resumption', value: '5% off total fees', applied: '201 families' },
  ];
  const arrearsAging = [
    { label: '0–30 days', amount: '₦6.2m', count: '48 families', pct: 30 },
    { label: '31–60 days', amount: '₦4.8m', count: '29 families', pct: 23 },
    { label: '61–90 days', amount: '₦3.1m', count: '17 families', pct: 15 },
    { label: '90+ days', amount: '₦7.2m', count: '21 families', pct: 32 },
  ];
  function pageFeesSchool(label, role) {
    const canEditFees = role === 'proprietor' || role === 'bursar';
    const hideRevenue = revenueRestrictedRoles.has(role);
    const kpis = hideRevenue
      ? [['Collected this term', 'Restricted', 'Ask the bursar for revenue figures'], ['Outstanding', 'Restricted', 'Ask the bursar for revenue figures'], ['Discounts applied', 'Restricted', 'Ask the bursar for revenue figures'], ['Overdue beyond 30 days', '115 families', 'Across all buckets — no amounts shown']]
      : [['Collected this term', '₦184.6m', '↑ 6.8% vs last term'], ['Outstanding', '₦21.3m', '115 families across all buckets'], ['Discounts applied', '₦18.4m', '91 families this term'], ['Overdue beyond 30 days', '₦15.1m', '67 families need follow-up']];
    const structureRows = feeStructure.map((f) => `<tr><td>${f.cls}</td><td>${window.SchoolOS.money(f.tuition)}</td><td>${window.SchoolOS.money(f.transport)}</td><td>${f.boarding ? window.SchoolOS.money(f.boarding) : '—'}</td><td>${window.SchoolOS.money(f.exam)}</td><td><strong>${window.SchoolOS.money(f.tuition + f.transport + f.boarding + f.exam)}</strong></td></tr>`).join('');
    const installmentRows = feeInstallments.map((i) => `<tr><td><div class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(i.student)}</span>${i.student}</div></td><td>${i.family}</td><td>${i.amount}</td><td>${i.due}</td><td><span class="status ${i.status !== 'Paid' ? 'pending' : ''}">${i.status}</span></td></tr>`).join('');
    const discountRows = feeDiscounts.map((d) => `<tr><td>${d.name}</td><td>${d.rule}</td><td>${d.value}</td><td>${d.applied}</td></tr>`).join('');
    const agingRows = arrearsAging.map((a) => `<div class="aging-row"><span class="aging-label">${a.label}</span><div class="aging-bar"><span style="width:${a.pct}%"></span></div><span class="aging-amount">${a.amount}</span><span class="aging-count">${a.count}</span></div>`).join('');
    return `<section class="page workspace-page visible" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Fees &amp; billing</p><h1>${label}</h1><p class="subtitle">Fee structures, instalments, discounts and arrears — in one place.</p></div>${canEditFees ? '<button class="new-button" id="newFeeStructureBtn">+ New fee structure</button>' : '<span class="view-only-badge">View only</span>'}</div><div class="screen-kpis">${kpis.map((s) => `<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('')}</div><div class="screen-tabs" data-tabs><button class="active" data-tab="structure">Fee structure</button><button data-tab="installments">Instalments</button><button data-tab="discounts">Discounts &amp; waivers</button><button data-tab="arrears">Arrears ageing</button></div><div data-tab-panel="structure" class="tab-panel visible"><section class="data-card"><table class="data-table"><thead><tr><th>Class</th><th>Tuition</th><th>Transport</th><th>Boarding</th><th>Exam levy</th><th>Total per term</th></tr></thead><tbody>${structureRows}</tbody></table></section></div><div data-tab-panel="installments" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Student</th><th>Family</th><th>Amount</th><th>Due date</th><th>Status</th></tr></thead><tbody>${installmentRows}</tbody></table></section></div><div data-tab-panel="discounts" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Discount / scholarship</th><th>Rule</th><th>Value</th><th>Applied to</th></tr></thead><tbody>${discountRows}</tbody></table></section></div><div data-tab-panel="arrears" class="tab-panel"><section class="data-card aging-card">${agingRows}</section></div></section>`;
  }
  function openNewFeeStructureModal() {
    window.SchoolOS.formModal({
      eyebrow: 'Fees & billing', title: 'New fee structure', sub: 'Set fees for a class band, effective this term.',
      fields: [{ name: 'cls', label: 'Class band', placeholder: 'e.g. Primary 1–3' }, { name: 'tuition', label: 'Tuition (₦)', type: 'number', placeholder: '120000' }, { name: 'transport', label: 'Transport (₦)', type: 'number', placeholder: '28000' }, { name: 'boarding', label: 'Boarding (₦)', type: 'number', placeholder: '0' }, { name: 'exam', label: 'Exam levy (₦)', type: 'number', placeholder: '6000' }],
      submitLabel: 'Save fee structure',
      onSubmit: (d) => { feeStructure.push({ cls: d.cls || 'New class band', tuition: Number(d.tuition) || 0, transport: Number(d.transport) || 0, boarding: Number(d.boarding) || 0, exam: Number(d.exam) || 0 }); render(); window.SchoolOS.toast(`Fee structure saved · ${d.cls || 'New class band'}`); },
    });
  }

  /** Fees/billing has no backend yet (CLAUDE.md Phase 2+ non-goal) — the
   * parent's Fees tab is an honest "coming soon" state rather than
   * fabricated invoices. My Children uses real data throughout: linked
   * children, attendance and published results all come from the actual
   * portal API. */
  function pageFeesParent(label) {
    return `<section class="page workspace-page visible" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Fees &amp; payments</p><h1>${label}</h1><p class="subtitle">Not built yet — this isn't showing you fake balances.</p></div></div><section class="data-card"><div class="empty-state"><span class="mini-avatar">₦</span><h3>Coming soon</h3><p>Fee structures, invoices and online payment haven't been built on the backend yet. When they are, you'll see and pay your children's balances here.</p></div></section></section>`;
  }

  async function openChildResultsModal(studentId, name) {
    let results = [];
    try { results = await window.SchoolOS.api('/portal/parent/children/' + studentId + '/results'); } catch (err) { window.SchoolOS.toast(`Could not load results (${err.message})`); return; }
    const rows = results.length
      ? results.map((r) => [`${r.subject?.name || '—'} · ${r.term?.name || '—'}`, `${r.totalScore ?? '—'}${r.grade ? ' · ' + r.grade : ''}`])
      : [['No published results yet', '—']];
    window.SchoolOS.detailModal({ eyebrow: 'Results', title: name, sub: 'Only published results appear here.', rows });
  }
  async function openChildAttendanceModal(studentId, name) {
    let records = [];
    try { records = await window.SchoolOS.api('/portal/parent/children/' + studentId + '/attendance'); } catch (err) { window.SchoolOS.toast(`Could not load attendance (${err.message})`); return; }
    const rows = records.length
      ? records.slice(0, 20).map((r) => [new Date(r.date).toDateString(), r.status])
      : [['No attendance recorded yet', '—']];
    window.SchoolOS.detailModal({ eyebrow: 'Attendance', title: name, sub: 'Most recent first.', rows });
  }
  function pageMyChildren(label) {
    return `<section class="page workspace-page visible" id="my-children"><div class="page-heading"><div><p class="eyebrow">Your family</p><h1>${label}</h1><p class="subtitle">Real attendance and results for every linked child. Fees aren't built yet.</p></div></div><div id="myChildrenGrid" class="child-grid"><p class="modal-sub">Loading…</p></div></section>`;
  }
  async function loadMyChildren() {
    const grid = document.getElementById('myChildrenGrid');
    if (!grid || !window.SchoolOS.getAccessToken()) return;
    grid.innerHTML = '<p class="modal-sub">Loading…</p>';
    try {
      const links = await window.SchoolOS.api('/portal/parent/children');
      if (!links.length) { grid.innerHTML = '<div class="empty-state"><span class="mini-avatar">♥</span><h3>No children linked yet</h3><p>Ask the school to link your account to your child’s record.</p></div>'; return; }
      const cards = await Promise.all(links.map(async (link) => {
        const s = link.student;
        const name = `${s.firstName} ${s.lastName}`;
        const cls = s.currentClassArm ? `${s.currentClassArm.schoolClass.name} · ${s.currentClassArm.name}` : 'Unassigned';
        let attendanceNote = 'No records yet';
        try {
          const attendance = await window.SchoolOS.api('/portal/parent/children/' + s.id + '/attendance');
          if (attendance.length) attendanceNote = `${attendance.filter((a) => a.status === 'PRESENT').length}/${attendance.length} present`;
        } catch (err) { attendanceNote = 'Could not load'; }
        let resultsNote = 'No published results yet';
        try {
          const results = await window.SchoolOS.api('/portal/parent/children/' + s.id + '/results');
          if (results.length) resultsNote = `${results.length} published`;
        } catch (err) { resultsNote = 'Could not load'; }
        return `<article class="child-card"><div class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(name)}</span><div><strong>${name}</strong><small>${cls}</small></div></div><div class="child-stats"><div><span>Attendance</span><strong>${attendanceNote}</strong></div><div><span>Results</span><strong>${resultsNote}</strong></div><div><span>Fees</span><strong>Coming soon</strong></div></div><div class="child-actions"><button class="outline-button" data-view-child-results="${s.id}" data-child-name="${name}">View results</button><button class="outline-button" data-view-child-attendance="${s.id}" data-child-name="${name}">View attendance</button></div></article>`;
      }));
      grid.innerHTML = cards.join('');
    } catch (err) { grid.innerHTML = `<p class="modal-sub">Could not load your children (${err.message})</p>`; }
  }

  const GENERIC_LABELS = { invoices: 'Invoices', payments: 'Payments', arrears: 'Arrears', reconciliation: 'Reconciliation', expenses: 'Expenses' };

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

  let currentRole = 'proprietor';
  function render() {
    const container = document.getElementById('feesSection');
    const hash = location.hash.slice(1);

    if (GENERIC_LABELS[hash]) { container.innerHTML = window.SchoolOS.renderGenericPage(GENERIC_LABELS[hash]); return; }

    if (currentRole === 'parent') {
      if (hash === 'my-children') {
        container.innerHTML = `<div class="screen-tabs" style="margin:32px 52px 0"><button id="toFeesTab">Fees</button><button class="active">My Children</button></div>` + pageMyChildren('My Children');
        loadMyChildren();
      } else {
        container.innerHTML = `<div class="screen-tabs" style="margin:32px 52px 0"><button class="active">Fees</button><button id="toChildrenTab">My Children</button></div>` + pageFeesParent('Fees');
      }
      bindTabs();
      const toChildren = document.getElementById('toChildrenTab'); if (toChildren) toChildren.addEventListener('click', () => { history.replaceState(null, '', '#my-children'); render(); });
      const toFees = document.getElementById('toFeesTab'); if (toFees) toFees.addEventListener('click', () => { history.replaceState(null, '', '#'); render(); });
      return;
    }

    container.innerHTML = pageFeesSchool(currentRole === 'principal' || currentRole === 'proprietor' ? 'Fees & payments' : 'Fees', currentRole);
    bindTabs();
    const btn = document.getElementById('newFeeStructureBtn'); if (btn) btn.addEventListener('click', openNewFeeStructureModal);
  }

  document.addEventListener('click', (e) => {
    const vcr = e.target.closest('[data-view-child-results]'); if (vcr) openChildResultsModal(vcr.dataset.viewChildResults, vcr.dataset.childName);
    const vca = e.target.closest('[data-view-child-attendance]'); if (vca) openChildAttendanceModal(vca.dataset.viewChildAttendance, vca.dataset.childName);
  });

  window.SchoolOS.ready.then((role) => {
    if (!role) return;
    currentRole = role;
    window.SchoolOS.onRoleChange = (r) => { currentRole = r; render(); };
    window.SchoolOS.onCreateNew = () => { if (currentRole === 'proprietor' || currentRole === 'bursar') openNewFeeStructureModal(); else window.SchoolOS.toast('Open a workspace page to create a matching record'); };
    render();
  });
})();
