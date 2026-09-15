// Settings module: proprietor gets the real branding/templates/bulk-import
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
  let documentTemplates = [];
  function brandingPreviewHtml(b) {
    const logo = b.logoUrl ? `<img src="${b.logoUrl}" alt="Logo" style="width:34px;height:34px;border-radius:9px;object-fit:cover">` : `<div style="width:34px;height:34px;border-radius:9px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.35);font:16px var(--serif)">S</div>`;
    return `<div class="brand-preview"><div class="brand-preview-chrome"><span></span><span></span><span></span></div><div class="brand-preview-body" style="background:${b.sidebarColor || '#123a31'}"><div class="brand-preview-card">${logo}<h3 style="margin-top:10px">${window.SchoolOS.escapeHtml(b.loginHeadline || '')}</h3><p>${window.SchoolOS.escapeHtml(b.loginSubtext || '')}</p><div class="brand-preview-btn" style="background:${b.primaryColor || '#176a50'}">Sign in</div></div></div></div>`;
  }
  function pageSettingsProprietor(label) {
    return `<section class="page workspace-page visible" id="settings"><div class="page-heading"><div><p class="eyebrow">Settings</p><h1>${label}</h1><p class="subtitle">Appearance, branding, document templates and mid-term data migration for your school.</p></div></div><div class="screen-tabs" data-tabs><button class="active" data-tab="appearance">Appearance</button><button data-tab="branding">Branding</button><button data-tab="templates">Document templates</button><button data-tab="bulk-import">Bulk import</button></div><div data-tab-panel="appearance" class="tab-panel visible"><div class="workspace-grid-main"><section class="data-card" style="padding:18px"><p class="modal-sub">Applies instantly across the app for everyone in your school, once saved.</p><form id="appearanceForm" onsubmit="__appearanceSubmit(event)"><div class="form-row"><div class="form-field"><label>Primary colour (buttons, links, highlights)</label><input name="primaryColor" type="color" id="appearancePrimaryInput" value="#176a50"></div><div class="form-field"><label>Sidebar colour</label><input name="sidebarColor" type="color" id="appearanceSidebarInput" value="#123a31"></div></div><div class="form-actions"><button type="button" class="outline-button" id="appearanceResetBtn">Reset to default</button><button type="submit" class="new-button">Save colours</button></div></form></section><aside class="workspace-aside"><section class="side-card"><p class="eyebrow">Live preview</p><div id="appearancePreviewBox"></div><small>Updates as you pick, saved once you click Save colours.</small></section></aside></div></div><div data-tab-panel="branding" class="tab-panel"><div class="workspace-grid-main"><section class="data-card" style="padding:18px"><p class="modal-sub">Shown on both the Student/Parent and Staff/Admin sign-in pages, for anyone who's ever signed in from this browser before (see the note below).</p><form id="brandingForm" onsubmit="__brandingSubmit(event)"><div class="form-field"><label>School display name</label><input name="name" id="brandingNameInput" maxlength="100" placeholder="e.g. Greenfield International Schools"><small style="display:block;margin-top:5px;color:var(--muted)">Shown in the sidebar and on both sign-in pages.</small></div><div class="form-field"><label>Logo</label><input type="file" id="brandingLogoFile" accept="image/png,image/jpeg,image/webp,image/svg+xml"><input type="hidden" name="logoUrl" id="brandingLogoInput"><small style="display:block;margin-top:5px;color:var(--muted)" id="brandingLogoStatus">PNG, JPEG, WEBP, or SVG, up to 5MB.</small></div><div class="form-field"><label>Login page headline</label><input name="loginHeadline" id="brandingHeadlineInput" maxlength="80" placeholder="Welcome to your school portal."></div><div class="form-field"><label>Login page subtext</label><textarea name="loginSubtext" id="brandingSubtextInput" maxlength="200" placeholder="Sign in to continue."></textarea></div><div class="form-actions"><button type="button" class="outline-button" id="brandingRemoveLogoBtn">Remove logo</button><button type="submit" class="new-button">Save branding</button></div></form></section><aside class="workspace-aside"><section class="side-card"><p class="eyebrow">Live preview</p><div id="brandingPreviewBox"></div><small>This is what families see on your school's login page. Never resolves for other tenants. New visitors who've never signed in on a given browser still see the default copy until they do — there's no way to know which school someone is until they identify themselves.</small></section></aside></div></div><div data-tab-panel="templates" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Template</th><th>Status</th><th>Version</th><th>Last updated</th><th></th></tr></thead><tbody id="templatesTableBody"><tr><td colspan="5">Loading…</td></tr></tbody></table></section></div><div data-tab-panel="bulk-import" class="tab-panel"><section class="data-card" style="padding:18px"><p class="modal-sub">Import existing student records (CSV) so a school can switch mid-term without losing history. Staff and result import aren't built on the backend yet.</p><div class="workspace-grid"><article class="side-card"><p class="eyebrow">Students</p><h3>Student records</h3><p>Name, campus, class/arm, guardian</p><div class="row-actions"><button class="outline-button" id="downloadStudentsTemplateBtn">Download CSV template</button><label class="new-button" style="cursor:pointer;display:inline-flex;align-items:center">Upload &amp; import<input type="file" accept=".csv" id="studentsImportFile" style="display:none"></label></div></article><article class="side-card"><p class="eyebrow">Staff</p><h3>Staff records</h3><p>Not built on the backend yet</p><div class="row-actions"><button class="outline-button" disabled title="Not built yet">Download CSV template</button><button class="new-button" disabled title="Not built yet">Upload &amp; import</button></div></article><article class="side-card"><p class="eyebrow">Results</p><h3>Result records</h3><p>Not built on the backend yet</p><div class="row-actions"><button class="outline-button" disabled title="Not built yet">Download CSV template</button><button class="new-button" disabled title="Not built yet">Upload &amp; import</button></div></article></div></section><section class="data-card" id="bulkImportResultCard" style="margin-top:14px;display:none"></section><section class="data-card" style="margin-top:14px"><div class="data-toolbar"><strong>Import history</strong></div><table class="data-table"><thead><tr><th>Date</th><th>Rows</th><th>Created</th><th>Failed</th></tr></thead><tbody id="bulkImportHistoryBody"><tr><td colspan="4">Loading…</td></tr></tbody></table></section></div></section>`;
  }

  // ---- Appearance (real, persisted per tenant, applies instantly) ----
  function appearancePreviewHtml(primaryColor, sidebarColor) {
    return `<div class="brand-preview"><div class="brand-preview-chrome"><span></span><span></span><span></span></div><div class="brand-preview-body" style="background:${sidebarColor};padding:16px"><div class="brand-preview-card"><p class="brand-preview-logo">Sidebar</p><div class="brand-preview-btn" style="background:${primaryColor}">Button / link colour</div></div></div></div>`;
  }
  async function loadAppearanceSettings() {
    const primaryInput = document.getElementById('appearancePrimaryInput');
    const sidebarInput = document.getElementById('appearanceSidebarInput');
    const previewBox = document.getElementById('appearancePreviewBox');
    if (!primaryInput || !sidebarInput) return;
    try {
      const branding = await window.SchoolOS.api('/tenants/me/branding');
      primaryInput.value = branding.primaryColor;
      sidebarInput.value = branding.sidebarColor;
    } catch (err) { window.SchoolOS.toast(`Could not load appearance settings (${err.message})`); }
    if (previewBox) previewBox.innerHTML = appearancePreviewHtml(primaryInput.value, sidebarInput.value);
    [primaryInput, sidebarInput].forEach((input) => input.addEventListener('input', () => {
      if (previewBox) previewBox.innerHTML = appearancePreviewHtml(primaryInput.value, sidebarInput.value);
    }));
    const resetBtn = document.getElementById('appearanceResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      primaryInput.value = '#176a50';
      sidebarInput.value = '#123a31';
      if (previewBox) previewBox.innerHTML = appearancePreviewHtml(primaryInput.value, sidebarInput.value);
    });
  }
  window.__appearanceSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const primaryColor = fd.get('primaryColor');
    const sidebarColor = fd.get('sidebarColor');
    try {
      await window.SchoolOS.api('/tenants/me/branding', { method: 'PUT', body: JSON.stringify({ primaryColor, sidebarColor }) });
      window.SchoolOS.refreshBrandColors();
      window.SchoolOS.toast('Colour scheme saved');
    } catch (err) { window.SchoolOS.toast(`Could not save colours (${err.message})`); }
  };
  let lastLoadedBranding = {};
  async function loadBrandingSettings() {
    const nameInput = document.getElementById('brandingNameInput');
    const logoInput = document.getElementById('brandingLogoInput');
    const logoFileInput = document.getElementById('brandingLogoFile');
    const logoStatus = document.getElementById('brandingLogoStatus');
    const headlineInput = document.getElementById('brandingHeadlineInput');
    const subtextInput = document.getElementById('brandingSubtextInput');
    const previewBox = document.getElementById('brandingPreviewBox');
    if (!nameInput || !logoInput || !headlineInput || !subtextInput) return;
    try {
      lastLoadedBranding = await window.SchoolOS.api('/tenants/me/branding');
      nameInput.value = lastLoadedBranding.name || '';
      logoInput.value = lastLoadedBranding.logoUrl || '';
      headlineInput.value = lastLoadedBranding.loginHeadline || '';
      subtextInput.value = lastLoadedBranding.loginSubtext || '';
    } catch (err) { window.SchoolOS.toast(`Could not load branding (${err.message})`); }
    const renderPreview = () => { if (previewBox) previewBox.innerHTML = brandingPreviewHtml({ ...lastLoadedBranding, name: nameInput.value, logoUrl: logoInput.value, loginHeadline: headlineInput.value, loginSubtext: subtextInput.value }); };
    renderPreview();
    [nameInput, headlineInput, subtextInput].forEach((input) => input.addEventListener('input', renderPreview));
    if (logoFileInput) logoFileInput.addEventListener('change', async () => {
      const file = logoFileInput.files && logoFileInput.files[0];
      if (!file) return;
      if (logoStatus) logoStatus.textContent = 'Uploading…';
      try {
        const fd = new FormData();
        fd.append('file', file);
        const { url } = await window.SchoolOS.api('/uploads/logo', { method: 'POST', body: fd });
        logoInput.value = url;
        renderPreview();
        if (logoStatus) logoStatus.textContent = 'Uploaded — click Save branding to apply.';
      } catch (err) {
        if (logoStatus) logoStatus.textContent = 'PNG, JPEG, WEBP, or SVG, up to 5MB.';
        window.SchoolOS.toast(`Could not upload logo (${err.message})`);
      } finally {
        logoFileInput.value = '';
      }
    });
    const removeLogoBtn = document.getElementById('brandingRemoveLogoBtn');
    if (removeLogoBtn) removeLogoBtn.addEventListener('click', async () => {
      try {
        lastLoadedBranding = await window.SchoolOS.api('/tenants/me/branding', { method: 'PUT', body: JSON.stringify({ clearLogo: true }) });
        logoInput.value = ''; renderPreview();
        window.SchoolOS.refreshBrandColors();
        window.SchoolOS.toast('Logo removed');
      } catch (err) { window.SchoolOS.toast(`Could not remove logo (${err.message})`); }
    });
  }
  window.__brandingSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = (fd.get('name') || '').trim();
    const logoUrl = (fd.get('logoUrl') || '').trim();
    const loginHeadline = (fd.get('loginHeadline') || '').trim();
    const loginSubtext = (fd.get('loginSubtext') || '').trim();
    if (!name) { window.SchoolOS.toast('School display name cannot be blank'); return; }
    try {
      await window.SchoolOS.api('/tenants/me/branding', {
        method: 'PUT',
        body: JSON.stringify({ name, logoUrl: logoUrl || undefined, loginHeadline: loginHeadline || undefined, loginSubtext: loginSubtext || undefined }),
      });
      window.SchoolOS.refreshBrandColors();
      window.SchoolOS.toast('Branding saved · applies to your sidebar and sign-in pages');
    } catch (err) { window.SchoolOS.toast(`Could not save branding (${err.message})`); }
  };
  // ---- Document templates (real, persisted per tenant) ----
  async function loadDocumentTemplates() {
    const tbody = document.getElementById('templatesTableBody');
    if (!tbody) return;
    try {
      documentTemplates = await window.SchoolOS.api('/document-templates');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5">Could not load templates (${err.message})</td></tr>`;
      return;
    }
    tbody.innerHTML = documentTemplates.length ? documentTemplates.map((t) => `<tr><td><strong>${t.name}</strong></td><td><span class="status ${t.status !== 'PUBLISHED' ? 'pending' : ''}">${t.status}</span></td><td>v${t.version}</td><td>${new Date(t.updatedAt).toLocaleDateString()}</td><td class="row-action"><div class="row-actions"><button class="outline-button" data-preview-template="${t.id}">Preview</button><button class="outline-button" data-edit-template="${t.id}">Edit</button>${t.status === 'DRAFT' ? `<button class="new-button" data-publish-template="${t.id}">Publish</button>` : ''}</div></td></tr>`).join('') : '<tr><td colspan="5">No templates yet.</td></tr>';
  }
  async function openTemplatePreviewModal(id) {
    window.SchoolOS.openModal('<p class="eyebrow">Template preview</p><h2>Loading…</h2>');
    let t;
    try { t = await window.SchoolOS.api(`/document-templates/${id}/preview`); } catch (err) {
      window.SchoolOS.closeModal(); window.SchoolOS.toast(`Could not load preview (${err.message})`); return;
    }
    const fields = (t.mergeFields || []).map((f) => `<span class="permission-chip">${f}</span>`).join('');
    window.SchoolOS.openModal(`<p class="eyebrow">Template preview · v${t.version} · ${t.status}</p><h2>${t.name}</h2><p class="modal-sub">Rendered against real data from your school (a real student/term/session where one exists). Tenant-scoped: this template never resolves for another school.</p><pre class="template-preview-box">${window.SchoolOS.escapeHtml(t.rendered)}</pre><p class="modal-sub" style="margin:14px 0 6px">Merge fields this template supports</p><div class="submission-list">${fields}</div><div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>`);
  }
  function openTemplateEditModal(id) {
    const t = documentTemplates.find((x) => x.id === id); if (!t) return;
    window.SchoolOS.formModal({
      eyebrow: 'Edit template', title: t.name, sub: `Saves as v${t.version + 1} and drops to Draft. Publish it to make it live for every new document — what's currently Published keeps rendering as-is until then.`,
      fields: [{ name: 'content', label: 'Template content', type: 'textarea', value: t.content, placeholder: 'Use {{merge.fields}} — see Preview for the full list this template supports' }],
      submitLabel: 'Save as draft',
      onSubmit: async (d) => {
        try {
          await window.SchoolOS.api(`/document-templates/${id}`, { method: 'PATCH', body: JSON.stringify({ content: d.content }) });
          window.SchoolOS.toast(`Draft saved · ${t.name} (v${t.version + 1})`);
          loadDocumentTemplates();
        } catch (err) { window.SchoolOS.toast(`Could not save (${err.message})`); }
      },
    });
  }
  async function publishTemplate(id) {
    const t = documentTemplates.find((x) => x.id === id); if (!t) return;
    try {
      await window.SchoolOS.api(`/document-templates/${id}/publish`, { method: 'POST' });
      window.SchoolOS.toast(`Published · ${t.name} is now used for every new document`);
      loadDocumentTemplates();
    } catch (err) { window.SchoolOS.toast(`Could not publish (${err.message})`); }
  }

  // ---- Bulk import: students (real, backed by POST /students/bulk-import) ----
  const STUDENTS_IMPORT_HEADERS = ['firstName', 'lastName', 'middleName', 'dateOfBirth', 'gender', 'campusName', 'className', 'armName', 'guardianFirstName', 'guardianLastName', 'guardianEmail', 'guardianPhone', 'guardianRelationship'];
  function downloadStudentsTemplate() {
    const sampleRow = ['Ada', 'Okafor', '', '2014-03-12', 'Female', 'Ikoyi Campus', 'JSS 1', 'JSS 1 Gold', 'Chidi', 'Okafor', 'chidi.okafor@example.com', '08012345678', 'FATHER'];
    const csv = [STUDENTS_IMPORT_HEADERS.join(','), sampleRow.map((v) => `"${v}"`).join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'students-import-template.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  /** Minimal CSV parser: handles quoted fields (with escaped "" inside
   * quotes) and commas inside quotes, which covers what a real school
   * spreadsheet export needs without pulling in a library for one form. */
  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else field += c;
      } else if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some((v) => v !== '')) rows.push(row);
        row = [];
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return [];
    const headers = rows[0].map((h) => h.trim());
    return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])));
  }
  async function handleStudentsImportFile(file) {
    const text = await file.text();
    const parsed = parseCsv(text);
    if (!parsed.length) { window.SchoolOS.toast('That CSV has no data rows'); return; }
    const rows = parsed.map((r) => ({
      firstName: r.firstName, lastName: r.lastName, middleName: r.middleName || undefined,
      dateOfBirth: r.dateOfBirth || undefined, gender: r.gender || undefined,
      campusName: r.campusName, className: r.className || undefined, armName: r.armName || undefined,
      guardianFirstName: r.guardianFirstName, guardianLastName: r.guardianLastName,
      guardianEmail: r.guardianEmail || undefined, guardianPhone: r.guardianPhone || undefined,
      guardianRelationship: r.guardianRelationship || undefined,
    }));
    const resultCard = document.getElementById('bulkImportResultCard');
    if (resultCard) { resultCard.style.display = 'block'; resultCard.innerHTML = `<div class="data-toolbar"><strong>Importing ${rows.length} row${rows.length === 1 ? '' : 's'}…</strong></div>`; }
    try {
      const res = await window.SchoolOS.api('/students/bulk-import', { method: 'POST', body: JSON.stringify({ rows }) });
      if (resultCard) {
        const failedRows = res.results.filter((r) => !r.success);
        resultCard.innerHTML = `<div class="data-toolbar"><strong>Import complete · ${res.successCount}/${res.totalRows} students created</strong></div>${failedRows.length ? `<table class="data-table"><thead><tr><th>Row</th><th>Error</th></tr></thead><tbody>${failedRows.map((r) => `<tr><td>#${r.row}</td><td>${window.SchoolOS.escapeHtml(r.error)}</td></tr>`).join('')}</tbody></table>` : '<p class="modal-sub" style="padding:0 18px 14px">Every row imported cleanly.</p>'}`;
      }
      window.SchoolOS.toast(`Import complete · ${res.successCount}/${res.totalRows} students created`);
      loadBulkImportHistory();
    } catch (err) {
      if (resultCard) resultCard.innerHTML = `<div class="data-toolbar"><strong>Import failed</strong></div><p class="modal-sub" style="padding:0 18px 14px">${err.message}</p>`;
      window.SchoolOS.toast(`Import failed (${err.message})`);
    }
  }
  async function loadBulkImportHistory() {
    const tbody = document.getElementById('bulkImportHistoryBody');
    if (!tbody) return;
    try {
      const history = await window.SchoolOS.api('/students/bulk-import-history');
      tbody.innerHTML = history.length ? history.map((h) => `<tr><td>${new Date(h.date).toLocaleString()}</td><td>${h.totalRows}</td><td>${h.successCount}</td><td>${h.failureCount}</td></tr>`).join('') : '<tr><td colspan="4">No imports yet.</td></tr>';
    } catch (err) { tbody.innerHTML = `<tr><td colspan="4">Could not load import history (${err.message})</td></tr>`; }
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
    if (currentRole === 'proprietor') {
      loadAppearanceSettings();
      loadBrandingSettings();
      loadDocumentTemplates();
      loadBulkImportHistory();
      const downloadBtn = document.getElementById('downloadStudentsTemplateBtn');
      if (downloadBtn) downloadBtn.addEventListener('click', downloadStudentsTemplate);
      const fileInput = document.getElementById('studentsImportFile');
      if (fileInput) fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) handleStudentsImportFile(fileInput.files[0]);
        fileInput.value = '';
      });
    }
  }

  document.addEventListener('click', (e) => {
    const pt = e.target.closest('[data-preview-template]'); if (pt) openTemplatePreviewModal(pt.dataset.previewTemplate);
    const et = e.target.closest('[data-edit-template]'); if (et) openTemplateEditModal(et.dataset.editTemplate);
    const pbt = e.target.closest('[data-publish-template]'); if (pbt) publishTemplate(pbt.dataset.publishTemplate);
  });

  window.SchoolOS.ready.then((role) => {
    if (!role) return;
    currentRole = role;
    window.SchoolOS.onRoleChange = (r) => { currentRole = r; render(); };
    render();
  });
})();
