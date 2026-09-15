// People & payroll module, Payroll is the one page here with real
// interactive logic (mock data, stepper workflow); Employees/Leave/
// Documents/Performance/Recruitment/Payroll Audit Trail/Statutory Rules/
// Compliance Review all land here via #hash and fall back to the generic
// mock renderer, same as they always did.
(function () {
  const payrollRun = { period: 'August 2026', stage: 'approval', staffCount: 214, totalGross: '₦38.2m', totalDeductions: '₦5.5m', totalNet: '₦32.7m' };
  const payrollStages = [['draft', 'Draft'], ['review', 'Review'], ['approval', 'Approval'], ['finalized', 'Finalized']];
  const payrollRows = [
    { name: 'Amina Yusuf', role: 'Mathematics teacher', gross: '₦420,000', paye: '₦38,500', pension: '₦33,600', nhf: '₦10,500', net: '₦337,400', status: 'Ready' },
    { name: 'Tunde Bello', role: 'Class teacher', gross: '₦380,000', paye: '₦32,100', pension: '₦30,400', nhf: '₦9,500', net: '₦308,000', status: 'Ready' },
    { name: 'Chinwe Okafor', role: 'Bursar', gross: '₦520,000', paye: '₦54,200', pension: '₦41,600', nhf: '₦13,000', net: '₦411,200', status: 'Ready' },
    { name: 'Miriam Danladi', role: 'HR administrator', gross: '₦360,000', paye: '₦29,400', pension: '₦28,800', nhf: '₦9,000', net: '₦292,800', status: 'Flagged' },
  ];
  const salaryGrades = [
    { grade: 'Grade 1 · Teaching (Junior)', basic: '₦180,000', housing: '₦54,000', transport: '₦36,000', other: '₦20,000', gross: '₦290,000' },
    { grade: 'Grade 2 · Teaching (Senior)', basic: '₦230,000', housing: '₦69,000', transport: '₦46,000', other: '₦25,000', gross: '₦370,000' },
    { grade: 'Grade 3 · Head of Department', basic: '₦280,000', housing: '₦84,000', transport: '₦56,000', other: '₦30,000', gross: '₦450,000' },
    { grade: 'Grade 4 · Admin / Support', basic: '₦150,000', housing: '₦45,000', transport: '₦30,000', other: '₦15,000', gross: '₦240,000' },
    { grade: 'Grade 5 · Management', basic: '₦360,000', housing: '₦108,000', transport: '₦72,000', other: '₦40,000', gross: '₦580,000' },
  ];
  const payrollAdvances = [
    { name: 'Amina Yusuf', type: 'Salary advance', amount: '₦100,000', monthly: '₦20,000', balance: '₦60,000', status: 'Active' },
    { name: 'Tunde Bello', type: 'Cooperative loan', amount: '₦250,000', monthly: '₦25,000', balance: '₦175,000', status: 'Active' },
    { name: 'Chinwe Okafor', type: 'Salary advance', amount: '₦80,000', monthly: '₦40,000', balance: '₦0', status: 'Completed' },
  ];
  function openNewPayrollModal() {
    window.SchoolOS.formModal({
      eyebrow: 'Payroll', title: 'Start new payroll run', sub: 'Creates a fresh draft for the next pay period.',
      fields: [{ name: 'period', label: 'Pay period', placeholder: 'e.g. September 2026' }],
      submitLabel: 'Create draft',
      onSubmit: (d) => { payrollRun.period = d.period || 'New pay period'; payrollRun.stage = 'draft'; payrollRows.forEach((r) => { r.status = 'Ready'; }); render(); window.SchoolOS.toast(`New payroll draft created · ${payrollRun.period}`); },
    });
  }
  function openEditSalaryGradeModal(gradeName) {
    const g = salaryGrades.find((x) => x.grade === gradeName); if (!g) return;
    const num = (v) => Number(String(v).replace(/[₦,]/g, ''));
    window.SchoolOS.formModal({
      eyebrow: 'Salary structures', title: gradeName,
      fields: [{ name: 'basic', label: 'Basic (₦)', type: 'number', value: num(g.basic) }, { name: 'housing', label: 'Housing (₦)', type: 'number', value: num(g.housing) }, { name: 'transport', label: 'Transport (₦)', type: 'number', value: num(g.transport) }, { name: 'other', label: 'Other allowances (₦)', type: 'number', value: num(g.other) }],
      submitLabel: 'Save',
      onSubmit: (d) => {
        const basic = Number(d.basic) || 0, housing = Number(d.housing) || 0, transport = Number(d.transport) || 0, other = Number(d.other) || 0;
        g.basic = window.SchoolOS.money(basic); g.housing = window.SchoolOS.money(housing); g.transport = window.SchoolOS.money(transport); g.other = window.SchoolOS.money(other); g.gross = window.SchoolOS.money(basic + housing + transport + other);
        render(); window.SchoolOS.toast(`Salary structure updated · ${gradeName}`);
      },
    });
  }
  function payrollActionsFor(role) {
    const stage = payrollRun.stage;
    if (role === 'proprietor') {
      if (stage === 'approval') return `<button class="outline-button" data-payroll-stage="review" data-payroll-label="Sent back to review">Send back to review</button><button class="new-button" data-payroll-stage="finalized" data-payroll-label="Payroll finalised and queued for bank export">Approve payroll</button>`;
      if (stage === 'finalized') return '<span class="view-only-badge">Finalized</span>';
      return '<span class="view-only-badge">Awaiting bursar / HR</span>';
    }
    if (role === 'bursar' || role === 'hr') {
      const newBtn = role === 'bursar' ? '<button class="outline-button" id="newPayrollBtn">+ New payroll</button>' : '';
      if (stage === 'draft') return `${newBtn}<button class="new-button" data-payroll-stage="review" data-payroll-label="Payroll moved to review">Submit for review</button>`;
      if (stage === 'review') return `${newBtn}<button class="new-button" data-payroll-stage="approval" data-payroll-label="Submitted for proprietor approval">Submit for approval</button>`;
      if (stage === 'approval') return `${newBtn}<span class="view-only-badge">Awaiting proprietor approval</span>`;
      return `${newBtn}<span class="view-only-badge">Finalized</span>`;
    }
    return '<span class="view-only-badge">View only</span>';
  }
  function pagePayroll(label, role) {
    const stageIndex = payrollStages.findIndex(([k]) => k === payrollRun.stage);
    const stepper = payrollStages.map(([k, t], i) => `<div class="payroll-step ${i < stageIndex ? 'done' : ''} ${i === stageIndex ? 'current' : ''}"><span>Step ${i + 1}</span>${t}</div>`).join('');
    const payrollActions = payrollActionsFor(role);
    const canEditStructures = role === 'proprietor' || role === 'hr';
    const kpis = [['Staff on this run', String(payrollRun.staffCount), payrollRun.period], ['Total gross', payrollRun.totalGross, 'Before deductions'], ['Total deductions', payrollRun.totalDeductions, 'PAYE, pension, NHF'], ['Total net pay', payrollRun.totalNet, 'Ready for bank export']];
    const rows = payrollRows.map((r) => `<tr class="${r.status === 'Flagged' ? 'row-flagged' : ''}"><td><div class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(r.name)}</span><div><strong>${r.name}</strong><br><small>${r.role}</small></div></div></td><td>${r.gross}</td><td>${r.paye}</td><td>${r.pension}</td><td>${r.nhf}</td><td><strong>${r.net}</strong></td><td><span class="status ${r.status === 'Flagged' ? 'pending' : ''}">${r.status}</span></td></tr>`).join('');
    const structureRows = salaryGrades.map((g) => `<tr><td><strong>${g.grade}</strong></td><td>${g.basic}</td><td>${g.housing}</td><td>${g.transport}</td><td>${g.other}</td><td><strong>${g.gross}</strong></td><td class="row-action">${canEditStructures ? `<button class="outline-button" data-edit-salary-grade="${g.grade}">Edit</button>` : ''}</td></tr>`).join('');
    const advanceRows = payrollAdvances.map((a) => `<tr><td><div class="person-cell"><span class="mini-avatar">${window.SchoolOS.initialsOf(a.name)}</span>${a.name}</div></td><td>${a.type}</td><td>${a.amount}</td><td>${a.monthly}</td><td>${a.balance}</td><td><span class="status ${a.status !== 'Completed' ? 'pending' : ''}">${a.status}</span></td></tr>`).join('');
    return `<section class="page workspace-page visible" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Payroll</p><h1>${label}</h1><p class="subtitle">${payrollRun.period} payroll run, draft through to finalization.</p></div><div class="payroll-actions">${payrollActions}</div></div><div class="payroll-stepper">${stepper}</div><div class="screen-tabs" data-tabs><button class="active" data-tab="run">Payroll run</button><button data-tab="structures">Salary structures</button><button data-tab="advances">Advances &amp; loans</button></div><div data-tab-panel="run" class="tab-panel visible"><div class="screen-kpis">${kpis.map((s) => `<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('')}</div><div class="workspace-grid-main"><section class="data-card"><div class="data-toolbar"><input aria-label="Search staff" placeholder="Search staff on this run"><button class="filter-button">Status: all ⌄</button></div><table class="data-table"><thead><tr><th>Employee</th><th>Gross</th><th>PAYE</th><th>Pension</th><th>NHF</th><th>Net pay</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></section><aside class="workspace-aside"><section class="side-card"><p class="eyebrow">Payslip preview</p><h3>Miriam Danladi</h3><div class="payslip-lines"><div><span>Gross salary</span><b>₦360,000</b></div><div><span>PAYE</span><b>-₦29,400</b></div><div><span>Pension (8%)</span><b>-₦28,800</b></div><div><span>NHF (2.5%)</span><b>-₦9,000</b></div><div class="payslip-total"><span>Net pay</span><b>₦292,800</b></div></div><button class="outline-button" data-resolve-flag="Miriam Danladi">Resolve flag</button></section><section class="insight-strip"><p class="eyebrow">SchoolOS signal</p><h3>Ready to finalize</h3><p>213 of 214 payslips are ready. Resolve the flagged entry, then export the bank payment file.</p><a href="#" data-toast="Bank payment file exported">Export bank file →</a></section></aside></div></div><div data-tab-panel="structures" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Grade</th><th>Basic</th><th>Housing</th><th>Transport</th><th>Other allowances</th><th>Gross monthly</th><th></th></tr></thead><tbody>${structureRows}</tbody></table></section></div><div data-tab-panel="advances" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Employee</th><th>Type</th><th>Amount</th><th>Monthly deduction</th><th>Balance</th><th>Status</th></tr></thead><tbody>${advanceRows}</tbody></table></section></div></section>`;
  }
  function setPayrollStage(stage, label) { payrollRun.stage = stage; render(); window.SchoolOS.toast(label); }
  function resolvePayrollFlag(name) { const r = payrollRows.find((x) => x.name === name); if (!r) return; r.status = 'Ready'; render(); window.SchoolOS.toast(`Flag resolved · ${name}`); }

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

  const GENERIC_LABELS = { employees: 'Employees', leave: 'Leave', documents: 'Documents', performance: 'Performance', recruitment: 'Recruitment', 'payroll-audit-trail': 'Payroll Audit Trail', 'statutory-rules': 'Statutory Rules', 'compliance-review': 'Compliance Review' };

  let currentRole = 'proprietor';
  function render() {
    const container = document.getElementById('peopleSection');
    const hash = location.hash.slice(1);
    if (GENERIC_LABELS[hash]) { container.innerHTML = window.SchoolOS.renderGenericPage(GENERIC_LABELS[hash]); return; }
    container.innerHTML = pagePayroll(currentRole === 'proprietor' ? 'People & payroll' : 'Payroll', currentRole);
    bindTabs();
    const newBtn = document.getElementById('newPayrollBtn'); if (newBtn) newBtn.addEventListener('click', openNewPayrollModal);
  }

  document.addEventListener('click', (e) => {
    const ps = e.target.closest('[data-payroll-stage]'); if (ps) setPayrollStage(ps.dataset.payrollStage, ps.dataset.payrollLabel);
    const rf = e.target.closest('[data-resolve-flag]'); if (rf) resolvePayrollFlag(rf.dataset.resolveFlag);
    const es = e.target.closest('[data-edit-salary-grade]'); if (es) openEditSalaryGradeModal(es.dataset.editSalaryGrade);
  });

  window.SchoolOS.ready.then((role) => {
    if (!role) return;
    currentRole = role;
    window.SchoolOS.onRoleChange = (r) => { currentRole = r; render(); };
    window.SchoolOS.onCreateNew = () => { if (currentRole === 'bursar') openNewPayrollModal(); else window.SchoolOS.toast('Open a workspace page to create a matching record'); };
    render();
  });
})();
