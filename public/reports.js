// Reports module — mock report catalog, unchanged from the original app.
(function () {
  const reportCatalog = [
    { name: 'Fee collection by campus', scope: 'Finance', updated: 'Today, 08:30' },
    { name: 'Attendance trend', scope: 'Academics', updated: 'Today, 07:50' },
    { name: 'Staff compliance', scope: 'HR', updated: 'Yesterday, 18:10' },
    { name: 'Payroll cost summary', scope: 'Finance', updated: '2 days ago' },
    { name: 'Admissions pipeline', scope: 'Admissions', updated: 'Today, 09:00' },
  ];
  function pageReports(label) {
    const rows = reportCatalog.map((r) => `<tr><td><strong>${r.name}</strong></td><td>${r.scope}</td><td>${r.updated}</td><td class="row-action"><div class="row-actions"><button class="outline-button" data-toast="Generating report · ${r.name}">Generate</button><button class="new-button" data-toast="Report downloaded · ${r.name}">Download</button></div></td></tr>`).join('');
    return `<section class="page workspace-page visible" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Insights</p><h1>${label}</h1><p class="subtitle">Generate and download reports across your school.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Report</th><th>Scope</th><th>Last updated</th><th></th></tr></thead><tbody>${rows}</tbody></table></section></section>`;
  }
  function render() { document.getElementById('reportsSection').innerHTML = pageReports('Reports'); }
  window.SchoolOS.ready.then((role) => {
    if (!role) return;
    window.SchoolOS.onRoleChange = render;
    render();
  });
})();
