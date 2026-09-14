// Messages / Communication — real, via POST /communication/announcements
// (audience-targeted: INDIVIDUAL/ARM/PARENT_GROUP/CAMPUS/SCHOOL) and
// GET /notifications/me for the read-only inbox. "Parents" (principal's
// view-only staff nav item) lands here too via #parents and falls back to
// the generic mock page, same as it always did (no dedicated logic ever
// existed for it).
//
// Compose access mirrors AnnouncementsService.assertCanTargetAudience
// server-side: PROPRIETOR/PRINCIPAL can target anyone, TEACHER only their
// own class arms, PARENT/STUDENT can't send at all — for them this page is
// a real inbox (everything the school has sent them), not a fake compose form.
(function () {
  let currentRole = 'proprietor';
  let recipientDirectory = [];

  function canCompose() {
    return currentRole === 'proprietor' || currentRole === 'principal' || currentRole === 'teacher';
  }
  function roleLabel(role) {
    return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  function audienceLabel(a) {
    switch (a.audience) {
      case 'SCHOOL': return 'Everyone in the school';
      case 'CAMPUS': return 'A campus';
      case 'ARM': case 'CLASS': return 'A class';
      case 'PARENT_GROUP': return 'Parents of a class';
      case 'INDIVIDUAL': return 'One person';
      default: return a.audience;
    }
  }
  /** Resolves a real name/class label for a past announcement when it's
   * still in this session's recipientDirectory cache; falls back to a
   * generic-but-honest audience-type label otherwise (e.g. right after a
   * fresh page load, before the directory has been fetched). */
  function resolveTargetLabel(a) {
    const match = recipientDirectory.find(
      (r) => r.audience === a.audience && (r.audienceRefId || null) === (a.audienceRefId || null),
    );
    return match ? match.label : audienceLabel(a);
  }

  async function loadRecipientDirectory() {
    if (currentRole === 'teacher') {
      try {
        const arms = await window.SchoolOS.api('/portal/teacher/class-arms');
        recipientDirectory = arms.map((a) => ({
          label: `My class · ${a.schoolClassName} ${a.armName}`, audience: 'ARM', audienceRefId: a.id,
        }));
      } catch { recipientDirectory = []; }
      return;
    }
    if (currentRole !== 'proprietor' && currentRole !== 'principal') { recipientDirectory = []; return; }
    try {
      const [classes, campuses, users] = await Promise.all([
        window.SchoolOS.api('/classes'), window.SchoolOS.api('/campuses'), window.SchoolOS.api('/users'),
      ]);
      const arms = classes.flatMap((c) => (c.arms || []).map((a) => ({ id: a.id, label: `${c.name} · ${a.name}` })));
      const me = window.SchoolOS.getUser();
      recipientDirectory = [
        { label: 'Everyone in the school', audience: 'SCHOOL', audienceRefId: undefined },
        ...campuses.map((c) => ({ label: `Campus · ${c.name}`, audience: 'CAMPUS', audienceRefId: c.id })),
        ...arms.map((a) => ({ label: `Class · ${a.label}`, audience: 'ARM', audienceRefId: a.id })),
        ...arms.map((a) => ({ label: `Parents only · ${a.label}`, audience: 'PARENT_GROUP', audienceRefId: a.id })),
        ...users
          .filter((u) => u.id !== me.id)
          .map((u) => ({ label: `${u.firstName} ${u.lastName} (${roleLabel(u.role)})`, audience: 'INDIVIDUAL', audienceRefId: u.id })),
      ];
    } catch { recipientDirectory = []; }
  }

  async function openComposeModal() {
    if (!canCompose()) { window.SchoolOS.toast('Only staff can send messages — you’ll see anything the school sends you here.'); return; }
    if (!recipientDirectory.length) await loadRecipientDirectory();
    if (!recipientDirectory.length) { window.SchoolOS.toast('No recipients available to message yet'); return; }
    const byLabel = Object.fromEntries(recipientDirectory.map((r) => [r.label, r]));
    window.SchoolOS.formModal({
      eyebrow: 'Messages', title: 'New message', sub: 'Sends a real announcement via the SchoolOS API — POST /communication/announcements.',
      fields: [
        { name: 'to', label: 'Send to', type: 'select', options: Object.keys(byLabel) },
        { name: 'title', label: 'Subject', placeholder: 'e.g. Third-term update' },
        { name: 'body', label: 'Message', type: 'textarea', placeholder: 'Type your message' },
      ],
      submitLabel: 'Send message',
      onSubmit: async (d) => {
        const target = byLabel[d.to];
        const title = (d.title || '').trim(), body = (d.body || '').trim();
        if (!target || !title || !body) { window.SchoolOS.toast('Recipient, subject and message are required'); return; }
        try {
          const result = await window.SchoolOS.api('/communication/announcements', {
            method: 'POST',
            body: JSON.stringify({ audience: target.audience, audienceRefId: target.audienceRefId, title, body }),
          });
          window.SchoolOS.closeModal();
          window.SchoolOS.toast(`Sent to ${result.recipientCount} ${result.recipientCount === 1 ? 'person' : 'people'} · ${target.label}`);
          loadRealSentMessages();
        } catch (err) { window.SchoolOS.toast(`Could not send message (${err.message})`); }
      },
    });
  }

  function pageMessagesCompose(label) {
    return `<section class="page workspace-page visible" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Communication</p><h1>${label}</h1><p class="subtitle">${currentRole === 'teacher' ? 'Message your class — students and their parents.' : 'Message anyone in your school, a whole class, or a broadcast group.'}</p></div><button class="new-button" id="composeBtn">+ Compose message</button></div><section class="data-card"><table class="data-table"><thead><tr><th>Message</th><th>Sent to</th><th>When</th><th></th></tr></thead><tbody id="realMessagesBody"><tr><td colspan="4">Loading…</td></tr></tbody></table></section></section>`;
  }
  async function loadRealSentMessages() {
    const tbody = document.getElementById('realMessagesBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';
    try {
      const all = await window.SchoolOS.api('/communication/announcements');
      const me = window.SchoolOS.getUser();
      sentMessagesCache = all
        .filter((a) => a.createdByUserId === me.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      tbody.innerHTML = sentMessagesCache.length
        ? sentMessagesCache.map((a) => `<tr><td><strong>${a.title}</strong><br><small>${a.body}</small></td><td>${resolveTargetLabel(a)}</td><td>${new Date(a.createdAt).toLocaleString()}</td><td class="row-action"><button class="outline-button" data-view-recipients="${a.id}">Who saw this?</button></td></tr>`).join('')
        : '<tr><td colspan="4">You haven’t sent any messages yet.</td></tr>';
    } catch (err) { tbody.innerHTML = `<tr><td colspan="4">Could not load messages (${err.message})</td></tr>`; }
  }

  /** Per-recipient read status — backed by GET
   * /communication/announcements/:id/recipients, which reads back the
   * Notification rows notify() already wrote per recipient (readAt and
   * all) rather than anything invented for this view. */
  let sentMessagesCache = [];
  async function openRecipientsModal(announcementId) {
    const msg = sentMessagesCache.find((a) => a.id === announcementId);
    window.SchoolOS.openModal(`<p class="eyebrow">Messages</p><h2>Who saw this</h2>${msg ? `<p class="modal-sub">${msg.title}</p>` : ''}<div id="recipientsBody"><p class="modal-sub">Loading…</p></div><div class="form-actions"><button type="button" class="outline-button" data-modal-close>Close</button></div>`);
    const body = document.getElementById('recipientsBody');
    try {
      const data = await window.SchoolOS.api('/communication/announcements/' + announcementId + '/recipients');
      const rows = data.recipients.map((r) => `<tr><td>${r.firstName} ${r.lastName}</td><td>${roleLabel(r.role)}</td><td>${r.readAt ? `<span class="status">Read · ${new Date(r.readAt).toLocaleString()}</span>` : '<span class="status pending">Unread</span>'}</td></tr>`).join('');
      body.innerHTML = `<p class="modal-sub">${data.readCount} of ${data.totalRecipients} have read this${data.totalRecipients ? '' : ' — no one was eligible to receive it'}.</p>${data.totalRecipients ? `<table class="data-table"><thead><tr><th>Recipient</th><th>Role</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>` : ''}`;
    } catch (err) { body.innerHTML = `<p class="modal-sub">Could not load (${err.message})</p>`; }
  }

  function pageMessagesInbox(label) {
    return `<section class="page workspace-page visible" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Communication</p><h1>${label}</h1><p class="subtitle">Everything the school has sent you — announcements, results, assignments and more.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Message</th><th>When</th><th></th></tr></thead><tbody id="realMessagesInboxBody"><tr><td colspan="3">Loading…</td></tr></tbody></table></section></section>`;
  }
  async function loadRealInbox() {
    const tbody = document.getElementById('realMessagesInboxBody');
    if (!tbody || !window.SchoolOS.getAccessToken()) return;
    tbody.innerHTML = '<tr><td colspan="3">Loading…</td></tr>';
    try {
      const notices = await window.SchoolOS.api('/notifications/me');
      tbody.innerHTML = notices.length
        ? notices.map((n) => `<tr class="${n.readAt ? '' : 'row-flagged'}"><td><strong>${n.title}</strong><br><small>${n.body}</small></td><td>${new Date(n.createdAt).toLocaleString()}</td><td class="row-action">${n.readAt ? '<span class="status">Read</span>' : `<button class="outline-button" data-mark-read="${n.id}">Mark read</button>`}</td></tr>`).join('')
        : '<tr><td colspan="3">Nothing here yet.</td></tr>';
    } catch (err) { tbody.innerHTML = `<tr><td colspan="3">Could not load your messages (${err.message})</td></tr>`; }
  }
  async function markNotificationRead(id) {
    try {
      await window.SchoolOS.api('/notifications/' + id + '/read', { method: 'PATCH' });
      loadRealInbox();
    } catch (err) { window.SchoolOS.toast(`Could not mark as read (${err.message})`); }
  }

  function pageMessages(label) { return canCompose() ? pageMessagesCompose(label) : pageMessagesInbox(label); }

  function render() {
    const container = document.getElementById('messagesSection');
    if (location.hash === '#parents') { container.innerHTML = window.SchoolOS.renderGenericPage('Parents'); return; }
    const label = currentRole === 'principal' ? 'Communication' : 'Messages';
    container.innerHTML = pageMessages(label);
    const btn = document.getElementById('composeBtn'); if (btn) btn.addEventListener('click', openComposeModal);
    window.SchoolOS.onCreateNew = openComposeModal;
    loadRecipientDirectory().then(loadRealSentMessages);
    loadRealInbox();
  }

  document.addEventListener('click', (e) => {
    const mr = e.target.closest('[data-mark-read]'); if (mr) markNotificationRead(mr.dataset.markRead);
    const vr = e.target.closest('[data-view-recipients]'); if (vr) openRecipientsModal(vr.dataset.viewRecipients);
  });

  window.SchoolOS.ready.then((role) => {
    if (!role) return;
    currentRole = role;
    window.SchoolOS.onRoleChange = (r) => { currentRole = r; render(); };
    render();
  });
})();
