// Platform module, Super Admin's entire nav. None of these ever had
// dedicated logic in the original app (platform-level tenant management
// is out of scope for this build pass per CLAUDE.md); every item is the
// generic mock page, routed by #hash.
(function () {
  const LABELS = {
    schools: 'Schools', subscriptions: 'Subscriptions', users: 'Users', support: 'Support',
    'system-health': 'System Health', integrations: 'Integrations', 'audit-logs': 'Audit Logs', 'feature-flags': 'Feature Flags',
  };
  function render() {
    const hash = location.hash.slice(1);
    const label = LABELS[hash] || 'Schools';
    document.getElementById('platformSection').innerHTML = window.SchoolOS.renderGenericPage(label);
  }
  window.SchoolOS.ready.then((role) => {
    if (!role) return;
    window.SchoolOS.onRoleChange = render;
    render();
  });
})();
