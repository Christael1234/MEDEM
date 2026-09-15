// Library & operations module. Library has real interactive mock CRUD
// (operations-role staff view + a view-only oversight view for other
// roles); Transport Routes/Vehicles & Drivers/Student Manifest/Incidents
// (operations role only) land here via #hash and fall back to the
// generic mock page, same as they always did.
(function () {
  let currentRole = 'operations';

  const libraryItems = [
    { id: 1, title: 'Things Fall Apart', author: 'Chinua Achebe', isbn: '978-0385474542', category: 'Literature', total: 8, available: 5, shelf: 'A-12' },
    { id: 2, title: 'New General Mathematics JSS 2', author: 'M.F. Macrae', isbn: '978-9780177450', category: 'Textbook', total: 40, available: 6, shelf: 'B-04' },
    { id: 3, title: 'Basic Science for Junior Secondary', author: 'STAN', isbn: '978-9782000123', category: 'Textbook', total: 35, available: 2, shelf: 'B-09' },
    { id: 4, title: 'Half of a Yellow Sun', author: 'Chimamanda Ngozi Adichie', isbn: '978-0007200283', category: 'Literature', total: 6, available: 0, shelf: 'A-15' },
    { id: 5, title: 'Atlas of the World', author: 'National Geographic', isbn: '978-1426217129', category: 'Reference', total: 3, available: 3, shelf: 'C-02' },
  ];
  let librarySeq = 6;
  const libraryLoans = [
    { id: 1, item: 'New General Mathematics JSS 2', borrower: 'Tunde Bello', borrowerType: 'Student · JSS 2A', issued: '10 Aug', due: '24 Aug', returned: null, status: 'Overdue' },
    { id: 2, item: 'Basic Science for Junior Secondary', borrower: 'Chidinma Eze', borrowerType: 'Student · JSS 2A', issued: '18 Aug', due: '1 Sep', returned: null, status: 'Active' },
    { id: 3, item: 'Half of a Yellow Sun', borrower: 'Mrs. Dada', borrowerType: 'Staff · Teacher', issued: '2 Aug', due: '16 Aug', returned: null, status: 'Overdue' },
    { id: 4, item: 'Things Fall Apart', borrower: 'Fatima Ibrahim', borrowerType: 'Student · JSS 2A', issued: '20 Aug', due: '3 Sep', returned: null, status: 'Active' },
    { id: 5, item: 'Atlas of the World', borrower: 'David Chukwu', borrowerType: 'Student · JSS 2B', issued: '5 Aug', due: '19 Aug', returned: '20 Aug', status: 'Returned' },
  ];
  let loanSeq = 6;
  function pageLibraryStaff(label) {
    const overdue = libraryLoans.filter((l) => l.status === 'Overdue');
    const lowStock = libraryItems.filter((i) => i.available <= 2);
    const kpis = [['Titles in catalog', String(libraryItems.length), `${libraryItems.reduce((n, i) => n + i.total, 0)} copies total`], ['Copies on loan', String(libraryLoans.filter((l) => l.status !== 'Returned').length), 'Across students & staff'], ['Overdue loans', String(overdue.length), 'Send a reminder from this screen'], ['Low-copy titles', String(lowStock.length), '2 or fewer copies available']];
    const catalogRows = libraryItems.map((i) => `<tr><td><strong>${i.title}</strong></td><td>${i.author}</td><td>${i.isbn}</td><td>${i.category}</td><td>${i.available} / ${i.total}</td><td>${i.shelf}</td></tr>`).join('');
    const loanRows = libraryLoans.map((l) => `<tr class="${l.status === 'Overdue' ? 'row-flagged' : ''}"><td><strong>${l.item}</strong></td><td>${l.borrower}</td><td>${l.borrowerType}</td><td>${l.issued}</td><td>${l.due}</td><td><span class="status ${l.status !== 'Returned' ? 'pending' : ''}">${l.status}</span></td><td class="row-action">${l.status !== 'Returned' ? `<button class="outline-button" data-checkin-loan="${l.id}">Check in</button>` : '—'}</td></tr>`).join('');
    const overdueRows = overdue.map((l) => `<tr><td><strong>${l.item}</strong></td><td>${l.borrower}</td><td>${l.due}</td><td class="row-action"><button class="outline-button" data-send-reminder="${l.id}">Send reminder</button></td></tr>`).join('') || '<tr><td colspan="4">No overdue loans right now.</td></tr>';
    return `<section class="page workspace-page visible" id="library"><div class="page-heading"><div><p class="eyebrow">Library</p><h1>${label}</h1><p class="subtitle">Catalog, check-outs and overdue tracking for your campus.</p></div><div class="row-actions"><button class="outline-button" id="checkOutBtn">Check out</button><button class="new-button" id="newLibraryItemBtn">+ New item</button></div></div><div class="screen-kpis">${kpis.map((s, i) => `<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small class="${i === 2 ? 'warn' : ''}">${s[2]}</small></article>`).join('')}</div><div class="screen-tabs" data-tabs><button class="active" data-tab="catalog">Catalog</button><button data-tab="loans">Check-out / check-in</button><button data-tab="overdue">Overdue &amp; alerts</button></div><div data-tab-panel="catalog" class="tab-panel visible"><section class="data-card"><table class="data-table"><thead><tr><th>Title</th><th>Author</th><th>ISBN</th><th>Category</th><th>Available</th><th>Shelf</th></tr></thead><tbody>${catalogRows}</tbody></table></section></div><div data-tab-panel="loans" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Item</th><th>Borrower</th><th>Type</th><th>Issued</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody>${loanRows}</tbody></table></section></div><div data-tab-panel="overdue" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Item</th><th>Borrower</th><th>Due date</th><th></th></tr></thead><tbody>${overdueRows}</tbody></table></section></div></section>`;
  }
  function pageLibraryOversight(label) {
    const kpis = [['Titles in catalog', String(libraryItems.length), `${libraryItems.reduce((n, i) => n + i.total, 0)} copies total`], ['Copies on loan', String(libraryLoans.filter((l) => l.status !== 'Returned').length), 'Across students & staff'], ['Overdue loans', String(libraryLoans.filter((l) => l.status === 'Overdue').length), 'Flagged for the library team'], ['Low-copy titles', String(libraryItems.filter((i) => i.available <= 2).length), '2 or fewer copies available']];
    const catalogRows = libraryItems.map((i) => `<tr><td><strong>${i.title}</strong></td><td>${i.author}</td><td>${i.category}</td><td>${i.available} / ${i.total}</td><td>${i.shelf}</td></tr>`).join('');
    const loanRows = libraryLoans.map((l) => `<tr class="${l.status === 'Overdue' ? 'row-flagged' : ''}"><td><strong>${l.item}</strong></td><td>${l.borrower}</td><td>${l.borrowerType}</td><td>${l.due}</td><td><span class="status ${l.status !== 'Returned' ? 'pending' : ''}">${l.status}</span></td></tr>`).join('');
    return `<section class="page workspace-page visible" id="library"><div class="page-heading"><div><p class="eyebrow">Library</p><h1>${label}</h1><p class="subtitle">Catalog and loan activity across the campus, view only.</p></div><span class="view-only-badge">View only</span></div><div class="screen-kpis">${kpis.map((s) => `<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('')}</div><div class="screen-tabs" data-tabs><button class="active" data-tab="catalog">Catalog</button><button data-tab="loans">Loans</button></div><div data-tab-panel="catalog" class="tab-panel visible"><section class="data-card"><table class="data-table"><thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Available</th><th>Shelf</th></tr></thead><tbody>${catalogRows}</tbody></table></section></div><div data-tab-panel="loans" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Item</th><th>Borrower</th><th>Type</th><th>Due</th><th>Status</th></tr></thead><tbody>${loanRows}</tbody></table></section></div></section>`;
  }
  function pageLibrary(label, role) { return role === 'operations' ? pageLibraryStaff(label) : pageLibraryOversight(label); }
  function openNewLibraryItemModal() {
    window.SchoolOS.formModal({
      eyebrow: 'Library', title: 'New catalog item', sub: 'Add a new title to the campus library.',
      fields: [{ name: 'title', label: 'Title', placeholder: 'e.g. Fluid Mechanics' }, { name: 'author', label: 'Author', placeholder: 'e.g. J. Smith' }, { name: 'isbn', label: 'ISBN', placeholder: '978-...' }, { name: 'category', label: 'Category', type: 'select', options: ['Textbook', 'Literature', 'Reference', 'Periodical', 'Other'] }, { name: 'total', label: 'Total copies', type: 'number', placeholder: '5' }, { name: 'shelf', label: 'Shelf location', placeholder: 'e.g. B-07' }],
      submitLabel: 'Add to catalog',
      onSubmit: (d) => { const total = Number(d.total) || 1; libraryItems.push({ id: librarySeq++, title: d.title || 'Untitled title', author: d.author || 'Unknown', isbn: d.isbn || '—', category: d.category, total, available: total, shelf: d.shelf || '—' }); render(); window.SchoolOS.toast(`Added to catalog · ${d.title || 'Untitled title'}`); },
    });
  }
  function openCheckOutModal() {
    const available = libraryItems.filter((i) => i.available > 0);
    window.SchoolOS.formModal({
      eyebrow: 'Library', title: 'Check out an item', sub: 'Issue a book to a student or staff member.',
      fields: [{ name: 'item', label: 'Item', type: 'select', options: available.map((i) => i.title) }, { name: 'borrower', label: 'Borrower name', placeholder: 'e.g. Tunde Bello' }, { name: 'borrowerType', label: 'Borrower type', type: 'select', options: ['Student · JSS 2A', 'Student · JSS 2B', 'Student · SS 1A', 'Staff · Teacher', 'Staff · Admin'] }, { name: 'due', label: 'Due date', type: 'date' }],
      submitLabel: 'Check out',
      onSubmit: (d) => { const item = libraryItems.find((i) => i.title === d.item); if (item && item.available > 0) item.available--; libraryLoans.unshift({ id: loanSeq++, item: d.item, borrower: d.borrower || 'Unnamed borrower', borrowerType: d.borrowerType, issued: 'Today', due: d.due || 'TBC', returned: null, status: 'Active' }); render(); window.SchoolOS.toast(`Checked out · ${d.item} → ${d.borrower || 'Unnamed borrower'}`); },
    });
  }
  function checkInLoan(id) {
    const l = libraryLoans.find((x) => x.id === Number(id)); if (!l) return;
    l.status = 'Returned'; l.returned = 'Today';
    const item = libraryItems.find((i) => i.title === l.item); if (item) item.available = Math.min(item.total, item.available + 1);
    render(); window.SchoolOS.toast(`Checked in · ${l.item}`);
  }
  function sendOverdueReminder(id) {
    const l = libraryLoans.find((x) => x.id === Number(id)); if (!l) return;
    window.SchoolOS.toast(`Reminder sent to ${l.borrower} · ${l.item} is overdue`);
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

  const GENERIC_LABELS = { 'transport-routes': 'Transport Routes', 'vehicles-and-drivers': 'Vehicles & Drivers', 'student-manifest': 'Student Manifest', incidents: 'Incidents' };

  function render() {
    const container = document.getElementById('operationsSection');
    const hash = location.hash.slice(1);
    if (GENERIC_LABELS[hash]) { container.innerHTML = window.SchoolOS.renderGenericPage(GENERIC_LABELS[hash]); return; }
    container.innerHTML = pageLibrary('Library', currentRole);
    bindTabs();
    const newBtn = document.getElementById('newLibraryItemBtn'); if (newBtn) newBtn.addEventListener('click', openNewLibraryItemModal);
    const coBtn = document.getElementById('checkOutBtn'); if (coBtn) coBtn.addEventListener('click', openCheckOutModal);
  }

  document.addEventListener('click', (e) => {
    const cil = e.target.closest('[data-checkin-loan]'); if (cil) checkInLoan(cil.dataset.checkinLoan);
    const sr = e.target.closest('[data-send-reminder]'); if (sr) sendOverdueReminder(sr.dataset.sendReminder);
  });

  window.SchoolOS.ready.then((role) => {
    if (!role) return;
    currentRole = role;
    window.SchoolOS.onRoleChange = (r) => { currentRole = r; render(); };
    window.SchoolOS.onCreateNew = () => { if (currentRole === 'operations') openNewLibraryItemModal(); else window.SchoolOS.toast('Open a workspace page to create a matching record'); };
    render();
  });
})();
