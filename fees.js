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

  const parentChildren = [
    { name: 'Ada Okon', guardian: 'Nneka Okon', cls: 'SS 1A · Ikoyi campus', attendance: '96%', feeBalance: '₦0', feeStatus: 'Paid', lastResult: '2nd position · Third term CA' },
    { name: 'Emeka Okon', guardian: 'Nneka Okon', cls: 'JSS 2A · Ikoyi campus', attendance: '91%', feeBalance: '₦45,000', feeStatus: 'Pending', lastResult: '5th position · Third term CA' },
  ];
  const parentInvoices = {
    'Ada Okon': [{ item: 'Tuition · Third term', amount: '₦210,000', due: '2 Sep', status: 'Paid' }, { item: 'Transport · Third term', amount: '₦32,000', due: '2 Sep', status: 'Paid' }],
    'Emeka Okon': [{ item: 'Tuition balance · Third term', amount: '₦36,000', due: '2 Sep', status: 'Pending' }, { item: 'Exam levy · Third term', amount: '₦9,000', due: '15 Aug', status: 'Overdue' }],
  };
  const paymentHistory = [
    { date: '12 Jun', child: 'Ada Okon', item: 'Second term tuition', amount: '₦210,000', method: 'Bank transfer', receipt: 'RCT-1092' },
    { date: '10 Jun', child: 'Emeka Okon', item: 'Second term tuition', amount: '₦165,000', method: 'Card', receipt: 'RCT-1077' },
    { date: '2 Feb', child: 'Ada Okon', item: 'First term tuition', amount: '₦210,000', method: 'Bank transfer', receipt: 'RCT-0891' },
  ];
  function pageFeesParent(label) {
    const outstandingTotal = parentChildren.reduce((sum, c) => sum + Number(c.feeBalance.replace(/[₦,]/g, '')), 0);
    const pendingChildren = parentChildren.filter((c) => c.feeStatus === 'Pending').length;
    const kpis = [['Total outstanding', window.SchoolOS.money(outstandingTotal), pendingChildren ? `${pendingChildren} ${pendingChildren === 1 ? 'child' : 'children'} with a balance` : 'All balances clear'], ['Next due date', '2 Sep', 'Third term instalment'], ['Paid this term', '₦447,000', 'Across both children'], ['Payment methods', 'Card · Transfer · USSD', 'Choose at checkout']];
    const childBlocks = parentChildren.map((c) => {
      const invoices = parentInvoices[c.name] || [];
      const rows = invoices.map((i) => `<tr><td>${i.item}</td><td>${i.amount}</td><td>${i.due}</td><td><span class="status ${i.status !== 'Paid' ? 'pending' : ''}">${i.status}</span></td></tr>`).join('') || '<tr><td colspan="4">No invoices this term</td></tr>';
      return `<section class="data-card fee-child-card"><div class="data-toolbar"><div class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(c.name)}</span><div><strong>${c.name}</strong><small>${c.cls}</small></div></div>${c.feeStatus === 'Pending' ? `<button class="new-button" data-pay-child="${c.name}">Pay ${c.feeBalance}</button>` : '<span class="status">Fully paid</span>'}</div><table class="data-table"><thead><tr><th>Item</th><th>Amount</th><th>Due date</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    }).join('');
    const historyRows = paymentHistory.map((p) => `<tr><td>${p.date}</td><td>${p.child}</td><td>${p.item}</td><td>${p.amount}</td><td>${p.method}</td><td class="row-action"><button class="outline-button" data-view-receipt="${p.receipt}">View receipt</button></td></tr>`).join('');
    return `<section class="page workspace-page visible" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Fees &amp; payments</p><h1>${label}</h1><p class="subtitle">Pay your children's fees and keep every receipt in one place.</p></div></div><div class="screen-kpis">${kpis.map((s, i) => `<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small class="${i === 0 && pendingChildren ? 'warn' : ''}">${s[2]}</small></article>`).join('')}</div><div class="screen-tabs" data-tabs><button class="active" data-tab="outstanding">Outstanding</button><button data-tab="history">Payment history</button></div><div data-tab-panel="outstanding" class="tab-panel visible"><div class="fee-child-grid">${childBlocks}</div></div><div data-tab-panel="history" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Date</th><th>Child</th><th>Item</th><th>Amount</th><th>Method</th><th></th></tr></thead><tbody>${historyRows}</tbody></table></section></div></section>`;
  }
  function openPaymentModal(name) {
    const c = parentChildren.find((x) => x.name === name); if (!c) return;
    const paidAmount = c.feeBalance;
    window.SchoolOS.formModal({
      eyebrow: 'Fees', title: `Pay ${c.name}'s balance`, sub: 'Payment is simulated in this demo.',
      fields: [{ name: 'amount', label: 'Amount (₦)', type: 'number', value: c.feeBalance.replace(/[₦,]/g, '') }, { name: 'method', label: 'Payment method', type: 'select', options: ['Card', 'Bank transfer', 'USSD'] }],
      submitLabel: 'Pay now',
      onSubmit: (d) => {
        c.feeBalance = '₦0'; c.feeStatus = 'Paid';
        (parentInvoices[c.name] || []).forEach((i) => { i.status = 'Paid'; });
        paymentHistory.unshift({ date: 'Today', child: c.name, item: 'Third term balance', amount: paidAmount, method: d.method || 'Card', receipt: `RCT-${1100 + paymentHistory.length}` });
        render(); window.SchoolOS.toast(`Payment received · ${c.name}`);
      },
    });
  }
  function openReceiptModal(receipt) {
    const p = paymentHistory.find((x) => x.receipt === receipt); if (!p) return;
    window.SchoolOS.detailModal({ eyebrow: 'Receipt', title: p.receipt, rows: [['Date', p.date], ['Child', p.child], ['Item', p.item], ['Amount', p.amount], ['Method', p.method]], footer: '<div class="form-actions"><button class="outline-button" data-modal-close>Close</button><button class="new-button" data-toast="Receipt downloaded">Download PDF</button></div>' });
  }

  const childTestResults = {
    'Ada Okon': [{ test: 'CA1', subject: 'Mathematics', score: '18/20' }, { test: 'CA2', subject: 'Mathematics', score: '19/20' }, { test: 'Exam', subject: 'Mathematics', score: '52/60' }, { test: 'CA1', subject: 'English', score: '16/20' }, { test: 'Exam', subject: 'English', score: '48/60' }],
    'Emeka Okon': [{ test: 'CA1', subject: 'Mathematics', score: '14/20' }, { test: 'Exam', subject: 'Mathematics', score: '40/60' }, { test: 'CA1', subject: 'English', score: '15/20' }],
  };
  function openChildResultsModal(name) {
    const c = parentChildren.find((x) => x.name === name); if (!c) return;
    const tests = childTestResults[name] || [];
    const rows = [['Position', c.lastResult], ...tests.map((t) => [`${t.subject} · ${t.test}`, t.score])];
    window.SchoolOS.detailModal({ eyebrow: 'Results', title: c.name, rows, footer: `<div class="form-actions"><button class="outline-button" data-modal-close>Close</button><button class="new-button" data-modal-close data-view-report-card="${c.name}">View report card →</button></div>` });
  }
  function openReportCardModal(name) {
    const c = parentChildren.find((x) => x.name === name); if (!c) return;
    window.SchoolOS.detailModal({ eyebrow: 'Third term report card', title: c.name, rows: [['Class', c.cls], ['Position', c.lastResult], ['Attendance', c.attendance], ['Mathematics', 'A'], ['English', 'B'], ['Basic Science', 'A'], ['Class teacher’s remark', 'A consistent, hardworking student.']], footer: '<div class="form-actions"><button class="outline-button" data-modal-close>Close</button><button class="new-button" data-toast="Report card downloaded">Download PDF</button></div>' });
  }
  function openChildAttendanceModal(name) {
    const c = parentChildren.find((x) => x.name === name); if (!c) return;
    window.SchoolOS.detailModal({ eyebrow: 'Attendance', title: c.name, rows: [['This term', c.attendance], ['Days present', '61 / 64'], ['Last absence', '12 Aug']] });
  }
  function pageMyChildren(label) {
    const kpis = [['Children enrolled', String(parentChildren.length), `Linked to ${parentChildren[0]?.guardian || 'you'}`], ['Fees outstanding', '₦45,000', '1 child has a pending balance'], ['Average attendance', '93.5%', 'Across both children'], ['Unread messages', '3', 'From class teachers']];
    const cards = parentChildren.map((c) => `<article class="child-card"><div class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(c.name)}</span><div><strong>${c.name}</strong><small>${c.cls}</small></div></div><div class="child-stats"><div><span>Attendance</span><strong>${c.attendance}</strong></div><div><span>Fee balance</span><strong>${c.feeBalance}</strong></div><div><span>Last result</span><strong>${c.feeStatus === 'Paid' ? 'On track' : 'Review'}</strong></div></div><p class="child-note">${c.lastResult}</p><div class="child-actions"><button class="outline-button" data-view-child-results="${c.name}">View results</button>${c.feeStatus === 'Pending' ? `<button class="new-button" data-pay-child="${c.name}">Pay ${c.feeBalance}</button>` : `<button class="outline-button" data-view-child-attendance="${c.name}">View attendance</button>`}</div></article>`).join('');
    return `<section class="page workspace-page visible" id="my-children"><div class="page-heading"><div><p class="eyebrow">Your family</p><h1>${label}</h1><p class="subtitle">Fees, attendance and results for every child, in one place.</p></div></div><div class="screen-kpis">${kpis.map((s, i) => `<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small class="${i === 1 ? 'warn' : ''}">${s[2]}</small></article>`).join('')}</div><div class="child-grid">${cards}</div></section>`;
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

  window.SchoolOS.onPayChild = openPaymentModal;
  document.addEventListener('click', (e) => {
    const vr = e.target.closest('[data-view-receipt]'); if (vr) openReceiptModal(vr.dataset.viewReceipt);
    const vcr = e.target.closest('[data-view-child-results]'); if (vcr) openChildResultsModal(vcr.dataset.viewChildResults);
    const vrc = e.target.closest('[data-view-report-card]'); if (vrc) openReportCardModal(vrc.dataset.viewReportCard);
    const vca = e.target.closest('[data-view-child-attendance]'); if (vca) openChildAttendanceModal(vca.dataset.viewChildAttendance);
  });

  window.SchoolOS.ready.then((role) => {
    if (!role) return;
    currentRole = role;
    window.SchoolOS.onRoleChange = (r) => { currentRole = r; render(); };
    window.SchoolOS.onCreateNew = () => { if (currentRole === 'proprietor' || currentRole === 'bursar') openNewFeeStructureModal(); else window.SchoolOS.toast('Open a workspace page to create a matching record'); };
    render();
  });
})();
