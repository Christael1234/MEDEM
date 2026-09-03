// Messages / Communication module. "Parents" (principal's view-only staff
// nav item) lands here too via #parents and falls back to the generic
// mock page, same as it always did (no dedicated logic ever existed for it).
(function () {
  const messageDirectory = ['Adetola Okon (Proprietor)', 'Bolanle Adeyemi (Principal)', 'Chinwe Okafor (Bursar)', 'Miriam Danladi (HR)', 'Mrs. Dada (Teacher)', 'Mr. James (Teacher)', 'Alhaji Ibrahim (Parent)', 'Mrs. Nwosu (Parent)', 'Nneka Okon (Parent)', 'Ada Okon (Student)'];
  const sentMessages = [
    { to: 'All JSS 2A parents', subject: 'Third-term open day', date: '25 Aug', preview: 'Reminder: open day is this Saturday at 10am in the main hall.' },
    { to: 'Nneka Okon (Parent)', subject: 'Fee balance reminder', date: '24 Aug', preview: 'Kindly note ₦45,000 is outstanding for Emeka this term.' },
  ];
  function openComposeModal() {
    window.SchoolOS.formModal({
      eyebrow: 'Messages', title: 'New message',
      fields: [{ name: 'to', label: 'Send to', type: 'select', options: messageDirectory }, { name: 'subject', label: 'Subject', placeholder: 'e.g. Third-term update' }, { name: 'body', label: 'Message', type: 'textarea', placeholder: 'Type your message' }],
      submitLabel: 'Send message',
      onSubmit: (d) => { sentMessages.unshift({ to: d.to, subject: d.subject || '(no subject)', date: 'Today', preview: (d.body || '').slice(0, 90) }); render(); window.SchoolOS.toast(`Message sent · ${d.to}`); },
    });
  }
  function pageMessages(label) {
    const kpis = [['Sent this term', String(sentMessages.length), 'Across all channels'], ['Delivery rate', '98.7%', 'SMS, email and in-app'], ['Unread replies', '3', 'Awaiting your response'], ['Scheduled', '1', 'Next notice queued']];
    const rows = sentMessages.map((m) => `<tr><td><strong>${m.subject}</strong></td><td>${m.to}</td><td>${m.date}</td><td>${m.preview}</td></tr>`).join('') || '<tr><td colspan="4">No messages sent yet</td></tr>';
    return `<section class="page workspace-page visible" id="${window.SchoolOS.slug(label)}"><div class="page-heading"><div><p class="eyebrow">Communication</p><h1>${label}</h1><p class="subtitle">Message any parent, teacher or staff member directly.</p></div><button class="new-button" id="composeBtn">+ Compose message</button></div><div class="screen-kpis">${kpis.map((s) => `<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('')}</div><section class="data-card"><table class="data-table"><thead><tr><th>Subject</th><th>To</th><th>Date</th><th>Preview</th></tr></thead><tbody>${rows}</tbody></table></section></section>`;
  }

  function render() {
    const container = document.getElementById('messagesSection');
    if (location.hash === '#parents') { container.innerHTML = window.SchoolOS.renderGenericPage('Parents'); return; }
    container.innerHTML = pageMessages('Messages');
    const btn = document.getElementById('composeBtn'); if (btn) btn.addEventListener('click', openComposeModal);
  }

  window.SchoolOS.ready.then((role) => {
    if (!role) return;
    window.SchoolOS.onRoleChange = render;
    window.SchoolOS.onCreateNew = openComposeModal;
    render();
  });
})();
