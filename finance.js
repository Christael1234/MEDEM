// Finance module — no dedicated backend or mock logic in the original app
// either; this was always the generic mock page keyed off the "Finance"
// label. Nothing to port beyond the route.
(function () {
  function render() {
    document.getElementById('financeSection').innerHTML = window.SchoolOS.renderGenericPage('Finance');
  }
  window.SchoolOS.ready.then((role) => {
    if (!role) return;
    window.SchoolOS.onRoleChange = render;
    render();
  });
})();
