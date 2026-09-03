// Settings module — proprietor gets the real branding/templates/bulk-import
// workspace; every other role sees the generic mock page, same as the
// original app. Schools/Campuses (proprietor-only) lands here via #schools.
(function () {
  let currentRole = 'proprietor';

  // ---- Schools / Campuses ----
  const schoolCampuses = [
    { name: 'Ikoyi Campus', address: '12 Bourdillon Road, Ikoyi', students: 842, staff: 78, principal: 'Bolanle Adeyemi' },
    { name: 'Lekki Campus', address: 'Freedom Way, Lekki Phase 1', students: 615, staff: 61, principal: 'Ngozi Umeh' },
    { name: 'Yaba Campus', address: 'Herbert Macaulay Way, Yaba', students: 391, staff: 44, principal: 'Chuka Obi' },
  ];
  function openNewSchoolModal() {
    window.SchoolOS.formModal({
      eyebrow: 'Schools & campuses', title: 'Add school / campus',
      fields: [{ name: 'name', label: 'Campus name', placeholder: 'e.g. Ajah Campus' }, { name: 'address', label: 'Address', placeholder: 'Street, area' }, { name: 'principal', label: 'Campus principal', placeholder: 'e.g. Mrs. Adeyemi' }],
      submitLabel: 'Add campus',
      onSubmit: (d) => { schoolCampuses.push({ name: d.name || 'New campus', address: d.address || '—', students: 0, staff: 0, principal: d.principal || 'Unassigned' }); render(); window.SchoolOS.toast(`Campus added · ${d.name || 'New campus'}`); },
    });
  }
  function pageSchools(label) {
    const kpis = [['Campuses', String(schoolCampuses.length), 'Under Greenfield Schools'], ['Total students', String(schoolCampuses.reduce((n, c) => n + c.students, 0)), 'Across all campuses'], ['Total staff', String(schoolCampuses.reduce((n, c) => n + c.staff, 0)), 'Teaching and non-teaching'], ['Group session', '2025/2026', 'Third term']];
    const cards = schoolCampuses.map((c) => `<article class="data-card campus-detail-card"><div class="data-toolbar"><div><strong>${c.name}</strong><small>${c.address}</small></div><button class="outline-button" data-toast="Editing ${c.name}">Edit</button></div><div class="child-stats"><div><span>Students</span><strong>${c.students}</strong></div><div><span>Staff</span><strong>${c.staff}</strong></div><div><span>Principal</span><strong>${c.principal}</strong></div></div></article>`).join('');
    return `<section class="page workspace-page visible" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">School group</p><h1>${label}</h1><p class="subtitle">Every campus under Greenfield Schools, in one place.</p></div><button class="new-button" id="addSchoolBtn">+ Add school</button></div><div class="screen-kpis">${kpis.map((s) => `<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('')}</div><div class="fee-child-grid">${cards}</div></section>`;
  }

  // ---- Proprietor settings (branding / templates / bulk import) ----
  const brandingSettings = { schoolName: 'Greenfield International Schools', primaryColor: '#1d6f5c', secondaryColor: '#f2b134', logoLabel: 'greenfield-logo.png', loginHeadline: 'Welcome back to Greenfield', loginSubtext: 'Sign in to your school portal to continue.', campus: 'All campuses' };
  const documentTemplates = [
    { name: 'Report card', status: 'Published', version: 'v3', updated: '12 Aug' },
    { name: 'Fee bill / invoice', status: 'Published', version: 'v2', updated: '3 Aug' },
    { name: 'Payment receipt', status: 'Draft', version: 'v1', updated: 'Today' },
    { name: 'Admission letter', status: 'Published', version: 'v1', updated: '20 Jul' },
  ];
  const templateMergeFields = {
    'Report card': ['{{student.name}}', '{{student.class}}', '{{student.position}}', '{{subject.scores}}', '{{term.name}}', '{{school.name}}', '{{school.logo}}'],
    'Fee bill / invoice': ['{{student.name}}', '{{invoice.number}}', '{{invoice.items}}', '{{invoice.total}}', '{{invoice.dueDate}}', '{{school.name}}', '{{school.bankDetails}}'],
    'Payment receipt': ['{{receipt.number}}', '{{student.name}}', '{{payment.amount}}', '{{payment.method}}', '{{payment.date}}', '{{school.name}}'],
    'Admission letter': ['{{applicant.name}}', '{{applicant.class}}', '{{school.name}}', '{{school.principalName}}', '{{term.startDate}}'],
  };
  const bulkImportHistory = [{ type: 'Students', rows: 812, status: 'Completed', date: '3 days ago' }, { type: 'Staff', rows: 64, status: 'Completed', date: '3 days ago' }];
  function brandPreviewHtml() {
    const b = brandingSettings;
    return `<div class="brand-preview"><div class="brand-preview-chrome"><span></span><span></span><span></span></div><div class="brand-preview-body" style="background:${b.primaryColor}"><div class="brand-preview-card"><p class="brand-preview-logo">${b.schoolName}</p><h3>${b.loginHeadline}</h3><p>${b.loginSubtext}</p><div class="brand-preview-btn" style="background:${b.secondaryColor}">Sign in</div></div></div></div>`;
  }
  function pageSettingsProprietor(label) {
    const templateRows = documentTemplates.map((t) => `<tr><td><strong>${t.name}</strong></td><td><span class="status ${t.status !== 'Published' ? 'pending' : ''}">${t.status}</span></td><td>${t.version}</td><td>${t.updated}</td><td class="row-action"><div class="row-actions"><button class="outline-button" data-preview-template="${t.name}">Preview</button><button class="outline-button" data-edit-template="${t.name}">Edit</button>${t.status === 'Draft' ? `<button class="new-button" data-publish-template="${t.name}">Publish</button>` : ''}</div></td></tr>`).join('');
    const importRows = bulkImportHistory.map((h) => `<tr><td>${h.type}</td><td>${h.rows}</td><td><span class="status">${h.status}</span></td><td>${h.date}</td></tr>`).join('');
    return `<section class="page workspace-page visible" id="settings"><div class="page-heading"><div><p class="eyebrow">Settings</p><h1>${label}</h1><p class="subtitle">Branding, document templates and mid-term data migration for your school.</p></div></div><div class="screen-tabs" data-tabs><button class="active" data-tab="branding">Branding</button><button data-tab="templates">Document templates</button><button data-tab="bulk-import">Bulk import</button></div><div data-tab-panel="branding" class="tab-panel visible"><div class="workspace-grid-main"><section class="data-card" style="padding:18px"><form id="brandingForm" onsubmit="__brandingSubmit(event)"><div class="form-row"><div class="form-field"><label>School display name</label><input name="schoolName" value="${brandingSettings.schoolName}"></div><div class="form-field"><label>Applies to</label><select name="campus">${['All campuses', 'Ikoyi', 'Lekki', 'Yaba'].map((c) => `<option ${c === brandingSettings.campus ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div><div class="form-row"><div class="form-field"><label>Primary colour</label><input name="primaryColor" type="color" value="${brandingSettings.primaryColor}"></div><div class="form-field"><label>Secondary colour</label><input name="secondaryColor" type="color" value="${brandingSettings.secondaryColor}"></div></div><div class="modal-upload">📎 Upload logo (demo only) — current: ${brandingSettings.logoLabel}</div><div class="form-field"><label>Login page headline</label><input name="loginHeadline" value="${brandingSettings.loginHeadline}"></div><div class="form-field"><label>Login page subtext</label><textarea name="loginSubtext">${brandingSettings.loginSubtext}</textarea></div><div class="form-actions"><button type="submit" class="new-button">Save branding</button></div></form></section><aside class="workspace-aside"><section class="side-card"><p class="eyebrow">Live preview</p><h3 id="brandPreviewName">${brandingSettings.schoolName}</h3><div id="brandPreviewBox">${brandPreviewHtml()}</div><small>This is what families see on your school’s login page. Never resolves for other tenants.</small></section></aside></div></div><div data-tab-panel="templates" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Template</th><th>Status</th><th>Version</th><th>Last updated</th><th></th></tr></thead><tbody>${templateRows}</tbody></table></section></div><div data-tab-panel="bulk-import" class="tab-panel"><section class="data-card" style="padding:18px"><p class="modal-sub">Import existing student, staff and result records so a school can switch mid-term without losing history.</p><div class="workspace-grid"><article class="side-card"><p class="eyebrow">Students</p><h3>Student records</h3><p>Name, class, guardian, admission number</p><div class="row-actions"><button class="outline-button" data-toast="Template downloaded (demo)">Download template</button><button class="new-button" data-bulk-import="Students">Upload &amp; import</button></div></article><article class="side-card"><p class="eyebrow">Staff</p><h3>Staff records</h3><p>Name, role, subjects, employment date</p><div class="row-actions"><button class="outline-button" data-toast="Template downloaded (demo)">Download template</button><button class="new-button" data-bulk-import="Staff">Upload &amp; import</button></div></article><article class="side-card"><p class="eyebrow">Results</p><h3>Result records</h3><p>Student, subject, term, scores</p><div class="row-actions"><button class="outline-button" data-toast="Template downloaded (demo)">Download template</button><button class="new-button" data-bulk-import="Results">Upload &amp; import</button></div></article></div></section><section class="data-card" style="margin-top:14px"><div class="data-toolbar"><strong>Import history</strong></div><table class="data-table"><thead><tr><th>Type</th><th>Rows</th><th>Status</th><th>Date</th></tr></thead><tbody>${importRows}</tbody></table></section></div></section>`;
  }
  function saveBranding(form) {
    const fd = new FormData(form);
    brandingSettings.schoolName = fd.get('schoolName') || brandingSettings.schoolName;
    brandingSettings.campus = fd.get('campus');
    brandingSettings.primaryColor = fd.get('primaryColor');
    brandingSettings.secondaryColor = fd.get('secondaryColor');
    brandingSettings.loginHeadline = fd.get('loginHeadline') || brandingSettings.loginHeadline;
    brandingSettings.loginSubtext = fd.get('loginSubtext') || brandingSettings.loginSubtext;
    const box = document.getElementById('brandPreviewBox'); if (box) box.innerHTML = brandPreviewHtml();
    const nameEl = document.getElementById('brandPreviewName'); if (nameEl) nameEl.textContent = brandingSettings.schoolName;
    window.SchoolOS.toast(`Branding saved · applies to ${brandingSettings.campus}`);
  }
  window.__brandingSubmit = (e) => { e.preventDefault(); saveBranding(e.target); };
  function openTemplatePreviewModal(name) {
    const fields = (templateMergeFields[name] || []).map((f) => `<span class="permission-chip">${f}</span>`).join('');
    window.SchoolOS.openModal(`<p class="eyebrow">Template preview</p><h2>${name}</h2><p class="modal-sub">Merge fields used by this template — replaced with real data when a document is generated. Tenant-scoped: this template and its assets never resolve for another school.</p><div class="submission-list">${fields}</div><div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>`);
  }
  function openTemplateEditModal(name) {
    const t = documentTemplates.find((x) => x.name === name); if (!t) return;
    window.SchoolOS.formModal({
      eyebrow: 'Edit template', title: name, sub: 'Editing creates a new draft version — publish it to make it live for every new document.',
      fields: [{ name: 'notes', label: 'Change notes', type: 'textarea', placeholder: 'What did you change in this version?' }],
      submitLabel: 'Save as draft',
      onSubmit: () => { const n = Number(t.version.replace('v', '')) + 1; t.version = `v${n}`; t.status = 'Draft'; t.updated = 'Today'; render(); window.SchoolOS.toast(`Draft saved · ${name} (v${n})`); },
    });
  }
  function publishTemplate(name) {
    const t = documentTemplates.find((x) => x.name === name); if (!t) return;
    t.status = 'Published'; t.updated = 'Today';
    render(); window.SchoolOS.toast(`Published · ${name} is now used for every new document`);
  }
  function openBulkImportModal(kind) {
    window.SchoolOS.formModal({
      eyebrow: 'Bulk import', title: `Import ${kind.toLowerCase()} records`, sub: 'CSV only. Rows are matched to existing records where possible; the rest are queued for review.',
      fields: [{ name: 'notes', label: 'Import notes', type: 'textarea', placeholder: 'e.g. Mid-term transfer from previous system' }],
      submitLabel: 'Upload & import',
      onSubmit: () => {
        const rows = kind === 'Students' ? 128 : kind === 'Staff' ? 14 : 960;
        bulkImportHistory.unshift({ type: kind, rows, status: 'Completed', date: 'Today' });
        render(); window.SchoolOS.toast(`Import complete · ${rows} ${kind.toLowerCase()} rows processed`);
      },
    });
  }

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

  function render() {
    const container = document.getElementById('settingsSection');
    if (location.hash === '#schools') {
      container.innerHTML = pageSchools('Schools / Campuses');
      const addBtn = document.getElementById('addSchoolBtn'); if (addBtn) addBtn.addEventListener('click', openNewSchoolModal);
      return;
    }
    container.innerHTML = currentRole === 'proprietor' ? pageSettingsProprietor('Settings') : window.SchoolOS.renderGenericPage('Settings');
    bindTabs();
  }

  document.addEventListener('click', (e) => {
    const pt = e.target.closest('[data-preview-template]'); if (pt) openTemplatePreviewModal(pt.dataset.previewTemplate);
    const et = e.target.closest('[data-edit-template]'); if (et) openTemplateEditModal(et.dataset.editTemplate);
    const pbt = e.target.closest('[data-publish-template]'); if (pbt) publishTemplate(pbt.dataset.publishTemplate);
    const bi = e.target.closest('[data-bulk-import]'); if (bi) openBulkImportModal(bi.dataset.bulkImport);
  });

  window.SchoolOS.ready.then((role) => {
    if (!role) return;
    currentRole = role;
    window.SchoolOS.onRoleChange = (r) => { currentRole = r; render(); };
    render();
  });
})();
