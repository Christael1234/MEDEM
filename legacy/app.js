const select=document.getElementById('roleSelect'),dashboard=document.getElementById('dashboard'),workspacePages=document.getElementById('workspacePages'),nav=document.getElementById('mainNav');
const roles={proprietor:{name:'Adetola',title:'Proprietor / Owner',symbol:'♔',brief:'Own the whole school, without chasing updates.',text:'Finance, people and academic exceptions are in one decision queue.',action:'Export management report'},principal:{name:'Bolanle',title:'Principal',symbol:'◈',brief:'Keep teaching, learning and standards on track.',text:'Focus on attendance, result approvals, staff coverage and learning exceptions.',action:'Review results'},bursar:{name:'Chinwe',title:'Bursar / Accountant',symbol:'₦',brief:'Keep every naira visible and reconciled.',text:'Work from invoices through payments to exceptions without losing the audit trail.',action:'Start reconciliation'},hr:{name:'Miriam',title:'HR / Administrator',symbol:'♙',brief:'Give staff a reliable, well-run place to work.',text:'Manage documents, leave, attendance and payroll preparation in one staff record.',action:'Review leave requests'},teacher:{name:'Tunde',title:'Teacher',symbol:'✎',brief:'Everything you need for the classes you teach.',text:'Take attendance, enter marks and keep families informed.',action:'Take JSS 2A attendance'},parent:{name:'Nneka',title:'Parent / Guardian',symbol:'♥',brief:'Stay close to your children’s school life.',text:'See fees, receipts, attendance, results and notices in one calm place.',action:'Pay outstanding balance'},student:{name:'Ada',title:'Student',symbol:'★',brief:'Know what’s next and keep up with your work.',text:'Your timetable, assignments, CBT exams and published results are easy to find.',action:'View today’s timetable'},operations:{name:'Kabiru',title:'Transport / Library staff',symbol:'⌘',brief:'Run the service your school relies on.',text:'Access your assigned operational module with clear daily actions.',action:'Open transport register'},superadmin:{name:'Femi',title:'Super Admin',symbol:'⚙',brief:'Keep the SchoolOS platform healthy and trusted.',text:'Manage tenants, subscriptions, support and audit monitoring.',action:'Review platform alerts'},compliance:{name:'Yewande',title:'Compliance Administrator',symbol:'⚖',brief:'Keep statutory payroll rules current and compliant.',text:'Maintain versioned PAYE, pension and NHF rules, and run the compliance review before every payroll release.',action:'Run compliance review'}};
const rolePermissions={
  proprietor:{chips:['Full control, every campus','Approve payroll & refunds','Manage settings, branding & templates'],restricted:[]},
  principal:{chips:['Approve & publish results','Manage academics, staff, attendance','View fee status, finance, payroll, library'],restricted:['Cannot edit fees or run payroll','Fee revenue figures hidden','Cannot edit branding or templates']},
  bursar:{chips:['Full fees, payments & finance','Prepare payroll'],restricted:['Cannot approve payroll','View-only on students, HR']},
  hr:{chips:['Full HR & workforce','Prepare payroll inputs'],restricted:['No fee or finance access','Cannot approve payroll']},
  teacher:{chips:['Assigned classes & subjects only','Lessons, resources, assignments & grading','Attendance & marks'],restricted:['Cannot approve or publish results']},
  parent:{chips:['Own linked children only','Pay fees, view lessons, results & attendance'],restricted:['No staff, finance or other families’ data']},
  student:{chips:['Own records only','View lessons & resources','Submit assignments, CBT exams'],restricted:['No communication or admin functions']},
  operations:{chips:['Assigned module only','Full library within your campus'],restricted:['Nothing outside the assignment is visible']},
  superadmin:{chips:['Manage tenants, plans & billing','Platform monitoring & support'],restricted:['No school records without logged, time-boxed access']},
  compliance:{chips:['Manage statutory rule versions','Run compliance review'],restricted:['Cannot prepare, approve or finalise payroll']}
};
const navs={proprietor:['Dashboard','Schools / Campuses','Admissions','Students','Teachers','Academics','Content Approvals','Attendance','Fees & payments','Finance','People & payroll','Messages','Library','Reports','Settings'],principal:['Dashboard','Admissions','Students','Academics','Lessons','Content Approvals','Attendance','Teachers','Timetable','Exams & Results','Fees','Finance','Payroll','Parents','Communication','Library','Reports','Settings'],bursar:['Dashboard','Admissions','Students','Fees','Invoices','Payments','Arrears','Reconciliation','Expenses','Payroll','Reports'],hr:['Dashboard','Admissions','Students','Employees','Attendance','Leave','Documents','Performance','Recruitment','Payroll','Reports'],teacher:['Dashboard','My Classes','Lessons','Attendance','Results','Timetable','Assignments','CBT Exams','Messages','My Profile'],parent:['Home','My Children','Lessons','Apply for admission','Fees','Results','Attendance','Timetable','Messages','More'],student:['Home','Classes','Lessons','Timetable','Assignments','CBT Exams','Results','Attendance','Notices','Profile'],operations:['Dashboard','Transport Routes','Vehicles & Drivers','Student Manifest','Incidents','Library','Reports'],superadmin:['Platform Dashboard','Schools','Subscriptions','Users','Support','System Health','Integrations','Audit Logs','Feature Flags','Settings'],compliance:['Dashboard','Statutory Rules','Compliance Review','Payroll Audit Trail','Reports']};
const icons=['⌂','◉','▤','✓','₦','▥','♙','✦','◫','⚙','⌘'],slug=v=>v.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),typeFor=v=>/fee|invoice|payment|arrear|reconciliation|finance|expense|subscription|payroll/i.test(v)?'money':/student|child|class|academic|result|exam|assignment|timetable|attendance/i.test(v)?'learning':/report|dashboard|health|performance|audit|intelligence|ai/i.test(v)?'insights':/message|communication|parent|support/i.test(v)?'messages':'people';
const configs={money:{eyebrow:'Financial operations',action:'+ Create record',stats:[['Collected this term','₦184.6m','↑ 6.8% vs last term'],['Outstanding','₦21.3m','38 families need follow-up'],['Reconciled today','₦4.8m','96% matched automatically'],['Due this week','₦12.6m','14 invoices approaching due date']],cols:['Record','Family / account','Amount','Status'],rows:[['Term fee · INV-1092','Adeyemi Family','₦285,000','Paid'],['Transport fee · INV-1148','Chukwu Family','₦180,000','Pending'],['Exam levy · INV-1173','Adebayo Family','₦45,000','Overdue']],queue:'Reconciliation queue',tasks:['17 bank transfers need a reference','3 payments need confirmation','August receipt batch is ready']},learning:{eyebrow:'Academic operations',action:'+ Add record',stats:[['Learners active','2,486','↑ 4.1% this term'],['Attendance today','94.6%','132 learners absent'],['Open tasks','12','Marks and registers awaiting action'],['Classes live','68','Across 3 campuses']],cols:['Learner / class','Context','Progress','Status'],rows:[['JSS 2A Mathematics','Mrs. Dada · 31 learners','24 / 31 marked','In progress'],['Ada Okon','SS 1A · Ikoyi campus','96% attendance','On track'],['JSS 3 English','Mr. James · 28 learners','28 / 28 marked','Complete']],queue:'Today’s teaching queue',tasks:['JSS 2 Mathematics marks are incomplete','7 guardians need an attendance update','Third-term timetable was revised']},people:{eyebrow:'People operations',action:'+ Add person',stats:[['People active','214','207 present today'],['Awaiting approval','6','Leave and document changes'],['Documents due','8','Renewals within 30 days'],['Open requests','11','Assigned to your team']],cols:['Person / request','Role or context','Last activity','Status'],rows:[['Amina Yusuf','Mathematics teacher · Ikoyi','Checked in at 07:42','Active'],['Tunde Bello','Class teacher · JSS 2A','Leave request · 2 days','Pending'],['Mrs. Nwosu','Parent / guardian','Message received today','Active']],queue:'People to review',tasks:['Two teacher leave requests need approval','8 credentials expire this month','Parent meeting confirmations are due']},messages:{eyebrow:'Communication centre',action:'+ Compose message',stats:[['Unread conversations','18','7 need a reply today'],['Delivery rate','98.7%','Across SMS, email and app'],['Scheduled','4','Next notice at 16:00'],['Contacts reached','2,106','This term']],cols:['Conversation','Audience','Last message','Status'],rows:[['Termly open day','All SS parents','Reminder sent · 09:10','Delivered'],['Transport route 3','18 guardians','Route change notice','Read'],['JSS 2A update','31 families','Homework follow-up','Pending']],queue:'Send next',tasks:['Open day reminder is scheduled for 16:00','12 parents have not read the fee notice','Draft your weekly staff update']},insights:{eyebrow:'Decision support',action:'Export report',stats:[['Reporting period','Third term','2025 / 2026 session'],['Healthy indicators','8 / 10','Two items need attention'],['Data freshness','2 min','Last data sync'],['Saved views','6','Shared with your team']],cols:['Insight / report','Scope','Last updated','Status'],rows:[['Fee collection by campus','All campuses','Today, 08:30','Ready'],['Attendance trend','JSS & SSS','Today, 07:50','Ready'],['Staff compliance','People team','Yesterday, 18:10','Review']],queue:'Signals to investigate',tasks:['Lekki transport collections are below plan','JSS 2 Mathematics needs a result review','Staff document compliance changed today']}};
function pageMarkup(label){const c=configs[typeFor(label)],id=slug(label),initials=['AO','TB','MY'];const hideRevenue=revenueRestrictedRoles.has(activeRole)&&/finance/i.test(label);const stats=hideRevenue?c.stats.map(s=>['Collected this term','Outstanding','Reconciled today','Due this week'].includes(s[0])?[s[0],'Restricted','Ask the bursar for revenue figures']:s):c.stats;const rows=hideRevenue?c.rows.map(r=>[r[0],r[1],'Restricted',r[3]]):c.rows;return `<section class="page workspace-page" id="${id}"><div class="page-heading"><div><p class="eyebrow">${c.eyebrow}</p><h1>${label}</h1><p class="subtitle">Everything you need to manage ${label.toLowerCase()}, with the next action always visible.</p></div><button class="new-button" data-toast="${c.action.replace('+ ','')} started">${c.action}</button></div><div class="screen-tabs"><button class="active">Overview</button><button>Active</button><button>Needs attention</button><button>History</button></div><div class="screen-kpis">${stats.map((s,i)=>`<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small class="${i===1?'warn':''}">${s[2]}</small></article>`).join('')}</div><div class="workspace-grid-main"><section class="data-card"><div class="data-toolbar"><input aria-label="Search ${label}" placeholder="Search ${label.toLowerCase()}"><button class="filter-button">Filter ⌄</button><button class="filter-button">View: all ⌄</button></div><table class="data-table"><thead><tr>${c.cols.map(x=>`<th>${x}</th>`).join('')}<th></th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td><div class="person-cell"><span class="mini-avatar">${initials[i]}</span>${r[0]}</div></td><td>${r[1]}</td><td>${r[2]}</td><td><span class="status ${r[3]==='Pending'||r[3]==='Overdue'?'pending':''}">${r[3]}</span></td><td class="row-action">→</td></tr>`).join('')}</tbody></table><div class="empty-state"><span class="mini-avatar">+</span><h3>Keep this workspace moving</h3><p>Create a record, update a status, or use the filters to find what needs your attention.</p><button class="outline-button" data-toast="New ${label} record opened">${c.action}</button></div></section><aside class="workspace-aside"><section class="side-card"><p class="eyebrow">Priority queue</p><h3>${c.queue}</h3><div class="queue-list">${c.tasks.map(x=>`<div class="queue-item"><i class="queue-dot"></i><div><strong>${x}</strong><span>Assigned to your team</span></div><b>→</b></div>`).join('')}</div></section><section class="insight-strip"><p class="eyebrow">SchoolOS signal</p><h3>One clear next step</h3><p>Focus here first to keep this part of the school running smoothly.</p><a href="#dashboard" data-view="dashboard">Open decision centre →</a></section></aside></div></section>`}
const initialsOf=n=>n.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
function money(n){return '₦'+n.toString().replace(/\B(?=(\d{3})+(?!\d))/g,',')}

const schoolCampuses=[
  {name:'Ikoyi Campus',address:'12 Bourdillon Road, Ikoyi',students:842,staff:78,principal:'Bolanle Adeyemi'},
  {name:'Lekki Campus',address:'Freedom Way, Lekki Phase 1',students:615,staff:61,principal:'Ngozi Umeh'},
  {name:'Yaba Campus',address:'Herbert Macaulay Way, Yaba',students:391,staff:44,principal:'Chuka Obi'}
];
function openNewSchoolModal(){
  formModal({eyebrow:'Schools & campuses',title:'Add school / campus',
    fields:[{name:'name',label:'Campus name',placeholder:'e.g. Ajah Campus'},{name:'address',label:'Address',placeholder:'Street, area'},{name:'principal',label:'Campus principal',placeholder:'e.g. Mrs. Adeyemi'}],
    submitLabel:'Add campus',
    onSubmit:d=>{schoolCampuses.push({name:d.name||'New campus',address:d.address||'—',students:0,staff:0,principal:d.principal||'Unassigned'});refresh();toast(`Campus added · ${d.name||'New campus'}`)}
  });
}
function pageSchools(label){
  const kpis=[['Campuses',String(schoolCampuses.length),'Under Greenfield Schools'],['Total students',String(schoolCampuses.reduce((n,c)=>n+c.students,0)),'Across all campuses'],['Total staff',String(schoolCampuses.reduce((n,c)=>n+c.staff,0)),'Teaching and non-teaching'],['Group session','2025/2026','Third term']];
  const cards=schoolCampuses.map(c=>`<article class="data-card campus-detail-card"><div class="data-toolbar"><div><strong>${c.name}</strong><small>${c.address}</small></div><button class="outline-button" data-toast="Editing ${c.name}">Edit</button></div><div class="child-stats"><div><span>Students</span><strong>${c.students}</strong></div><div><span>Staff</span><strong>${c.staff}</strong></div><div><span>Principal</span><strong>${c.principal}</strong></div></div></article>`).join('');
  return `<section class="page workspace-page" id="${slug(label)}"><div class="page-heading"><div><p class="eyebrow">School group</p><h1>${label}</h1><p class="subtitle">Every campus under Greenfield Schools, in one place.</p></div><button class="new-button" data-modal="new-school">+ Add school</button></div><div class="screen-kpis">${kpis.map(s=>`<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('')}</div><div class="fee-child-grid">${cards}</div></section>`;
}

const admissionsStages=[['submitted','Submitted','Review application'],['review','Under review','Send offer'],['approved','Approved','Generate letter'],['enrolled','Enrolled','View profile']];
const admissionsPipeline=[
  {stage:'submitted',name:'Fatima Ibrahim',cls:'JSS 1',campus:'Ikoyi',date:'21 Aug',docsLabel:'2/4 docs',docsOk:false,dob:'14 Mar 2013',guardian:'Alhaji Ibrahim',phone:'0803 456 7890',address:'22 Alexander Ave, Ikoyi',previousSchool:'Greenwood Prep',notes:'Sibling of a current SS 2 student.'},
  {stage:'submitted',name:'David Chukwu',cls:'SS 1',campus:'Lekki',date:'20 Aug',docsLabel:'4/4 docs',docsOk:true,dob:'2 Jul 2011',guardian:'Mrs. Chukwu',phone:'0806 112 3344',address:'9 Chevron Drive, Lekki',previousSchool:'Corona Secondary School',notes:'Transfer student, third term.'},
  {stage:'review',name:'Grace Adebayo',cls:'JSS 2',campus:'Ikoyi',date:'18 Aug',docsLabel:'4/4 docs',docsOk:true,dob:'30 Sep 2012',guardian:'Mr. Adebayo',phone:'0812 998 2211',address:'5 Awolowo Road, Ikoyi',previousSchool:'Whitesands School',notes:'Requests transport service.'},
  {stage:'review',name:'Emeka Obi',cls:'JSS 1',campus:'Yaba',date:'17 Aug',docsLabel:'3/4 docs',docsOk:false,dob:'19 Jan 2013',guardian:'Mrs. Obi',phone:'0705 667 8899',address:'14 Herbert Macaulay Way, Yaba',previousSchool:'Yaba Model School',notes:'Awaiting birth certificate.'},
  {stage:'approved',name:'Zainab Bello',cls:'SS 2',campus:'Ikoyi',date:'12 Aug',docsLabel:'Offer sent',docsOk:true,dob:'8 Nov 2010',guardian:'Alhaji Bello',phone:'0813 221 4455',address:'3 Bourdillon Road, Ikoyi',previousSchool:'Grange School',notes:'Merit scholarship applicant.'},
  {stage:'approved',name:'Tobi Adeleke',cls:'JSS 3',campus:'Yaba',date:'11 Aug',docsLabel:'Offer sent',docsOk:true,dob:'25 May 2011',guardian:'Mr. Adeleke',phone:'0701 334 5566',address:'8 Commercial Ave, Yaba',previousSchool:'St. Saviour’s School',notes:''},
  {stage:'enrolled',name:'Michael Okoro',cls:'JSS 3',campus:'Lekki',date:'5 Aug',docsLabel:'Enrolled',docsOk:true,dob:'2 Feb 2011',guardian:'Mrs. Okoro',phone:'0802 556 7788',address:'17 Admiralty Way, Lekki',previousSchool:'Chrisland School',notes:''},
  {stage:'enrolled',name:'Amara Nwosu',cls:'JSS 1',campus:'Ikoyi',date:'3 Aug',docsLabel:'Enrolled',docsOk:true,dob:'11 Aug 2013',guardian:'Mr. Nwosu',phone:'0809 887 6655',address:'2 Glover Road, Ikoyi',previousSchool:'Lekki British School',notes:''}
];
function pageAdmissions(label){
  const canAct=activeRole==='proprietor'||activeRole==='principal';
  const kpis=[
    ['Applications this term','186','↑ 22% vs last term'],
    ['Awaiting a decision',String(admissionsPipeline.filter(a=>a.stage==='submitted'||a.stage==='review').length),'Submitted or under review'],
    ['Offers sent','34','9 awaiting a response'],
    ['Conversion to enrolled','78%','Submitted → enrolled, this term']
  ];
  const cols=admissionsStages.map(([key,title,action])=>{
    const cards=admissionsPipeline.filter(a=>a.stage===key);
    const body=cards.map(c=>`<article class="kanban-card"><div class="person-cell"><span class="mini-avatar">${initialsOf(c.name)}</span><div><strong>${c.name}</strong><small>${c.cls} · ${c.campus}</small></div></div><div class="kanban-meta"><span>${c.date}</span><span class="${c.docsOk?'doc-ok':'doc-warn'}">${c.docsLabel}</span></div>${canAct?key==='submitted'?`<button class="outline-button" data-review-applicant="${c.name}">${action}</button>`:key==='enrolled'?`<button class="outline-button" data-view-applicant="${c.name}">${action}</button>`:`<button class="outline-button" data-advance-applicant="${c.name}">${action}</button>`:'<div class="view-only-badge">View only</div>'}</article>`).join('')||'<p class="kanban-empty">No applicants here</p>';
    return `<div class="kanban-col"><div class="kanban-col-head"><h3>${title}</h3><span>${cards.length}</span></div>${body}</div>`;
  }).join('');
  return `<section class="page workspace-page" id="admissions"><div class="page-heading"><div><p class="eyebrow">Admissions & enrolment</p><h1>${label}</h1><p class="subtitle">Move applicants from submitted through to enrolled, with documents verified at every step.</p></div>${canAct?'<button class="new-button" data-modal="new-application">+ New application</button>':'<span class="view-only-badge">View only</span>'}</div><div class="screen-kpis">${kpis.map(s=>`<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('')}</div><div class="kanban-toolbar"><input aria-label="Search applicants" placeholder="Search applicants by name or class"><button class="filter-button">Campus: all ⌄</button><button class="filter-button">Class: all ⌄</button></div><div class="kanban">${cols}</div></section>`;
}

const feeStructure=[
  {cls:'Creche – KG',tuition:95000,transport:25000,boarding:0,exam:5000},
  {cls:'Primary 1–3',tuition:120000,transport:28000,boarding:0,exam:6000},
  {cls:'Primary 4–6',tuition:135000,transport:28000,boarding:0,exam:7000},
  {cls:'JSS 1–3',tuition:165000,transport:32000,boarding:180000,exam:9000},
  {cls:'SS 1–3',tuition:210000,transport:32000,boarding:210000,exam:12000}
];
const feeInstallments=[
  {student:'Kemi Adeyemi · JSS 2',family:'Adeyemi Family',amount:'₦95,000',due:'2 Sep',status:'Paid'},
  {student:'David Chukwu · SS 1',family:'Chukwu Family',amount:'₦70,000',due:'2 Sep',status:'Pending'},
  {student:'Grace Adebayo · JSS 2',family:'Adebayo Family',amount:'₦45,000',due:'15 Aug',status:'Overdue'},
  {student:'Zainab Bello · SS 2',family:'Bello Family',amount:'₦80,000',due:'2 Sep',status:'Pending'}
];
const feeDiscounts=[
  {name:'Sibling discount',rule:'3rd child and above, same household',value:'10% off tuition',applied:'62 families'},
  {name:'Staff ward waiver',rule:'Children of full-time staff',value:'50% off tuition',applied:'14 families'},
  {name:'Merit scholarship',rule:'Top 5 per class, prior term result',value:'100% tuition waiver',applied:'15 students'},
  {name:'Early payment discount',rule:'Full term fee paid before resumption',value:'5% off total fees',applied:'201 families'}
];
const arrearsAging=[
  {label:'0–30 days',amount:'₦6.2m',count:'48 families',pct:30},
  {label:'31–60 days',amount:'₦4.8m',count:'29 families',pct:23},
  {label:'61–90 days',amount:'₦3.1m',count:'17 families',pct:15},
  {label:'90+ days',amount:'₦7.2m',count:'21 families',pct:32}
];
function pageFeesSchool(label){
  const canEditFees=activeRole==='proprietor'||activeRole==='bursar';
  const hideRevenue=revenueRestrictedRoles.has(activeRole);
  const kpis=hideRevenue?[['Collected this term','Restricted','Ask the bursar for revenue figures'],['Outstanding','Restricted','Ask the bursar for revenue figures'],['Discounts applied','Restricted','Ask the bursar for revenue figures'],['Overdue beyond 30 days','115 families','Across all buckets, no amounts shown']]:[['Collected this term','₦184.6m','↑ 6.8% vs last term'],['Outstanding','₦21.3m','115 families across all buckets'],['Discounts applied','₦18.4m','91 families this term'],['Overdue beyond 30 days','₦15.1m','67 families need follow-up']];
  const structureRows=feeStructure.map(f=>`<tr><td>${f.cls}</td><td>${money(f.tuition)}</td><td>${money(f.transport)}</td><td>${f.boarding?money(f.boarding):'—'}</td><td>${money(f.exam)}</td><td><strong>${money(f.tuition+f.transport+f.boarding+f.exam)}</strong></td></tr>`).join('');
  const installmentRows=feeInstallments.map(i=>`<tr><td><div class="person-cell"><span class="mini-avatar">${initialsOf(i.student)}</span>${i.student}</div></td><td>${i.family}</td><td>${i.amount}</td><td>${i.due}</td><td><span class="status ${i.status!=='Paid'?'pending':''}">${i.status}</span></td></tr>`).join('');
  const discountRows=feeDiscounts.map(d=>`<tr><td>${d.name}</td><td>${d.rule}</td><td>${d.value}</td><td>${d.applied}</td></tr>`).join('');
  const agingRows=arrearsAging.map(a=>`<div class="aging-row"><span class="aging-label">${a.label}</span><div class="aging-bar"><span style="width:${a.pct}%"></span></div><span class="aging-amount">${a.amount}</span><span class="aging-count">${a.count}</span></div>`).join('');
  return `<section class="page workspace-page" id="${slug(label)}"><div class="page-heading"><div><p class="eyebrow">Fees & billing</p><h1>${label}</h1><p class="subtitle">Fee structures, instalments, discounts and arrears, in one place.</p></div>${canEditFees?'<button class="new-button" data-modal="new-fee-structure">+ New fee structure</button>':'<span class="view-only-badge">View only</span>'}</div><div class="screen-kpis">${kpis.map(s=>`<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('')}</div><div class="screen-tabs" data-tabs><button class="active" data-tab="structure">Fee structure</button><button data-tab="installments">Instalments</button><button data-tab="discounts">Discounts & waivers</button><button data-tab="arrears">Arrears ageing</button></div><div data-tab-panel="structure" class="tab-panel visible"><section class="data-card"><table class="data-table"><thead><tr><th>Class</th><th>Tuition</th><th>Transport</th><th>Boarding</th><th>Exam levy</th><th>Total per term</th></tr></thead><tbody>${structureRows}</tbody></table></section></div><div data-tab-panel="installments" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Student</th><th>Family</th><th>Amount</th><th>Due date</th><th>Status</th></tr></thead><tbody>${installmentRows}</tbody></table></section></div><div data-tab-panel="discounts" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Discount / scholarship</th><th>Rule</th><th>Value</th><th>Applied to</th></tr></thead><tbody>${discountRows}</tbody></table></section></div><div data-tab-panel="arrears" class="tab-panel"><section class="data-card aging-card">${agingRows}</section></div></section>`;
}

const parentInvoices={
  'Ada Okon':[
    {item:'Tuition · Third term',amount:'₦210,000',due:'2 Sep',status:'Paid'},
    {item:'Transport · Third term',amount:'₦32,000',due:'2 Sep',status:'Paid'}
  ],
  'Emeka Okon':[
    {item:'Tuition balance · Third term',amount:'₦36,000',due:'2 Sep',status:'Pending'},
    {item:'Exam levy · Third term',amount:'₦9,000',due:'15 Aug',status:'Overdue'}
  ]
};
const paymentHistory=[
  {date:'12 Jun',child:'Ada Okon',item:'Second term tuition',amount:'₦210,000',method:'Bank transfer',receipt:'RCT-1092'},
  {date:'10 Jun',child:'Emeka Okon',item:'Second term tuition',amount:'₦165,000',method:'Card',receipt:'RCT-1077'},
  {date:'2 Feb',child:'Ada Okon',item:'First term tuition',amount:'₦210,000',method:'Bank transfer',receipt:'RCT-0891'}
];
function pageFeesParent(label){
  const outstandingTotal=parentChildren.reduce((sum,c)=>sum+Number(c.feeBalance.replace(/[₦,]/g,'')),0);
  const pendingChildren=parentChildren.filter(c=>c.feeStatus==='Pending').length;
  const kpis=[['Total outstanding',money(outstandingTotal),pendingChildren?`${pendingChildren} ${pendingChildren===1?'child':'children'} with a balance`:'All balances clear'],['Next due date','2 Sep','Third term instalment'],['Paid this term','₦447,000','Across both children'],['Payment methods','Card · Transfer · USSD','Choose at checkout']];
  const childBlocks=parentChildren.map(c=>{
    const invoices=parentInvoices[c.name]||[];
    const rows=invoices.map(i=>`<tr><td>${i.item}</td><td>${i.amount}</td><td>${i.due}</td><td><span class="status ${i.status!=='Paid'?'pending':''}">${i.status}</span></td></tr>`).join('')||'<tr><td colspan="4">No invoices this term</td></tr>';
    return `<section class="data-card fee-child-card"><div class="data-toolbar"><div class="person-cell"><span class="mini-avatar">${initialsOf(c.name)}</span><div><strong>${c.name}</strong><small>${c.cls}</small></div></div>${c.feeStatus==='Pending'?`<button class="new-button" data-pay-child="${c.name}">Pay ${c.feeBalance}</button>`:'<span class="status">Fully paid</span>'}</div><table class="data-table"><thead><tr><th>Item</th><th>Amount</th><th>Due date</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }).join('');
  const historyRows=paymentHistory.map(p=>`<tr><td>${p.date}</td><td>${p.child}</td><td>${p.item}</td><td>${p.amount}</td><td>${p.method}</td><td class="row-action"><button class="outline-button" data-view-receipt="${p.receipt}">View receipt</button></td></tr>`).join('');
  return `<section class="page workspace-page" id="${slug(label)}"><div class="page-heading"><div><p class="eyebrow">Fees & payments</p><h1>${label}</h1><p class="subtitle">Pay your children's fees and keep every receipt in one place.</p></div></div><div class="screen-kpis">${kpis.map((s,i)=>`<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small class="${i===0&&pendingChildren?'warn':''}">${s[2]}</small></article>`).join('')}</div><div class="screen-tabs" data-tabs><button class="active" data-tab="outstanding">Outstanding</button><button data-tab="history">Payment history</button></div><div data-tab-panel="outstanding" class="tab-panel visible"><div class="fee-child-grid">${childBlocks}</div></div><div data-tab-panel="history" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Date</th><th>Child</th><th>Item</th><th>Amount</th><th>Method</th><th></th></tr></thead><tbody>${historyRows}</tbody></table></section></div></section>`;
}
function pageFees(label){return activeRole==='parent'?pageFeesParent(label):pageFeesSchool(label)}

const timetableDays=['Mon','Tue','Wed','Thu','Fri'];
const timetablePeriods=['P1 · 8:00','P2 · 8:45','P3 · 9:30','P4 · 10:35','P5 · 11:20','P6 · 12:05'];
const classTimetables={
  'JSS 2A':[
    ['Mathematics · Dada','English · James','Basic Science · Eze','Mathematics · Dada','Civic Ed · Okoro'],
    ['English · James','Mathematics · Dada','Social Studies · Bello','Basic Science · Eze','English · James'],
    ['Basic Science · Eze','Basic Science · Eze','Mathematics · Dada','Social Studies · Bello','Mathematics · Dada'],
    ['— Break —','— Break —','— Break —','— Break —','— Break —'],
    ['Social Studies · Bello','Civic Ed · Okoro','English · James','Mathematics · Dada','Basic Science · Eze'],
    ['French · Diallo','French · Diallo','Civic Ed · Okoro','French · Diallo','Mathematics · Dada']
  ],
  'JSS 2B':[
    ['English · James','Mathematics · Dada','Civic Ed · Okoro','Basic Science · Eze','Mathematics · Dada'],
    ['Mathematics · Dada','Basic Science · Eze','English · James','Social Studies · Bello','English · James'],
    ['Social Studies · Bello','English · James','Mathematics · Dada','Basic Science · Eze','French · Diallo'],
    ['— Break —','— Break —','— Break —','— Break —','— Break —'],
    ['Basic Science · Eze','Civic Ed · Okoro','French · Diallo','Mathematics · Dada','Social Studies · Bello'],
    ['French · Diallo','Social Studies · Bello','Civic Ed · Okoro','English · James','Basic Science · Eze']
  ],
  'SS 1A':[
    ['Physics · Nwachukwu','Chemistry · Adio','Biology · Falana','Mathematics · Dada','English · James'],
    ['Mathematics · Dada','Physics · Nwachukwu','English · James','Chemistry · Adio','Biology · Falana'],
    ['Chemistry · Adio','Biology · Falana','Mathematics · Dada','Physics · Nwachukwu','Government · Bello'],
    ['— Break —','— Break —','— Break —','— Break —','— Break —'],
    ['Biology · Falana','Government · Bello','Physics · Nwachukwu','English · James','Chemistry · Adio'],
    ['English · James','Government · Bello','Chemistry · Adio','Biology · Falana','Mathematics · Dada']
  ]
};
const timetableConflicts={'JSS 2A':{row:5,col:4,note:'Mrs. Dada is also teaching JSS 2B at this time'}};
let currentTimetableClass='JSS 2A';
function openEditTimetableCellModal(r,c){
  const grid=classTimetables[currentTimetableClass];
  const current=grid[r][c];
  const parts=current.includes('·')?current.split(' · '):['',''];
  formModal({eyebrow:currentTimetableClass,title:`${timetableDays[c]} · ${timetablePeriods[r]}`,
    fields:[{name:'subject',label:'Subject',value:parts[0].trim(),placeholder:'e.g. Mathematics'},{name:'teacher',label:'Teacher',value:(parts[1]||'').trim(),placeholder:'e.g. Dada'}],
    submitLabel:'Save',
    onSubmit:d=>{grid[r][c]=d.subject?`${d.subject} · ${d.teacher||'TBC'}`:'Free period';refresh();toast('Timetable updated')}
  });
}
function openNewTimetableModal(){
  formModal({eyebrow:'Timetable',title:'New class timetable',sub:'Creates a blank weekly grid you can fill in, period by period.',
    fields:[{name:'cls',label:'Class name',placeholder:'e.g. SS 2A'}],
    submitLabel:'Create timetable',
    onSubmit:d=>{
      const cls=d.cls||'New class';
      classTimetables[cls]=Array.from({length:6},()=>Array(5).fill('Free period'));
      currentTimetableClass=cls;refresh();toast(`Timetable created · ${cls}`);
    }
  });
}
function selectTimetableClass(cls){if(classTimetables[cls]){currentTimetableClass=cls;refresh()}}
const gradingScale=[['A','70–100','Excellent'],['B','60–69','Very good'],['C','50–59','Good'],['D','45–49','Pass'],['E','40–44','Weak pass'],['F','0–39','Fail']];
function openEditGradeModal(grade){
  const g=gradingScale.find(x=>x[0]===grade);if(!g)return;
  formModal({eyebrow:'Grading scale',title:`Edit grade ${grade}`,
    fields:[{name:'range',label:'Score range',value:g[1],placeholder:'e.g. 70–100'},{name:'meaning',label:'Meaning',value:g[2]}],
    submitLabel:'Save',
    onSubmit:d=>{g[1]=d.range||g[1];g[2]=d.meaning||g[2];refresh();toast(`Grading scale updated · Grade ${grade}`)}
  });
}
function pageAcademics(label){
  const kpis=[['Classes live','—','Live count','academicsClassesLiveKpi'],['Timetable conflicts','Coming soon','Timetable data source not built yet',null],['Marks entries flagged','Coming soon','No flagging logic built yet',null],['Results awaiting approval','—','Submitted, not yet approved','academicsResultsAwaitingKpi']];
  const grid=classTimetables[currentTimetableClass];
  const conflict=timetableConflicts[currentTimetableClass];
  const ttRows=timetablePeriods.map((p,r)=>`<tr><td class="tt-period">${p}</td>${timetableDays.map((d,c)=>{const isConflict=conflict&&conflict.row===r&&conflict.col===c;const val=grid[r][c];const isBreak=val.startsWith('—');return `<td class="${isBreak?'tt-break':'tt-editable'} ${isConflict?'tt-conflict':''}" ${isConflict?`title="Clash: ${conflict.note}"`:''} ${isBreak?'':`data-edit-cell="${r},${c}"`}>${val}${isConflict?' ⚠':''}</td>`}).join('')}</tr>`).join('');
  const canManageClasses=(()=>{const u=window.SchoolOSApi&&window.SchoolOSApi.getUser();return u&&(u.role==='PROPRIETOR'||u.role==='PRINCIPAL')})();
  const addClassButton=canManageClasses?'<button class="new-button" data-modal="new-class">+ Add class</button>':'';
  const addSubjectButton=canManageClasses?'<button class="new-button" data-modal="new-subject">+ Add subject</button>':'';
  return `<section class="page workspace-page" id="academics"><div class="page-heading"><div><p class="eyebrow">Academic management</p><h1>${label}</h1><p class="subtitle">Timetable, marks entry and result approval for every class.</p></div><button class="new-button" data-goto-tab="marks">+ Enter marks</button></div><div class="screen-kpis">${kpis.map((s,i)=>`<article class="screen-kpi"><p>${s[0]}</p><strong${s[3]?` id="${s[3]}"`:''}>${s[1]}</strong><small class="${i===1||i===2?'warn':''}">${s[2]}</small></article>`).join('')}</div><div class="screen-tabs" data-tabs><button class="active" data-tab="timetable">Timetable</button><button data-tab="marks">Marks entry</button><button data-tab="results">Result approval</button><button data-tab="scale">Grading scale</button><button data-tab="classes">Classes</button><button data-tab="subjects">Subjects</button></div><div data-tab-panel="timetable" class="tab-panel visible"><section class="data-card"><div class="data-toolbar"><span class="tt-class-label">${currentTimetableClass} · Third term</span><select id="timetableClassSelect" aria-label="Select class timetable">${Object.keys(classTimetables).map(c=>`<option ${c===currentTimetableClass?'selected':''}>${c}</option>`).join('')}</select><button class="new-button" data-modal="new-timetable">+ New class timetable</button></div><p class="tt-hint">Click any period to edit it.</p><table class="data-table timetable-grid"><thead><tr><th></th>${timetableDays.map(d=>`<th>${d}</th>`).join('')}</tr></thead><tbody>${ttRows}</tbody></table></section></div><div data-tab-panel="marks" class="tab-panel"><section class="data-card"><div class="data-toolbar"><span class="tt-class-label">Live from the API, drafts not yet submitted</span></div><table class="data-table"><thead><tr><th>Student</th><th>Subject</th><th>Term</th><th>CA</th><th>Exam</th><th>Total</th></tr></thead><tbody id="realMarksEntryBody"><tr><td colspan="6">Sign in to load marks…</td></tr></tbody></table></section></div><div data-tab-panel="results" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Student</th><th>Subject</th><th>Term</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody id="realResultApprovalsBody"><tr><td colspan="6">Sign in to load results…</td></tr></tbody></table></section></div><div data-tab-panel="scale" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Grade</th><th>Range</th><th>Meaning</th><th></th></tr></thead><tbody>${gradingScale.map(g=>`<tr><td><strong>${g[0]}</strong></td><td>${g[1]}</td><td>${g[2]}</td><td class="row-action"><button class="outline-button" data-edit-grade="${g[0]}">Edit</button></td></tr>`).join('')}</tbody></table></section></div><div data-tab-panel="classes" class="tab-panel"><section class="data-card"><div class="data-toolbar"><span class="tt-class-label">Live from the API</span>${addClassButton}</div><table class="data-table"><thead><tr><th>Class</th><th>Campus</th><th>Arms</th><th></th></tr></thead><tbody id="realClassesBody"><tr><td colspan="4">Sign in to load classes…</td></tr></tbody></table></section></div><div data-tab-panel="subjects" class="tab-panel"><section class="data-card"><div class="data-toolbar"><span class="tt-class-label">Live from the API</span>${addSubjectButton}</div><table class="data-table"><thead><tr><th>Subject</th><th>Code</th></tr></thead><tbody id="realSubjectsBody"><tr><td colspan="2">Sign in to load subjects…</td></tr></tbody></table></section></div></section>`;
}

/** teacherClassMap backs the *unrelated* teacher-persona mock pages (a
 * teacher previewing their own attendance/marks screens), kept as-is;
 * only the admin-facing "Teachers" list below was replaced with real API
 * data. */
const teacherClassMap={'Tunde Bello':{cls:'JSS 2A',subject:'Mathematics'}};
/** Real data from the SchoolOS API; see pageStudentsReal's doc comment.
 * Renders a loading skeleton synchronously; loadRealTeachers() fills it
 * in once the API responds. */
function pageTeachersReal(label){
  const user=window.SchoolOSApi&&window.SchoolOSApi.getUser();
  const canCreate=user&&(user.role==='PROPRIETOR'||user.role==='PRINCIPAL');
  const addButton=canCreate?'<button class="new-button" data-modal="new-teacher">+ Add teacher</button>':'';
  return `<section class="page workspace-page" id="${slug(label)}"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Real teaching staff for the signed-in tenant.</p></div>${addButton}</div><section class="data-card"><table class="data-table"><thead><tr><th>Teacher</th><th>Staff ID</th><th>Department</th><th>Login email</th><th></th></tr></thead><tbody id="realTeachersBody"><tr><td colspan="5">Sign in to load teachers…</td></tr></tbody></table></section></section>`;
}
/** Opens the real "Add teacher" form. Beyond the basic account, this lets
 * the admin pick one subject and any number of classes right away: one
 * teacher can be the Mathematics teacher for several classes at once, so
 * "classes" is a checkbox group, not a single select. Each selected class
 * becomes its own POST /teacher-subject-assignments call after the
 * teacher account is created (that endpoint already tenant-validates
 * staffProfileId/schoolClassId/subjectId, so no new backend work needed
 * here; this just calls it once per class). */
async function openNewTeacherModal(){
  if(!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken()){toast('Sign in to add a teacher');return}
  let campuses=[],classes=[],subjects=[];
  try{
    [campuses,classes,subjects]=await Promise.all([
      window.SchoolOSApi.api('/campuses'),
      window.SchoolOSApi.api('/classes'),
      window.SchoolOSApi.api('/subjects'),
    ]);
  }catch(err){toast(`Could not load campuses/classes/subjects (${err.message})`);return}
  if(!campuses.length){toast('No campuses found for this tenant');return}
  const campusByName=Object.fromEntries(campuses.map(c=>[c.name,c.id]));
  const subjectByName=Object.fromEntries(subjects.map(s=>[s.name,s.id]));

  formModal({
    eyebrow:'Teachers',
    title:'Add teacher',
    sub:'Creates a real teacher account via the SchoolOS API: POST /staff-profiles/teachers. Optionally assign them as the subject teacher for one or more classes right away.',
    fields:[
      {name:'firstName',label:'First name',placeholder:'e.g. Amina'},
      {name:'lastName',label:'Last name',placeholder:'e.g. Yusuf'},
      {name:'campus',label:'Campus',type:'select',options:campuses.map(c=>c.name)},
      {name:'department',label:'Department',placeholder:'e.g. Academics'},
      {name:'position',label:'Position',placeholder:'e.g. Class Teacher'},
      {name:'subject',label:'Subject to teach (optional)',type:'select',options:['None',...subjects.map(s=>s.name)]},
      {name:'classIds',label:'Classes they teach this subject in',type:'checkboxes',options:classes.map(c=>({value:c.id,label:c.name}))},
    ],
    submitLabel:'Add teacher',
    onSubmit:async d=>{
      const payload={
        campusId:campusByName[d.campus],
        firstName:(d.firstName||'').trim(),
        lastName:(d.lastName||'').trim(),
        department:d.department||undefined,
        position:d.position||undefined,
      };
      if(!payload.firstName||!payload.lastName||!payload.campusId){toast('First name, last name and campus are required');return}
      const chosenClassIds=[].concat(d.classIds||[]);
      const subjectId=d.subject&&d.subject!=='None'?subjectByName[d.subject]:null;
      if(chosenClassIds.length&&!subjectId){toast('Select a subject to assign to those classes');return}
      try{
        const created=await window.SchoolOSApi.api('/staff-profiles/teachers',{method:'POST',body:JSON.stringify(payload)});
        loadRealTeachers();
        let assignedNote='';
        if(subjectId&&chosenClassIds.length){
          for(const schoolClassId of chosenClassIds){
            await window.SchoolOSApi.api('/teacher-subject-assignments',{method:'POST',body:JSON.stringify({staffProfileId:created.id,schoolClassId,subjectId})});
          }
          assignedNote=` · assigned ${d.subject} in ${chosenClassIds.length} class${chosenClassIds.length>1?'es':''}`;
        }
        toast(`${payload.firstName} ${payload.lastName} added${assignedNote}`);
        if(created&&created.loginCredentials){
          detailModal({
            eyebrow:'Teachers',
            title:'Login created',
            sub:`A teacher portal login was generated automatically for ${payload.firstName} ${payload.lastName}. Share these with them directly; they won't be shown again.`,
            rows:[['Email',created.loginCredentials.email],['Password',created.loginCredentials.password]],
          });
        }
      }catch(err){
        toast(`Could not add teacher (${err.message})`);
      }
    },
  });
}
async function loadRealTeachers(){
  const tbody=document.getElementById('realTeachersBody');
  if(!tbody||!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken())return;
  tbody.innerHTML='<tr><td colspan="5">Loading teachers…</td></tr>';
  try{
    const staff=await window.SchoolOSApi.api('/staff-profiles');
    const teachers=staff.filter(s=>s.user&&s.user.role==='TEACHER');
    tbody.innerHTML=teachers.length?teachers.map(s=>`<tr><td><div class="person-cell"><span class="mini-avatar">${initialsOf(s.user.firstName+' '+s.user.lastName)}</span>${s.user.firstName} ${s.user.lastName}</div></td><td>${s.staffId}</td><td>${s.department||'—'}</td><td>${s.user.email}</td><td class="row-action"><button class="outline-button" data-view-teacher="${s.id}">View</button></td></tr>`).join(''):'<tr><td colspan="5">No teachers yet.</td></tr>';
  }catch(err){
    tbody.innerHTML=`<tr><td colspan="5">Could not load teachers (${err.message})</td></tr>`;
  }
}
window.loadRealTeachers=loadRealTeachers;

/** "View teacher": shows the real profile (GET /staff-profiles/:id) with
 * inline-editable name/department/position for Proprietor/Principal, plus
 * read-only sections for the classes they lead and the subjects they
 * teach. Editing re-opens this same modal with fresh data rather than
 * patching the DOM in place, so it always reflects what the API has. */
async function openTeacherDetailModal(staffProfileId){
  if(!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken()){toast('Sign in to view teacher details');return}
  let t;
  try{ t=await window.SchoolOSApi.api('/staff-profiles/'+staffProfileId) }catch(err){toast(`Could not load teacher (${err.message})`);return}
  const user=window.SchoolOSApi.getUser();
  const canManage=user&&(user.role==='PROPRIETOR'||user.role==='PRINCIPAL');

  const ledHtml=(t.classArmsLed||[]).map(a=>`<div class="modal-detail-row"><span>${a.name}</span><strong>${a.schoolClass.name}</strong></div>`).join('')||'<p class="modal-sub" style="margin:0">Not a class teacher for any arm.</p>';
  const taughtHtml=(t.teacherAssignments||[]).map(a=>`<div class="modal-detail-row"><span>${a.subject.name}</span><strong>${a.schoolClass.name}</strong></div>`).join('')||'<p class="modal-sub" style="margin:0">No subjects assigned yet.</p>';

  window.__renameTeacherSubmit=async(e)=>{
    e.preventDefault();
    const data=new FormData(e.target);
    try{
      await window.SchoolOSApi.api('/staff-profiles/'+staffProfileId,{method:'PATCH',body:JSON.stringify({
        firstName:data.get('firstName'),lastName:data.get('lastName'),
        department:data.get('department'),position:data.get('position'),
      })});
      toast('Teacher updated');
      loadRealTeachers();
      openTeacherDetailModal(staffProfileId);
    }catch(err){toast(`Could not update teacher (${err.message})`)}
  };

  openModal(`<p class="eyebrow">Teachers</p><h2>Teacher details</h2>
    ${canManage?`<form onsubmit="__renameTeacherSubmit(event)">
      <div class="inline-edit-row"><input name="firstName" value="${t.user.firstName}" aria-label="First name"><input name="lastName" value="${t.user.lastName}" aria-label="Last name"></div>
      <div class="inline-edit-row"><input name="department" value="${t.department||''}" placeholder="Department" aria-label="Department"><input name="position" value="${t.position||''}" placeholder="Position" aria-label="Position"></div>
      <div class="form-actions" style="margin-top:10px"><button type="submit" class="new-button">Save changes</button></div>
    </form>`:`<p class="modal-sub">${t.user.firstName} ${t.user.lastName} · ${t.department||'—'} · ${t.position||'—'}</p>`}
    <div class="modal-detail-row"><span>Staff ID</span><strong>${t.staffId}</strong></div>
    <div class="modal-detail-row"><span>Login email</span><strong>${t.user.email}</strong></div>
    <div class="detail-section"><p class="eyebrow">Class teacher (homeroom) for</p>${ledHtml}</div>
    <div class="detail-section"><p class="eyebrow">Subjects taught</p>${taughtHtml}</div>
    <div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>`);
}

/** Fills the "Classes" tab on the Academics page with real SchoolClass +
 * ClassArm data. Campus names are resolved client-side from /campuses
 * since /classes doesn't include the campus relation. */
async function loadRealClasses(){
  const tbody=document.getElementById('realClassesBody');
  if(!tbody||!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken())return;
  tbody.innerHTML='<tr><td colspan="4">Loading classes…</td></tr>';
  try{
    const [classes,campuses]=await Promise.all([
      window.SchoolOSApi.api('/classes'),
      window.SchoolOSApi.api('/campuses'),
    ]);
    const campusName=Object.fromEntries(campuses.map(c=>[c.id,c.name]));
    tbody.innerHTML=classes.length?classes.map(c=>`<tr><td>${c.name}</td><td>${campusName[c.campusId]||'—'}</td><td>${(c.arms||[]).map(a=>a.name).join(', ')||'—'}</td><td class="row-action"><button class="outline-button" data-view-class="${c.id}">View</button></td></tr>`).join(''):'<tr><td colspan="4">No classes yet.</td></tr>';
  }catch(err){
    tbody.innerHTML=`<tr><td colspan="4">Could not load classes (${err.message})</td></tr>`;
  }
}
window.loadRealClasses=loadRealClasses;

/** "View class": shows the real class (GET /classes/:id) with an
 * inline-editable class name, each arm inline-editable with its own Save
 * (a class can have several arms, each renamed independently), a
 * "+ Add arm" affordance, and a read-only list of subject teachers
 * assigned to this class. Reopens itself after any save so the modal
 * always reflects the latest API state. */
async function openClassDetailModal(classId){
  if(!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken()){toast('Sign in to view class details');return}
  let cls;
  try{ cls=await window.SchoolOSApi.api('/classes/'+classId) }catch(err){toast(`Could not load class (${err.message})`);return}
  const user=window.SchoolOSApi.getUser();
  const canManage=user&&(user.role==='PROPRIETOR'||user.role==='PRINCIPAL');

  const armsHtml=(cls.arms||[]).map(a=>{
    const teacherName=a.classTeacher?`${a.classTeacher.user.firstName} ${a.classTeacher.user.lastName}`:'Unassigned';
    return canManage
      ? `<form class="inline-edit-row" onsubmit="__renameArmSubmit(event,'${a.id}')"><input name="name" value="${a.name}" aria-label="Arm name"><small>${teacherName}</small><button type="submit" class="outline-button">Save</button></form>`
      : `<div class="modal-detail-row"><span>${a.name}</span><strong>${teacherName}</strong></div>`;
  }).join('')||'<p class="modal-sub" style="margin:0">No arms yet.</p>';

  const subjectsHtml=(cls.teacherAssignments||[]).map(t=>`<div class="modal-detail-row"><span>${t.subject.name}</span><strong>${t.staffProfile.user.firstName} ${t.staffProfile.user.lastName}</strong></div>`).join('')||'<p class="modal-sub" style="margin:0">No subject teachers assigned yet.</p>';

  window.__renameClassSubmit=async(e)=>{
    e.preventDefault();
    const name=new FormData(e.target).get('name');
    try{
      await window.SchoolOSApi.api('/classes/'+classId,{method:'PATCH',body:JSON.stringify({name})});
      toast('Class renamed');
      loadRealClasses();
      openClassDetailModal(classId);
    }catch(err){toast(`Could not rename class (${err.message})`)}
  };
  window.__renameArmSubmit=async(e,armId)=>{
    e.preventDefault();
    const name=new FormData(e.target).get('name');
    try{
      await window.SchoolOSApi.api('/class-arms/'+armId,{method:'PATCH',body:JSON.stringify({name})});
      toast('Arm renamed');
      loadRealClasses();
      openClassDetailModal(classId);
    }catch(err){toast(`Could not rename arm (${err.message})`)}
  };

  openModal(`<p class="eyebrow">Academics</p><h2>Class details</h2>
    ${canManage?`<form class="inline-edit-row" onsubmit="__renameClassSubmit(event)"><input name="name" value="${cls.name}" aria-label="Class name"><button type="submit" class="outline-button">Save</button></form>`:`<p class="modal-sub">${cls.name}</p>`}
    <div class="detail-section">
      <p class="eyebrow">Arms</p>
      ${armsHtml}
      ${canManage?`<button class="outline-button" style="margin-top:10px" data-add-arm="${classId}">+ Add arm</button>`:''}
    </div>
    <div class="detail-section"><p class="eyebrow">Subject teachers</p>${subjectsHtml}</div>
    <div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>`);
}
/** Opens the real "Add class" form: POST /classes. */
async function openNewClassModal(){
  if(!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken()){toast('Sign in to add a class');return}
  let campuses=[];
  try{
    campuses=await window.SchoolOSApi.api('/campuses');
  }catch(err){toast(`Could not load campuses (${err.message})`);return}
  if(!campuses.length){toast('No campuses found for this tenant');return}
  const campusByName=Object.fromEntries(campuses.map(c=>[c.name,c.id]));

  formModal({
    eyebrow:'Academics',
    title:'Add class',
    sub:'Creates a real class via the SchoolOS API: POST /classes.',
    fields:[
      {name:'name',label:'Class name',placeholder:'e.g. JSS 3'},
      {name:'campus',label:'Campus',type:'select',options:campuses.map(c=>c.name)},
    ],
    submitLabel:'Add class',
    onSubmit:async d=>{
      const payload={campusId:campusByName[d.campus],name:(d.name||'').trim()};
      if(!payload.name||!payload.campusId){toast('Class name and campus are required');return}
      try{
        await window.SchoolOSApi.api('/classes',{method:'POST',body:JSON.stringify(payload)});
        toast(`${payload.name} added`);
        loadRealClasses();
      }catch(err){
        toast(`Could not add class (${err.message})`);
      }
    },
  });
}
/** Opens the real "Add arm" form for a given SchoolClass: POST
 * /class-arms. Offers real teachers as the optional class-teacher
 * picker. */
async function openNewClassArmModal(schoolClassId){
  if(!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken()){toast('Sign in to add a class arm');return}
  let teachers=[];
  try{
    const staff=await window.SchoolOSApi.api('/staff-profiles');
    teachers=staff.filter(s=>s.user&&s.user.role==='TEACHER');
  }catch(err){toast(`Could not load teachers (${err.message})`);return}
  const teacherLabel=s=>`${s.user.firstName} ${s.user.lastName}`;
  const teacherByLabel=Object.fromEntries(teachers.map(s=>[teacherLabel(s),s.id]));

  formModal({
    eyebrow:'Academics',
    title:'Add class arm',
    sub:'Creates a real class arm (section) via the SchoolOS API: POST /class-arms.',
    fields:[
      {name:'name',label:'Arm name',placeholder:'e.g. Gold'},
      {name:'teacher',label:'Class teacher',type:'select',options:['Unassigned',...teachers.map(teacherLabel)]},
    ],
    submitLabel:'Add arm',
    onSubmit:async d=>{
      const payload={
        schoolClassId,
        name:(d.name||'').trim(),
        classTeacherId:d.teacher&&d.teacher!=='Unassigned'?teacherByLabel[d.teacher]:undefined,
      };
      if(!payload.name){toast('Arm name is required');return}
      try{
        await window.SchoolOSApi.api('/class-arms',{method:'POST',body:JSON.stringify(payload)});
        toast(`${payload.name} added`);
        loadRealClasses();
      }catch(err){
        toast(`Could not add class arm (${err.message})`);
      }
    },
  });
}
async function loadRealSubjects(){
  const tbody=document.getElementById('realSubjectsBody');
  if(!tbody||!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken())return;
  tbody.innerHTML='<tr><td colspan="2">Loading subjects…</td></tr>';
  try{
    const subjects=await window.SchoolOSApi.api('/subjects');
    tbody.innerHTML=subjects.length?subjects.map(s=>`<tr><td>${s.name}</td><td>${s.code||'—'}</td></tr>`).join(''):'<tr><td colspan="2">No subjects yet.</td></tr>';
  }catch(err){
    tbody.innerHTML=`<tr><td colspan="2">Could not load subjects (${err.message})</td></tr>`;
  }
}
window.loadRealSubjects=loadRealSubjects;
/** Opens the real "Add subject" form: POST /subjects. */
async function openNewSubjectModal(){
  if(!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken()){toast('Sign in to add a subject');return}
  formModal({
    eyebrow:'Academics',
    title:'Add subject',
    sub:'Creates a real subject via the SchoolOS API: POST /subjects.',
    fields:[
      {name:'name',label:'Subject name',placeholder:'e.g. Further Mathematics'},
      {name:'code',label:'Code (optional)',placeholder:'e.g. FMTH'},
    ],
    submitLabel:'Add subject',
    onSubmit:async d=>{
      const name=(d.name||'').trim();
      if(!name){toast('Subject name is required');return}
      try{
        await window.SchoolOSApi.api('/subjects',{method:'POST',body:JSON.stringify({name,code:d.code||undefined})});
        toast(`${name} added`);
        loadRealSubjects();
      }catch(err){
        toast(`Could not add subject (${err.message})`);
      }
    },
  });
}
/** One GET /results fetch feeding three spots on the Academics page: the
 * "Marks entry" tab (DRAFT rows, not yet submitted by the teacher who
 * entered them), the "Result approval" tab (SUBMITTED/APPROVED/PUBLISHED,
 * with real Approve/Publish actions), and the two live KPI numbers at the
 * top of the page. Proprietor/Principal see every result tenant-wide
 * (ResultsService.list is unscoped for staff roles), same source the
 * Dashboard's submitted-results count already uses. */
async function loadRealAcademicsResults(){
  const marksBody=document.getElementById('realMarksEntryBody');
  const approvalsBody=document.getElementById('realResultApprovalsBody');
  const classesKpi=document.getElementById('academicsClassesLiveKpi');
  const resultsKpi=document.getElementById('academicsResultsAwaitingKpi');
  if((!marksBody&&!approvalsBody&&!classesKpi&&!resultsKpi)||!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken())return;

  if(classesKpi){
    try{
      const classes=await window.SchoolOSApi.api('/classes');
      classesKpi.textContent=classes.length;
    }catch(err){classesKpi.textContent='—'}
  }

  if(!marksBody&&!approvalsBody&&!resultsKpi)return;
  let results=[];
  try{
    results=await window.SchoolOSApi.api('/results');
  }catch(err){
    if(marksBody)marksBody.innerHTML=`<tr><td colspan="6">Could not load marks (${err.message})</td></tr>`;
    if(approvalsBody)approvalsBody.innerHTML=`<tr><td colspan="6">Could not load results (${err.message})</td></tr>`;
    return;
  }

  if(marksBody){
    const drafts=results.filter(r=>r.status==='DRAFT');
    marksBody.innerHTML=drafts.length?drafts.map(r=>`<tr><td>${r.student?r.student.firstName+' '+r.student.lastName:'—'}</td><td>${r.subject?.name||'—'}</td><td>${r.term?.name||'—'}</td><td>${r.continuousAssessmentScore??'—'}</td><td>${r.examScore??'—'}</td><td>${r.totalScore??'—'}</td></tr>`).join(''):'<tr><td colspan="6">No draft marks yet.</td></tr>';
  }

  if(approvalsBody){
    const relevant=results.filter(r=>r.status==='SUBMITTED'||r.status==='APPROVED'||r.status==='PUBLISHED');
    approvalsBody.innerHTML=relevant.length?relevant.map(r=>{
      let action='<span>→</span>';
      if(r.status==='SUBMITTED')action=`<button class="outline-button" data-approve-real-result="${r.id}">Approve</button>`;
      else if(r.status==='APPROVED')action=`<button class="outline-button" data-publish-real-result="${r.id}">Publish</button>`;
      return `<tr><td>${r.student?r.student.firstName+' '+r.student.lastName:'—'}</td><td>${r.subject?.name||'—'}</td><td>${r.term?.name||'—'}</td><td>${r.totalScore??'—'}</td><td><span class="status ${r.status!=='PUBLISHED'?'pending':''}">${r.status}</span></td><td class="row-action">${action}</td></tr>`;
    }).join(''):'<tr><td colspan="6">No submitted results yet.</td></tr>';
  }

  if(resultsKpi)resultsKpi.textContent=results.filter(r=>r.status==='SUBMITTED').length;
}
window.loadRealAcademicsResults=loadRealAcademicsResults;
async function approveRealResult(id){
  try{
    await window.SchoolOSApi.api('/results/'+id+'/approve',{method:'PATCH'});
    toast('Result approved');
    loadRealAcademicsResults();
    loadRealDashboardMetrics();
  }catch(err){
    toast(`Could not approve (${err.message})`);
  }
}
async function publishRealResult(id){
  try{
    await window.SchoolOSApi.api('/results/'+id+'/publish',{method:'PATCH'});
    toast('Result published');
    loadRealAcademicsResults();
    loadRealDashboardMetrics();
  }catch(err){
    toast(`Could not publish (${err.message})`);
  }
}
/** Real data from the SchoolOS API; every other page in this file is
 * mock (fees/finance/payroll/HR aren't built on the backend yet). Renders
 * a loading skeleton synchronously; loadRealStudents() fills it in once
 * the API responds (called from changeRole() and after login). */
function pageStudentsReal(label){
  const user=window.SchoolOSApi&&window.SchoolOSApi.getUser();
  const canCreate=user&&(user.role==='PROPRIETOR'||user.role==='PRINCIPAL');
  const addButton=canCreate?'<button class="new-button" data-modal="new-student">+ Add student</button>':'';
  return `<section class="page workspace-page" id="${slug(label)}"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Real student roster for the signed-in tenant.</p></div>${addButton}</div><section class="data-card"><table class="data-table"><thead><tr><th>Student</th><th>Admission No.</th><th>Status</th><th></th></tr></thead><tbody id="realStudentsBody"><tr><td colspan="4">Sign in to load students…</td></tr></tbody></table></section></section>`;
}
function pageStudentNoticesReal(label){
  return `<section class="page workspace-page" id="${slug(label)}"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Real in-app notifications for your account.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Notice</th><th>When</th><th></th></tr></thead><tbody id="realStudentNoticesBody"><tr><td colspan="3">Sign in as a student to load notices…</td></tr></tbody></table></section></section>`;
}
function pageStudentProfileReal(label){
  return `<section class="page workspace-page" id="${slug(label)}"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Your real student record.</p></div></div><section class="data-card" id="realStudentProfileCard"><p>Sign in as a student to load your profile…</p></section></section>`;
}
/** Opens the real "Add student" form via the app's existing formModal()
 * plumbing: fetches campuses/classes first since formModal builds its
 * HTML synchronously, then POSTs to the real API on submit. */
async function openNewStudentModal(){
  if(!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken()){toast('Sign in to add a student');return}
  let campuses=[],classArms=[];
  try{
    campuses=await window.SchoolOSApi.api('/campuses');
    const classes=await window.SchoolOSApi.api('/classes');
    classArms=classes.flatMap(c=>(c.arms||[]).map(a=>({id:a.id,label:`${c.name} · ${a.name}`})));
  }catch(err){toast(`Could not load campuses/classes (${err.message})`);return}
  if(!campuses.length){toast('No campuses found for this tenant');return}
  const campusByName=Object.fromEntries(campuses.map(c=>[c.name,c.id]));
  const armByLabel=Object.fromEntries(classArms.map(a=>[a.label,a.id]));

  formModal({
    eyebrow:'Students',
    title:'Add student',
    sub:'Creates a real student record via the SchoolOS API: POST /students.',
    fields:[
      {name:'firstName',label:'First name',placeholder:'e.g. Ada'},
      {name:'lastName',label:'Last name',placeholder:'e.g. Okafor'},
      {name:'campus',label:'Campus',type:'select',options:campuses.map(c=>c.name)},
      {name:'classArm',label:'Class',type:'select',options:['Unassigned',...classArms.map(a=>a.label)]},
      {name:'gender',label:'Gender',type:'select',options:['—','Male','Female']},
      {name:'dateOfBirth',label:'Date of birth',type:'date'},
    ],
    submitLabel:'Add student',
    onSubmit:async d=>{
      const payload={
        campusId:campusByName[d.campus],
        firstName:(d.firstName||'').trim(),
        lastName:(d.lastName||'').trim(),
        gender:d.gender&&d.gender!=='—'?d.gender:undefined,
        dateOfBirth:d.dateOfBirth||undefined,
        currentClassArmId:d.classArm&&d.classArm!=='Unassigned'?armByLabel[d.classArm]:undefined,
      };
      if(!payload.firstName||!payload.lastName||!payload.campusId){toast('First name, last name and campus are required');return}
      try{
        const created=await window.SchoolOSApi.api('/students',{method:'POST',body:JSON.stringify(payload)});
        toast(`${payload.firstName} ${payload.lastName} added`);
        loadRealStudents();
        if(created&&created.loginCredentials){
          detailModal({
            eyebrow:'Students',
            title:'Login created',
            sub:`A student portal login was generated automatically for ${payload.firstName} ${payload.lastName}. Share these with them directly; they won't be shown again.`,
            rows:[['Email',created.loginCredentials.email],['Password',created.loginCredentials.password]],
          });
        }
      }catch(err){
        toast(`Could not add student (${err.message})`);
      }
    },
  });
}
async function loadRealStudents(){
  const tbody=document.getElementById('realStudentsBody');
  if(!tbody||!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken())return;
  tbody.innerHTML='<tr><td colspan="4">Loading students…</td></tr>';
  try{
    const students=await window.SchoolOSApi.api('/students');
    tbody.innerHTML=students.length?students.map(s=>`<tr><td><div class="person-cell"><span class="mini-avatar">${initialsOf(s.firstName+' '+s.lastName)}</span>${s.firstName} ${s.lastName}</div></td><td>${s.admissionNo}</td><td><span class="status">${s.status}</span></td><td class="row-action"><button class="outline-button" data-view-student="${s.id}">View</button></td></tr>`).join(''):'<tr><td colspan="4">No students yet.</td></tr>';
  }catch(err){
    tbody.innerHTML=`<tr><td colspan="4">Could not load students (${err.message})</td></tr>`;
  }
}
window.loadRealStudents=loadRealStudents;

/** "View student": shows the real record (GET /students/:id) with
 * inline-editable name for Proprietor/Principal, plus read-only admission
 * details, current class and linked guardians. */
async function openStudentDetailModal(studentId){
  if(!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken()){toast('Sign in to view student details');return}
  let s;
  try{ s=await window.SchoolOSApi.api('/students/'+studentId) }catch(err){toast(`Could not load student (${err.message})`);return}
  const user=window.SchoolOSApi.getUser();
  const canManage=user&&(user.role==='PROPRIETOR'||user.role==='PRINCIPAL');
  const className=s.currentClassArm?`${s.currentClassArm.schoolClass.name} · ${s.currentClassArm.name}`:'Unassigned';

  const guardiansHtml=(s.guardianLinks||[]).map(g=>`<div class="modal-detail-row"><span>${g.guardian.firstName} ${g.guardian.lastName} (${g.relationship})</span><strong>${g.guardian.phone||g.guardian.email||'—'}</strong></div>`).join('')||'<p class="modal-sub" style="margin:0">No guardians linked yet.</p>';

  window.__renameStudentSubmit=async(e)=>{
    e.preventDefault();
    const data=new FormData(e.target);
    try{
      await window.SchoolOSApi.api('/students/'+studentId,{method:'PATCH',body:JSON.stringify({
        firstName:data.get('firstName'),lastName:data.get('lastName'),middleName:data.get('middleName')||undefined,
      })});
      toast('Student updated');
      loadRealStudents();
      openStudentDetailModal(studentId);
    }catch(err){toast(`Could not update student (${err.message})`)}
  };

  openModal(`<p class="eyebrow">Students</p><h2>Student details</h2>
    ${canManage?`<form onsubmit="__renameStudentSubmit(event)">
      <div class="inline-edit-row"><input name="firstName" value="${s.firstName}" aria-label="First name"><input name="lastName" value="${s.lastName}" aria-label="Last name"></div>
      <div class="inline-edit-row"><input name="middleName" value="${s.middleName||''}" placeholder="Middle name (optional)" aria-label="Middle name"></div>
      <div class="form-actions" style="margin-top:10px"><button type="submit" class="new-button">Save changes</button></div>
    </form>`:`<p class="modal-sub">${s.firstName} ${s.lastName}</p>`}
    <div class="modal-detail-row"><span>Admission No.</span><strong>${s.admissionNo}</strong></div>
    <div class="modal-detail-row"><span>Status</span><strong>${s.status}</strong></div>
    <div class="modal-detail-row"><span>Class</span><strong>${className}</strong></div>
    <div class="modal-detail-row"><span>Gender</span><strong>${s.gender||'—'}</strong></div>
    <div class="detail-section"><p class="eyebrow">Guardians</p>${guardiansHtml}</div>
    <div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>`);
}

/** Fills the real-data tables on the student persona's Results/Attendance/
 * Assignments pages. Only fetches when the *actual* logged-in account is
 * a real STUDENT (the backend's /portal/student/* routes are STUDENT-only;
 * previewing "student" via the role dropdown as e.g. Proprietor, or the
 * no-auth "Continue as Student" shortcut, correctly shows a placeholder
 * instead of a 403). */
async function loadRealStudentPortalData(){
  const resultsBody=document.getElementById('realStudentResultsBody');
  const attendanceBody=document.getElementById('realStudentAttendanceBody');
  const assignmentsBody=document.getElementById('realStudentAssignmentsBody');
  const subjectsBody=document.getElementById('realStudentSubjectsBody');
  const noticesBody=document.getElementById('realStudentNoticesBody');
  const profileCard=document.getElementById('realStudentProfileCard');
  if(!resultsBody&&!attendanceBody&&!assignmentsBody&&!subjectsBody&&!noticesBody&&!profileCard)return;

  const user=window.SchoolOSApi&&window.SchoolOSApi.getUser();
  const isRealStudent=!!(user&&user.role==='STUDENT'&&window.SchoolOSApi.getAccessToken());
  if(!isRealStudent){
    const msg='Sign in as a real student account to see live data (try student@greenfield.test).';
    if(resultsBody)resultsBody.innerHTML=`<tr><td colspan="6">${msg}</td></tr>`;
    if(attendanceBody)attendanceBody.innerHTML=`<tr><td colspan="3">${msg}</td></tr>`;
    if(assignmentsBody)assignmentsBody.innerHTML=`<tr><td colspan="3">${msg}</td></tr>`;
    if(subjectsBody)subjectsBody.innerHTML=`<tr><td colspan="2">${msg}</td></tr>`;
    if(noticesBody)noticesBody.innerHTML=`<tr><td colspan="3">${msg}</td></tr>`;
    if(profileCard)profileCard.innerHTML=`<p>${msg}</p>`;
    return;
  }

  if(subjectsBody){
    subjectsBody.innerHTML='<tr><td colspan="2">Loading…</td></tr>';
    try{
      const subjects=await window.SchoolOSApi.api('/portal/student/subjects');
      subjectsBody.innerHTML=subjects.length?subjects.map(s=>`<tr><td><strong>${s.subject?.name||'—'}</strong></td><td>${s.staffProfile?.user?s.staffProfile.user.firstName+' '+s.staffProfile.user.lastName:'—'}</td></tr>`).join(''):'<tr><td colspan="2">No subjects assigned to your class yet.</td></tr>';
    }catch(err){subjectsBody.innerHTML=`<tr><td colspan="2">Could not load subjects (${err.message})</td></tr>`}
  }

  if(noticesBody){
    noticesBody.innerHTML='<tr><td colspan="3">Loading…</td></tr>';
    try{
      const notices=await window.SchoolOSApi.api('/notifications/me');
      noticesBody.innerHTML=notices.length?notices.map(n=>`<tr><td><strong>${n.title}</strong><br><small>${n.body}</small></td><td>${new Date(n.createdAt).toLocaleString()}</td><td>${n.readAt?'<span class="status">Read</span>':'<span class="status pending">Unread</span>'}</td></tr>`).join(''):'<tr><td colspan="3">No notices yet.</td></tr>';
    }catch(err){noticesBody.innerHTML=`<tr><td colspan="3">Could not load notices (${err.message})</td></tr>`}
  }

  if(profileCard){
    profileCard.innerHTML='<p>Loading…</p>';
    try{
      const p=await window.SchoolOSApi.api('/portal/student/me');
      const cls=p.currentClassArm?`${p.currentClassArm.schoolClass.name} · ${p.currentClassArm.name}`:'Not yet assigned to a class';
      const guardians=p.guardianLinks.length?p.guardianLinks.map(g=>`${g.guardian.firstName} ${g.guardian.lastName} (${g.relationship.toLowerCase()})`).join(', '):'No guardian linked yet';
      profileCard.innerHTML=`<div class="modal-detail"><div class="modal-detail-row"><span>Name</span><strong>${p.firstName} ${p.lastName}</strong></div><div class="modal-detail-row"><span>Admission No.</span><strong>${p.admissionNo}</strong></div><div class="modal-detail-row"><span>Class</span><strong>${cls}</strong></div><div class="modal-detail-row"><span>Status</span><strong>${p.status}</strong></div><div class="modal-detail-row"><span>Gender</span><strong>${p.gender||'—'}</strong></div><div class="modal-detail-row"><span>Date of birth</span><strong>${p.dateOfBirth?new Date(p.dateOfBirth).toDateString():'—'}</strong></div><div class="modal-detail-row"><span>Guardian(s)</span><strong>${guardians}</strong></div></div>`;
      // The Home page greeting should reflect the actual linked Student
      // record (whichever one is currently "active"), not the login
      // account's own name; those can differ, and the student record is
      // the source of truth for "who this student is".
      const greeting=document.getElementById('greeting');
      if(greeting)greeting.textContent=`Good morning, ${p.firstName}.`;
    }catch(err){profileCard.innerHTML=`<p>Could not load profile (${err.message})</p>`}
  }

  if(resultsBody){
    resultsBody.innerHTML='<tr><td colspan="6">Loading…</td></tr>';
    try{
      const results=await window.SchoolOSApi.api('/portal/student/results');
      resultsBody.innerHTML=results.length?results.map(r=>`<tr><td>${r.subject?.name||'—'}</td><td>${r.term?.name||'—'}</td><td>${r.continuousAssessmentScore??'—'}</td><td>${r.examScore??'—'}</td><td>${r.totalScore??'—'}</td><td>${r.grade||'—'}</td></tr>`).join(''):'<tr><td colspan="6">No published results yet.</td></tr>';
    }catch(err){resultsBody.innerHTML=`<tr><td colspan="6">Could not load results (${err.message})</td></tr>`}
  }

  if(attendanceBody){
    attendanceBody.innerHTML='<tr><td colspan="3">Loading…</td></tr>';
    try{
      const records=await window.SchoolOSApi.api('/portal/student/attendance');
      attendanceBody.innerHTML=records.length?records.map(r=>`<tr><td>${new Date(r.date).toDateString()}</td><td><span class="status ${r.status!=='PRESENT'?'pending':''}">${r.status}</span></td><td>${r.correctionReason||'—'}</td></tr>`).join(''):'<tr><td colspan="3">No attendance records yet.</td></tr>';
    }catch(err){attendanceBody.innerHTML=`<tr><td colspan="3">Could not load attendance (${err.message})</td></tr>`}
  }

  if(assignmentsBody){
    assignmentsBody.innerHTML='<tr><td colspan="3">Loading…</td></tr>';
    try{
      const assignments=await window.SchoolOSApi.api('/portal/student/assignments');
      assignmentsBody.innerHTML=assignments.length?assignments.map(a=>`<tr><td><strong>${a.title}</strong></td><td>${a.description}</td><td>${a.dueDate?new Date(a.dueDate).toDateString():'—'}</td></tr>`).join(''):'<tr><td colspan="3">No assignments posted yet.</td></tr>';
    }catch(err){assignmentsBody.innerHTML=`<tr><td colspan="3">Could not load assignments (${err.message})</td></tr>`}
  }
}
window.loadRealStudentPortalData=loadRealStudentPortalData;
/** Real "Take attendance": roster from /students?classArmId=, submitted
 * in one call via POST /attendance/bulk (the backend's own bulk endpoint,
 * built exactly for this "whole class at once" workflow). */
async function openTakeRealAttendanceModal(classArmId){
  if(!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken()){toast('Sign in as a teacher to take attendance');return}
  let students=[],term;
  try{
    students=await window.SchoolOSApi.api('/students?classArmId='+classArmId);
    const sessions=await window.SchoolOSApi.api('/academic-sessions');
    const session=sessions.find(s=>s.isCurrent)||sessions[0];
    if(!session){toast('No academic session found');return}
    const terms=await window.SchoolOSApi.api('/academic-sessions/'+session.id+'/terms');
    term=terms.find(t=>t.isCurrent)||terms[0];
    if(!term){toast('No term found for the current session');return}
  }catch(err){toast(`Could not load roster (${err.message})`);return}
  if(!students.length){toast('No students in this class yet');return}

  const rowsHtml=students.map((s,i)=>`<div class="attendance-row"><span class="person-cell"><span class="mini-avatar">${initialsOf(s.firstName+' '+s.lastName)}</span>${s.firstName} ${s.lastName}</span><div class="attendance-toggle"><label><input type="radio" name="status-${i}" value="PRESENT" checked>Present</label><label><input type="radio" name="status-${i}" value="LATE">Late</label><label><input type="radio" name="status-${i}" value="ABSENT">Absent</label></div></div>`).join('');
  openModal(`<p class="eyebrow">Attendance</p><h2>Take attendance · ${term.name}</h2><form onsubmit="__realAttendanceSubmit(event)"><div class="attendance-list">${rowsHtml}</div><div class="form-actions"><button type="button" class="outline-button" data-modal-close>Cancel</button><button type="submit" class="new-button">Save attendance</button></div></form>`);

  window.__realAttendanceSubmit=async(e)=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const entries=students.map((s,i)=>({studentId:s.id,status:fd.get('status-'+i)}));
    const btn=e.target.querySelector('button[type=submit]');
    btn.disabled=true;btn.textContent='Saving…';
    try{
      await window.SchoolOSApi.api('/attendance/bulk',{method:'POST',body:JSON.stringify({
        classArmId,termId:term.id,date:new Date().toISOString().slice(0,10),entries,
      })});
      closeModal();
      toast('Attendance saved');
      loadRealTeacherAttendance();
    }catch(err){
      toast(`Could not save attendance (${err.message})`);
      btn.disabled=false;btn.textContent='Save attendance';
    }
  };
}
function pageAttendanceTeacherReal(label){
  return `<section class="page workspace-page" id="attendance"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Take today's register for your classes.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Class</th><th>Latest register</th><th></th></tr></thead><tbody id="realTeacherAttendanceBody"><tr><td colspan="3">Sign in as a teacher to load classes…</td></tr></tbody></table></section></section>`;
}
async function loadRealTeacherAttendance(){
  const tbody=document.getElementById('realTeacherAttendanceBody');
  if(!tbody||!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken())return;
  tbody.innerHTML='<tr><td colspan="3">Loading…</td></tr>';
  try{
    const arms=await window.SchoolOSApi.api('/portal/teacher/class-arms');
    if(!arms.length){tbody.innerHTML='<tr><td colspan="3">You are not assigned to any class yet.</td></tr>';return}
    const rows=await Promise.all(arms.map(async a=>{
      let note='No register yet';
      try{
        const records=await window.SchoolOSApi.api('/attendance?classArmId='+a.id);
        if(records.length){
          const latestDate=records[0].date;
          const sameDay=records.filter(r=>r.date===latestDate);
          const present=sameDay.filter(r=>r.status==='PRESENT').length;
          note=`${new Date(latestDate).toDateString()} · ${present}/${sameDay.length} present`;
        }
      }catch(err){/* leave the default "No register yet" note */}
      return `<tr><td>${a.schoolClassName} · ${a.armName}</td><td>${note}</td><td class="row-action"><button class="new-button" data-take-real-attendance="${a.id}">Take attendance</button></td></tr>`;
    }));
    tbody.innerHTML=rows.join('');
  }catch(err){
    tbody.innerHTML=`<tr><td colspan="3">Could not load classes (${err.message})</td></tr>`;
  }
}
window.loadRealTeacherAttendance=loadRealTeacherAttendance;
function pageAttendanceOverviewReal(label){
  return `<section class="page workspace-page" id="attendance"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Latest register per class.</p></div></div><div class="screen-kpis"><article class="screen-kpi"><p>Classes tracked</p><strong id="attendanceOverviewClassCount">—</strong><small>Live count</small></article><article class="screen-kpi"><p>School attendance today</p><strong>Coming soon</strong><small>No aggregation built yet</small></article><article class="screen-kpi"><p>Flagged absentees</p><strong>Coming soon</strong><small>No flagging logic built yet</small></article></div><section class="data-card"><table class="data-table"><thead><tr><th>Class</th><th>Latest register</th></tr></thead><tbody id="realAttendanceOverviewBody"><tr><td colspan="2">Sign in to load classes…</td></tr></tbody></table></section></section>`;
}
async function loadRealAttendanceOverview(){
  const tbody=document.getElementById('realAttendanceOverviewBody');
  const countEl=document.getElementById('attendanceOverviewClassCount');
  if(!tbody||!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken())return;
  tbody.innerHTML='<tr><td colspan="2">Loading…</td></tr>';
  try{
    const classes=await window.SchoolOSApi.api('/classes');
    const arms=classes.flatMap(c=>(c.arms||[]).map(a=>({id:a.id,label:c.name+' · '+a.name})));
    if(countEl)countEl.textContent=arms.length;
    if(!arms.length){tbody.innerHTML='<tr><td colspan="2">No classes yet.</td></tr>';return}
    const rows=await Promise.all(arms.map(async a=>{
      let note='No register yet';
      try{
        const records=await window.SchoolOSApi.api('/attendance?classArmId='+a.id);
        if(records.length){
          const latestDate=records[0].date;
          const sameDay=records.filter(r=>r.date===latestDate);
          const present=sameDay.filter(r=>r.status==='PRESENT').length;
          note=`${new Date(latestDate).toDateString()} · ${present}/${sameDay.length} present`;
        }
      }catch(err){/* leave the default "No register yet" note */}
      return `<tr><td>${a.label}</td><td>${note}</td></tr>`;
    }));
    tbody.innerHTML=rows.join('');
  }catch(err){
    tbody.innerHTML=`<tr><td colspan="2">Could not load classes (${err.message})</td></tr>`;
  }
}
window.loadRealAttendanceOverview=loadRealAttendanceOverview;
function pageAttendanceSelf(label){
  if(activeRole==='student'){
    return `<section class="page workspace-page" id="attendance"><div class="page-heading"><div><p class="eyebrow">Attendance</p><h1>${label}</h1><p class="subtitle">Live from the API, your attendance history.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Date</th><th>Class</th><th>Status</th></tr></thead><tbody id="realStudentAttendanceBody"><tr><td colspan="3">Sign in as a student to load attendance…</td></tr></tbody></table></section></section>`;
  }
  return `<section class="page workspace-page" id="attendance"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Attendance history for your children.</p></div></div><div id="realParentAttendanceBlocks"><p class="modal-sub">Sign in as a parent to load attendance…</p></div></section>`;
}
/** Same pattern as loadRealParentResults; real children, one attendance
 * call per child via /portal/parent/children/:id/attendance. */
async function loadRealParentAttendance(){
  const container=document.getElementById('realParentAttendanceBlocks');
  if(!container||!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken())return;
  container.innerHTML='<p class="modal-sub">Loading…</p>';
  try{
    const children=await window.SchoolOSApi.api('/portal/parent/children');
    if(!children.length){
      container.innerHTML='<div class="data-card"><div class="empty-state"><span class="mini-avatar">✓</span><h3>No children linked yet</h3><p>Ask the school to link your account to your child’s record.</p></div></div>';
      return;
    }
    const blocks=await Promise.all(children.map(async link=>{
      const s=link.student;
      let rows='<tr><td colspan="2">Loading…</td></tr>';
      try{
        const records=await window.SchoolOSApi.api('/portal/parent/children/'+s.id+'/attendance');
        rows=records.length?records.map(r=>`<tr><td>${new Date(r.date).toDateString()}</td><td><span class="status ${r.status!=='PRESENT'?'pending':''}">${r.status}</span></td></tr>`).join(''):'<tr><td colspan="2">No attendance records yet.</td></tr>';
      }catch(err){rows=`<tr><td colspan="2">Could not load (${err.message})</td></tr>`}
      return `<section class="data-card fee-child-card"><div class="data-toolbar"><div class="person-cell"><span class="mini-avatar">${initialsOf(s.firstName+' '+s.lastName)}</span><div><strong>${s.firstName} ${s.lastName}</strong><small>${s.admissionNo}</small></div></div></div><table class="data-table"><thead><tr><th>Date</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    }));
    container.innerHTML=`<div class="fee-child-grid">${blocks.join('')}</div>`;
  }catch(err){
    container.innerHTML=`<p class="modal-sub">Could not load your children (${err.message})</p>`;
  }
}
window.loadRealParentAttendance=loadRealParentAttendance;
function pageAttendance(label){
  if(activeRole==='teacher')return pageAttendanceTeacherReal(label);
  if(activeRole==='parent'||activeRole==='student')return pageAttendanceSelf(label);
  return pageAttendanceOverviewReal(label);
}

const payrollRun={period:'August 2026',stage:'approval',staffCount:214,totalGross:'₦38.2m',totalDeductions:'₦5.5m',totalNet:'₦32.7m'};
const payrollStages=[['draft','Draft'],['review','Review'],['approval','Approval'],['finalized','Finalized']];
const payrollRows=[
  {name:'Amina Yusuf',role:'Mathematics teacher',gross:'₦420,000',paye:'₦38,500',pension:'₦33,600',nhf:'₦10,500',net:'₦337,400',status:'Ready'},
  {name:'Tunde Bello',role:'Class teacher',gross:'₦380,000',paye:'₦32,100',pension:'₦30,400',nhf:'₦9,500',net:'₦308,000',status:'Ready'},
  {name:'Chinwe Okafor',role:'Bursar',gross:'₦520,000',paye:'₦54,200',pension:'₦41,600',nhf:'₦13,000',net:'₦411,200',status:'Ready'},
  {name:'Miriam Danladi',role:'HR administrator',gross:'₦360,000',paye:'₦29,400',pension:'₦28,800',nhf:'₦9,000',net:'₦292,800',status:'Flagged'}
];
const salaryGrades=[
  {grade:'Grade 1 · Teaching (Junior)',basic:'₦180,000',housing:'₦54,000',transport:'₦36,000',other:'₦20,000',gross:'₦290,000'},
  {grade:'Grade 2 · Teaching (Senior)',basic:'₦230,000',housing:'₦69,000',transport:'₦46,000',other:'₦25,000',gross:'₦370,000'},
  {grade:'Grade 3 · Head of Department',basic:'₦280,000',housing:'₦84,000',transport:'₦56,000',other:'₦30,000',gross:'₦450,000'},
  {grade:'Grade 4 · Admin / Support',basic:'₦150,000',housing:'₦45,000',transport:'₦30,000',other:'₦15,000',gross:'₦240,000'},
  {grade:'Grade 5 · Management',basic:'₦360,000',housing:'₦108,000',transport:'₦72,000',other:'₦40,000',gross:'₦580,000'}
];
const payrollAdvances=[
  {name:'Amina Yusuf',type:'Salary advance',amount:'₦100,000',monthly:'₦20,000',balance:'₦60,000',status:'Active'},
  {name:'Tunde Bello',type:'Cooperative loan',amount:'₦250,000',monthly:'₦25,000',balance:'₦175,000',status:'Active'},
  {name:'Chinwe Okafor',type:'Salary advance',amount:'₦80,000',monthly:'₦40,000',balance:'₦0',status:'Completed'}
];
function openNewPayrollModal(){
  formModal({eyebrow:'Payroll',title:'Start new payroll run',sub:'Creates a fresh draft for the next pay period.',
    fields:[{name:'period',label:'Pay period',placeholder:'e.g. September 2026'}],
    submitLabel:'Create draft',
    onSubmit:d=>{payrollRun.period=d.period||'New pay period';payrollRun.stage='draft';payrollRows.forEach(r=>r.status='Ready');refresh();toast(`New payroll draft created · ${payrollRun.period}`)}
  });
}
function openEditSalaryGradeModal(gradeName){
  const g=salaryGrades.find(x=>x.grade===gradeName);if(!g)return;
  const num=v=>Number(String(v).replace(/[₦,]/g,''));
  formModal({eyebrow:'Salary structures',title:gradeName,
    fields:[{name:'basic',label:'Basic (₦)',type:'number',value:num(g.basic)},{name:'housing',label:'Housing (₦)',type:'number',value:num(g.housing)},{name:'transport',label:'Transport (₦)',type:'number',value:num(g.transport)},{name:'other',label:'Other allowances (₦)',type:'number',value:num(g.other)}],
    submitLabel:'Save',
    onSubmit:d=>{
      const basic=Number(d.basic)||0,housing=Number(d.housing)||0,transport=Number(d.transport)||0,other=Number(d.other)||0;
      g.basic=money(basic);g.housing=money(housing);g.transport=money(transport);g.other=money(other);g.gross=money(basic+housing+transport+other);
      refresh();toast(`Salary structure updated · ${gradeName}`);
    }
  });
}
function payrollActionsFor(){
  const stage=payrollRun.stage;
  if(activeRole==='proprietor'){
    if(stage==='approval')return `<button class="outline-button" data-payroll-stage="review" data-payroll-label="Sent back to review">Send back to review</button><button class="new-button" data-payroll-stage="finalized" data-payroll-label="Payroll finalised and queued for bank export">Approve payroll</button>`;
    if(stage==='finalized')return '<span class="view-only-badge">Finalized</span>';
    return '<span class="view-only-badge">Awaiting bursar / HR</span>';
  }
  if(activeRole==='bursar'||activeRole==='hr'){
    const newBtn=activeRole==='bursar'?'<button class="outline-button" data-modal="new-payroll">+ New payroll</button>':'';
    if(stage==='draft')return `${newBtn}<button class="new-button" data-payroll-stage="review" data-payroll-label="Payroll moved to review">Submit for review</button>`;
    if(stage==='review')return `${newBtn}<button class="new-button" data-payroll-stage="approval" data-payroll-label="Submitted for proprietor approval">Submit for approval</button>`;
    if(stage==='approval')return `${newBtn}<span class="view-only-badge">Awaiting proprietor approval</span>`;
    return `${newBtn}<span class="view-only-badge">Finalized</span>`;
  }
  return '<span class="view-only-badge">View only</span>';
}
function pagePayroll(label){
  const stageIndex=payrollStages.findIndex(([k])=>k===payrollRun.stage);
  const stepper=payrollStages.map(([k,t],i)=>`<div class="payroll-step ${i<stageIndex?'done':''} ${i===stageIndex?'current':''}"><span>Step ${i+1}</span>${t}</div>`).join('');
  const payrollActions=payrollActionsFor();
  const canEditStructures=activeRole==='proprietor'||activeRole==='hr';
  const kpis=[['Staff on this run',String(payrollRun.staffCount),payrollRun.period],['Total gross',payrollRun.totalGross,'Before deductions'],['Total deductions',payrollRun.totalDeductions,'PAYE, pension, NHF'],['Total net pay',payrollRun.totalNet,'Ready for bank export']];
  const rows=payrollRows.map(r=>`<tr class="${r.status==='Flagged'?'row-flagged':''}"><td><div class="person-cell"><span class="mini-avatar">${initialsOf(r.name)}</span><div><strong>${r.name}</strong><br><small>${r.role}</small></div></div></td><td>${r.gross}</td><td>${r.paye}</td><td>${r.pension}</td><td>${r.nhf}</td><td><strong>${r.net}</strong></td><td><span class="status ${r.status==='Flagged'?'pending':''}">${r.status}</span></td></tr>`).join('');
  const structureRows=salaryGrades.map(g=>`<tr><td><strong>${g.grade}</strong></td><td>${g.basic}</td><td>${g.housing}</td><td>${g.transport}</td><td>${g.other}</td><td><strong>${g.gross}</strong></td><td class="row-action">${canEditStructures?`<button class="outline-button" data-edit-salary-grade="${g.grade}">Edit</button>`:''}</td></tr>`).join('');
  const advanceRows=payrollAdvances.map(a=>`<tr><td><div class="person-cell"><span class="mini-avatar">${initialsOf(a.name)}</span>${a.name}</div></td><td>${a.type}</td><td>${a.amount}</td><td>${a.monthly}</td><td>${a.balance}</td><td><span class="status ${a.status!=='Completed'?'pending':''}">${a.status}</span></td></tr>`).join('');
  return `<section class="page workspace-page" id="${slug(label)}"><div class="page-heading"><div><p class="eyebrow">Payroll</p><h1>${label}</h1><p class="subtitle">${payrollRun.period} payroll run, draft through to finalization.</p></div><div class="payroll-actions">${payrollActions}</div></div><div class="payroll-stepper">${stepper}</div><div class="screen-tabs" data-tabs><button class="active" data-tab="run">Payroll run</button><button data-tab="structures">Salary structures</button><button data-tab="advances">Advances & loans</button></div><div data-tab-panel="run" class="tab-panel visible"><div class="screen-kpis">${kpis.map(s=>`<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('')}</div><div class="workspace-grid-main"><section class="data-card"><div class="data-toolbar"><input aria-label="Search staff" placeholder="Search staff on this run"><button class="filter-button">Status: all ⌄</button></div><table class="data-table"><thead><tr><th>Employee</th><th>Gross</th><th>PAYE</th><th>Pension</th><th>NHF</th><th>Net pay</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></section><aside class="workspace-aside"><section class="side-card"><p class="eyebrow">Payslip preview</p><h3>Miriam Danladi</h3><div class="payslip-lines"><div><span>Gross salary</span><b>₦360,000</b></div><div><span>PAYE</span><b>-₦29,400</b></div><div><span>Pension (8%)</span><b>-₦28,800</b></div><div><span>NHF (2.5%)</span><b>-₦9,000</b></div><div class="payslip-total"><span>Net pay</span><b>₦292,800</b></div></div><button class="outline-button" data-resolve-flag="Miriam Danladi">Resolve flag</button></section><section class="insight-strip"><p class="eyebrow">SchoolOS signal</p><h3>Ready to finalize</h3><p>213 of 214 payslips are ready. Resolve the flagged entry, then export the bank payment file.</p><a href="#" data-toast="Bank payment file exported">Export bank file →</a></section></aside></div></div><div data-tab-panel="structures" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Grade</th><th>Basic</th><th>Housing</th><th>Transport</th><th>Other allowances</th><th>Gross monthly</th><th></th></tr></thead><tbody>${structureRows}</tbody></table></section></div><div data-tab-panel="advances" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Employee</th><th>Type</th><th>Amount</th><th>Monthly deduction</th><th>Balance</th><th>Status</th></tr></thead><tbody>${advanceRows}</tbody></table></section></div></section>`;
}

const studentAssignments=[
  {subject:'Mathematics',title:'Quadratic equations worksheet',due:'28 Aug',status:'Not started'},
  {subject:'English',title:'Essay: My holiday',due:'26 Aug',status:'Submitted'},
  {subject:'Basic Science',title:'Photosynthesis lab report',due:'22 Aug',status:'Graded',score:'17/20'},
  {subject:'Civic Education',title:'Rights & responsibilities quiz',due:'20 Aug',status:'Graded',score:'9/10'},
  {subject:'French',title:'Vocabulary list: Unit 4',due:'18 Aug',status:'Overdue'}
];
function pageAssignmentsStudent(label){
  return `<section class="page workspace-page" id="assignments"><div class="page-heading"><div><p class="eyebrow">My work</p><h1>${label}</h1><p class="subtitle">Live from the API, everything posted for your class.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Assignment</th><th>Description</th><th>Due date</th></tr></thead><tbody id="realStudentAssignmentsBody"><tr><td colspan="3">Sign in as a student to load assignments…</td></tr></tbody></table></section></section>`;
}
function pageAssignmentsTeacher(label){
  return `<section class="page workspace-page" id="assignments"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Real assignments across the classes you teach.</p></div><button class="new-button" data-modal="new-assignment-real">+ New assignment</button></div><section class="data-card"><table class="data-table"><thead><tr><th>Assignment</th><th>Class</th><th>Subject</th><th>Due date</th></tr></thead><tbody id="realTeacherAssignmentsBody"><tr><td colspan="4">Sign in as a teacher to load assignments…</td></tr></tbody></table></section><p class="modal-sub" style="margin-top:14px">Submission tracking and an approval workflow aren't built on the backend yet: this is every real assignment you've posted, nothing more.</p></section>`;
}
async function loadRealTeacherAssignments(){
  const tbody=document.getElementById('realTeacherAssignmentsBody');
  if(!tbody||!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken())return;
  tbody.innerHTML='<tr><td colspan="4">Loading…</td></tr>';
  try{
    const arms=await window.SchoolOSApi.api('/portal/teacher/class-arms');
    if(!arms.length){tbody.innerHTML='<tr><td colspan="4">You are not assigned to any class yet.</td></tr>';return}
    const lists=await Promise.all(arms.map(a=>window.SchoolOSApi.api('/class-arms/'+a.id+'/assignments').then(list=>list.map(x=>({...x,armLabel:a.schoolClassName+' · '+a.armName})))));
    const assignments=lists.flat();
    tbody.innerHTML=assignments.length?assignments.map(a=>`<tr><td><strong>${a.title}</strong></td><td>${a.armLabel}</td><td>${a.subject?a.subject.name:'—'}</td><td>${a.dueDate?new Date(a.dueDate).toDateString():'—'}</td></tr>`).join(''):'<tr><td colspan="4">No assignments posted yet.</td></tr>';
  }catch(err){
    tbody.innerHTML=`<tr><td colspan="4">Could not load assignments (${err.message})</td></tr>`;
  }
}
window.loadRealTeacherAssignments=loadRealTeacherAssignments;
function pageAssignments(label){return activeRole==='teacher'?pageAssignmentsTeacher(label):pageAssignmentsStudent(label)}

const cbtExams=[
  {id:'math-cbt',subject:'Mathematics',title:'Third term CBT: Algebra & Geometry',duration:'3 min',questions:5,status:'Not started'},
  {subject:'English',title:'Third term CBT: Comprehension',duration:'40 min',questions:25,status:'Not started'},
  {subject:'Basic Science',title:'Third term CBT: Living things',duration:'30 min',questions:20,status:'Completed',score:'16/20'},
  {subject:'Social Studies',title:'Third term CBT: Government',duration:'30 min',questions:20,status:'In progress'}
];
const examQuestionBank={
  'math-cbt':{duration:180,questions:[
    {q:'Solve for x: 2x + 5 = 17',options:['x = 5','x = 6','x = 7','x = 8'],correct:1},
    {q:'What is the sum of interior angles in a triangle?',options:['90°','180°','270°','360°'],correct:1},
    {q:'Simplify: 3(x + 4) − 2x',options:['x + 12','x + 4','5x + 12','x − 12'],correct:0},
    {q:'The area of a circle with radius 7cm is (use π = 22/7)',options:['154 cm²','44 cm²','22 cm²','77 cm²'],correct:0},
    {q:'If y = 2x + 3 and x = 4, what is y?',options:['9','10','11','12'],correct:2}
  ]}
};
function pageCbtExamsStudent(label){
  return `<section class="page workspace-page" id="cbt-exams"><div class="page-heading"><div><p class="eyebrow">Computer-based tests</p><h1>${label}</h1><p class="subtitle">No CBT exam data source is built yet: this isn't showing you fake data.</p></div></div><section class="data-card"><div class="empty-state"><span class="mini-avatar">✓</span><h3>Not available yet</h3><p>CBT exams (questions, timed attempts, auto-grading) haven't been built on the backend — it's a real feature, not a quick wire-up. Ask if you'd like it built.</p></div></section></section>`;
}
const teacherExams=[
  {title:'Third term CBT: Algebra & Geometry',cls:'JSS 2A',questions:30,status:'Published'},
  {title:'Mid-term mock test',cls:'JSS 2A',questions:15,status:'Pending approval'},
  {title:'Quick quiz: Fractions',cls:'JSS 2B',questions:10,status:'Draft'}
];
function pageCbtExamsTeacher(label){
  const kpis=[['Published','1','Live for students'],['Pending approval','1','Awaiting principal sign-off'],['Drafts','1','Question bank in progress'],['Avg completion','92%','Across published exams']];
  const actionFor=e=>e.status==='Draft'?`<button class="outline-button" data-submit-teacher-exam="${e.title}">Submit for approval</button>`:e.status==='Pending approval'?'<span class="view-only-badge">Awaiting approval</span>':`<button class="outline-button" data-view-exam-results="${e.title}">View results</button>`;
  const rows=teacherExams.map(e=>`<tr class="${e.rejectionReason?'row-flagged':''}"><td><strong>${e.title}</strong>${e.rejectionReason?`<br><small class="reason-note">Sent back: ${e.rejectionReason}</small>`:''}</td><td>${e.cls}</td><td>${e.questions} questions</td><td><span class="status ${e.status!=='Published'?'pending':''}">${e.status}</span></td><td class="row-action">${actionFor(e)}</td></tr>`).join('');
  return `<section class="page workspace-page" id="cbt-exams"><div class="page-heading"><div><p class="eyebrow">Set & manage exams</p><h1>${label}</h1><p class="subtitle">Build CBT question sets for your classes. New exams are reviewed before they go live.</p></div><button class="new-button" data-modal="new-exam">+ New CBT exam</button></div><div class="screen-kpis">${kpis.map(s=>`<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('')}</div><section class="data-card"><table class="data-table"><thead><tr><th>Exam</th><th>Class</th><th>Length</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></section></section>`;
}
function pageCbtExam(label){return activeRole==='teacher'?pageCbtExamsTeacher(label):pageCbtExamsStudent(label)}
let cbtState=null;
function cbtRenderGrid(){const bank=examQuestionBank[cbtState.id];document.getElementById('cbtQGrid').innerHTML=bank.questions.map((_,i)=>`<button data-q="${i}" class="${i===cbtState.current?'current':''} ${cbtState.answers[i]!==null?'answered':''}">${i+1}</button>`).join('')}
function cbtRenderQuestion(){
  const bank=examQuestionBank[cbtState.id],q=bank.questions[cbtState.current];
  document.getElementById('cbtQNum').textContent=`Question ${cbtState.current+1} of ${bank.questions.length}`;
  document.getElementById('cbtQText').textContent=q.q;
  document.getElementById('cbtOptions').innerHTML=q.options.map((o,i)=>`<button class="cbt-option ${cbtState.answers[cbtState.current]===i?'selected':''}" data-opt="${i}">${o}</button>`).join('');
  document.getElementById('cbtPrevBtn').disabled=cbtState.current===0;
  document.getElementById('cbtNextBtn').textContent=cbtState.current===bank.questions.length-1?'Finish':'Next →';
  cbtRenderGrid();
}
function cbtRenderTimer(){const m=String(Math.floor(cbtState.remaining/60)).padStart(2,'0'),s=String(cbtState.remaining%60).padStart(2,'0');document.getElementById('cbtTimer').textContent=`${m}:${s}`}
function cbtTick(){cbtState.remaining--;cbtRenderTimer();if(cbtState.remaining<=0)cbtSubmitExam()}
function startCbtExam(id){
  const bank=examQuestionBank[id],exam=cbtExams.find(e=>e.id===id);
  if(!bank)return;
  cbtState={id,answers:new Array(bank.questions.length).fill(null),current:0,remaining:bank.duration,timer:null};
  document.getElementById('cbtExamSubject').textContent=exam.subject;
  document.getElementById('cbtExamTitle').textContent=exam.title;
  document.getElementById('cbtListView').style.display='none';
  document.getElementById('cbtResultView').style.display='none';
  document.getElementById('cbtRunner').style.display='block';
  cbtRenderQuestion();
  cbtRenderTimer();
  cbtState.timer=setInterval(cbtTick,1000);
}
function cbtSelectOption(i){cbtState.answers[cbtState.current]=i;cbtRenderQuestion()}
function cbtGoTo(i){cbtState.current=i;cbtRenderQuestion()}
function cbtNext(){const bank=examQuestionBank[cbtState.id];if(cbtState.current<bank.questions.length-1){cbtState.current++;cbtRenderQuestion()}else cbtSubmitExam()}
function cbtPrev(){if(cbtState.current>0){cbtState.current--;cbtRenderQuestion()}}
function cbtSubmitExam(){
  clearInterval(cbtState.timer);
  const bank=examQuestionBank[cbtState.id],total=bank.questions.length,correct=bank.questions.filter((q,i)=>cbtState.answers[i]===q.correct).length,pct=Math.round(correct/total*100);
  document.getElementById('cbtRunner').style.display='none';
  const rv=document.getElementById('cbtResultView');
  rv.style.display='block';
  rv.innerHTML=`<section class="data-card cbt-result-card"><p class="eyebrow">Exam submitted</p><h2>${correct} / ${total} correct</h2><div class="cbt-score-bar"><span style="width:${pct}%"></span></div><p class="cbt-score-note">${pct>=50?'Well done. You passed.':'Keep practising. Review the topics you missed.'}</p><button class="new-button" id="cbtBackBtn">Back to exams</button></section>`;
  cbtState=null;
}

const parentChildren=[
  {name:'Ada Okon',guardian:'Nneka Okon',cls:'SS 1A · Ikoyi campus',attendance:'96%',feeBalance:'₦0',feeStatus:'Paid',lastResult:'2nd position · Third term CA'},
  {name:'Emeka Okon',guardian:'Nneka Okon',cls:'JSS 2A · Ikoyi campus',attendance:'91%',feeBalance:'₦45,000',feeStatus:'Pending',lastResult:'5th position · Third term CA'}
];
function pageMyChildren(label){
  const kpis=[['Children enrolled',String(parentChildren.length),`Linked to ${parentChildren[0]?.guardian||'you'}`],['Fees outstanding','₦45,000','1 child has a pending balance'],['Average attendance','93.5%','Across both children'],['Unread messages','3','From class teachers']];
  const cards=parentChildren.map(c=>`<article class="child-card"><div class="person-cell"><span class="mini-avatar">${initialsOf(c.name)}</span><div><strong>${c.name}</strong><small>${c.cls}</small></div></div><div class="child-stats"><div><span>Attendance</span><strong>${c.attendance}</strong></div><div><span>Fee balance</span><strong>${c.feeBalance}</strong></div><div><span>Last result</span><strong>${c.feeStatus==='Paid'?'On track':'Review'}</strong></div></div><p class="child-note">${c.lastResult}</p><div class="child-actions"><button class="outline-button" data-view-child-results="${c.name}">View results</button>${c.feeStatus==='Pending'?`<button class="new-button" data-pay-child="${c.name}">Pay ${c.feeBalance}</button>`:`<button class="outline-button" data-view-child-attendance="${c.name}">View attendance</button>`}</div></article>`).join('');
  return `<section class="page workspace-page" id="my-children"><div class="page-heading"><div><p class="eyebrow">Your family</p><h1>${label}</h1><p class="subtitle">Fees, attendance and results for every child, in one place.</p></div></div><div class="screen-kpis">${kpis.map((s,i)=>`<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small class="${i===1?'warn':''}">${s[2]}</small></article>`).join('')}</div><div class="child-grid">${cards}</div></section>`;
}

function pageStudentClasses(label){
  return `<section class="page workspace-page" id="${slug(label)}"><div class="page-heading"><div><p class="eyebrow">My classes</p><h1>${label}</h1><p class="subtitle">Live from the API, subjects and teachers for your class.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Subject</th><th>Teacher</th></tr></thead><tbody id="realStudentSubjectsBody"><tr><td colspan="2">Sign in as a student to load subjects…</td></tr></tbody></table></section></section>`;
}
function pageTimetable(label){
  if(activeRole==='student'){
    return `<section class="page workspace-page" id="${slug(label)}"><div class="page-heading"><div><p class="eyebrow">My timetable</p><h1>${label}</h1><p class="subtitle">No timetable data source is built yet: this isn't showing you fake data.</p></div></div><section class="data-card"><div class="empty-state"><span class="mini-avatar">▤</span><h3>Not available yet</h3><p>Timetable scheduling hasn't been built on the backend. When it is, this page will show your real weekly schedule.</p></div></section></section>`;
  }
  if(activeRole==='teacher'){
    const cls=teacherClassMap['Tunde Bello']?.cls||'JSS 2A';
    const grid=classTimetables[cls]||classTimetables['JSS 2A'];
    const ttRows=timetablePeriods.map((p,r)=>`<tr><td class="tt-period">${p}</td>${timetableDays.map((d,c)=>`<td class="${grid[r][c].startsWith('—')?'tt-break':''}">${grid[r][c]}</td>`).join('')}</tr>`).join('');
    return `<section class="page workspace-page" id="${slug(label)}"><div class="page-heading"><div><p class="eyebrow">My timetable</p><h1>${label}</h1><p class="subtitle">${cls} · Third term. Set by the academic team.</p></div></div><section class="data-card"><table class="data-table timetable-grid"><thead><tr><th></th>${timetableDays.map(d=>`<th>${d}</th>`).join('')}</tr></thead><tbody>${ttRows}</tbody></table></section></section>`;
  }
  return pageMarkup(label);
}
function pageStudentResults(label){
  return `<section class="page workspace-page" id="${slug(label)}"><div class="page-heading"><div><p class="eyebrow">Results</p><h1>${label}</h1><p class="subtitle">Live from the API, every published result for your account.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Subject</th><th>Term</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th></tr></thead><tbody id="realStudentResultsBody"><tr><td colspan="6">Sign in as a student to load results…</td></tr></tbody></table></section></section>`;
}
function pageParentResults(label){
  return `<section class="page workspace-page" id="${slug(label)}"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Published results for your linked children.</p></div></div><div id="realParentResultsBlocks"><p class="modal-sub">Sign in as a parent to load results…</p></div></section>`;
}
/** Fetches real linked children once (GuardiansService.myChildren via
 * /portal/parent/children), then one results call per child; a parent
 * with no linked students yet gets an honest empty state, not fake
 * children (there are currently no real StudentGuardian links seeded). */
async function loadRealParentResults(){
  const container=document.getElementById('realParentResultsBlocks');
  if(!container||!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken())return;
  container.innerHTML='<p class="modal-sub">Loading…</p>';
  try{
    const children=await window.SchoolOSApi.api('/portal/parent/children');
    if(!children.length){
      container.innerHTML='<div class="data-card"><div class="empty-state"><span class="mini-avatar">♥</span><h3>No children linked yet</h3><p>Ask the school to link your account to your child’s record.</p></div></div>';
      return;
    }
    const blocks=await Promise.all(children.map(async link=>{
      const s=link.student;
      let rows='<tr><td colspan="4">Loading…</td></tr>';
      try{
        const results=await window.SchoolOSApi.api('/portal/parent/children/'+s.id+'/results');
        rows=results.length?results.map(r=>`<tr><td>${r.subject?.name||'—'}</td><td>${r.term?.name||'—'}</td><td>${r.totalScore??'—'}</td><td>${r.grade||'—'}</td></tr>`).join(''):'<tr><td colspan="4">No published results yet.</td></tr>';
      }catch(err){rows=`<tr><td colspan="4">Could not load (${err.message})</td></tr>`}
      return `<section class="data-card fee-child-card"><div class="data-toolbar"><div class="person-cell"><span class="mini-avatar">${initialsOf(s.firstName+' '+s.lastName)}</span><div><strong>${s.firstName} ${s.lastName}</strong><small>${s.admissionNo}</small></div></div></div><table class="data-table"><thead><tr><th>Subject</th><th>Term</th><th>Total</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    }));
    container.innerHTML=`<div class="fee-child-grid">${blocks.join('')}</div>`;
  }catch(err){
    container.innerHTML=`<p class="modal-sub">Could not load your children (${err.message})</p>`;
  }
}
window.loadRealParentResults=loadRealParentResults;
function pageResults(label){
  if(activeRole==='student')return pageStudentResults(label);
  if(activeRole==='parent')return pageParentResults(label);
  if(activeRole==='teacher')return pageTeacherResultsReal(label);
  return pageMarkup(label);
}
/** Real marks entry, teacher-only (CLAUDE.md: teachers "enter/submit
 * results, not approve/publish them"). Proprietor/Principal's Academics
 * → Marks entry tab stays the pre-existing mock display; this is the one
 * real, working "add marks" surface, and it's only ever rendered when
 * activeRole==='teacher'. */
function pageTeacherResultsReal(label){
  return `<section class="page workspace-page" id="${slug(label)}"><div class="page-heading"><div><p class="eyebrow">Live from the API</p><h1>${label}</h1><p class="subtitle">Enter marks for the subjects and classes you teach.</p></div><button class="new-button" data-modal="add-marks">+ Add marks</button></div><section class="data-card"><table class="data-table"><thead><tr><th>Student</th><th>Subject</th><th>Term</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody id="realTeacherResultsBody"><tr><td colspan="6">Sign in as a teacher to load results…</td></tr></tbody></table></section></section>`;
}
async function loadRealTeacherResults(){
  const tbody=document.getElementById('realTeacherResultsBody');
  if(!tbody||!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken())return;
  tbody.innerHTML='<tr><td colspan="6">Loading…</td></tr>';
  try{
    const results=await window.SchoolOSApi.api('/results');
    tbody.innerHTML=results.length?results.map(r=>`<tr><td>${r.student?r.student.firstName+' '+r.student.lastName:'—'}</td><td>${r.subject?.name||'—'}</td><td>${r.term?.name||'—'}</td><td>${r.totalScore??'—'}</td><td><span class="status ${r.status!=='PUBLISHED'?'pending':''}">${r.status}</span></td><td class="row-action">${r.status==='DRAFT'?`<button class="outline-button" data-submit-result="${r.id}">Submit</button>`:''}</td></tr>`).join(''):'<tr><td colspan="6">No marks entered yet.</td></tr>';
  }catch(err){
    tbody.innerHTML=`<tr><td colspan="6">Could not load results (${err.message})</td></tr>`;
  }
}
window.loadRealTeacherResults=loadRealTeacherResults;
async function submitResult(id){
  try{
    await window.SchoolOSApi.api('/results/'+id+'/submit',{method:'PATCH'});
    toast('Marks submitted for approval');
    loadRealTeacherResults();
  }catch(err){
    toast(`Could not submit (${err.message})`);
  }
}
/** Step 1 of "Add marks": which subject. Options come from the teacher's
 * own TeacherSubjectAssignment rows (GET /portal/teacher/classes); a
 * teacher only ever sees subjects they actually teach, "and they can
 * only upload for their subject only" is enforced again server-side by
 * POST /results regardless. */
async function openAddMarksModal(){
  if(!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken()){toast('Sign in as a teacher to add marks');return}
  let assignments=[];
  try{
    assignments=await window.SchoolOSApi.api('/portal/teacher/classes');
  }catch(err){toast(`Could not load your subjects (${err.message})`);return}
  if(!assignments.length){toast('You are not assigned to teach any subject yet');return}

  const subjectsById={};
  assignments.forEach(a=>{subjectsById[a.subject.id]=a.subject.name});
  const subjectNames=[...new Set(Object.values(subjectsById))];

  formModal({
    eyebrow:'Results',
    title:'Add marks',
    sub:'Pick the subject you want to enter marks for, you’ll then choose one or more of your classes.',
    fields:[{name:'subject',label:'Subject',type:'select',options:subjectNames}],
    submitLabel:'Continue',
    onSubmit:d=>{
      const subjectId=Object.keys(subjectsById).find(id=>subjectsById[id]===d.subject);
      const classAssignments=assignments.filter(a=>a.subject.id===subjectId);
      openMarksClassPickerModal(subjectId,d.subject,classAssignments);
    },
  });
}
/** Step 2: which of the teacher's classes for that subject; "they can
 * upload for multiple students in multiple classes", so this is a
 * checkbox group of arms (a SchoolClass assignment covers every arm
 * under it, so each class is expanded to its real arms for roster
 * purposes). */
async function openMarksClassPickerModal(subjectId,subjectName,classAssignments){
  if(!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken()){toast('Sign in as a teacher to add marks');return}
  let armOptions=[];
  try{
    const schoolClassIds=[...new Set(classAssignments.map(a=>a.schoolClass.id))];
    const schoolClasses=await Promise.all(schoolClassIds.map(id=>window.SchoolOSApi.api('/classes/'+id)));
    armOptions=schoolClasses.flatMap(c=>(c.arms||[]).map(a=>({value:a.id,label:`${c.name} · ${a.name}`})));
  }catch(err){toast(`Could not load your classes (${err.message})`);return}
  if(!armOptions.length){toast('None of your classes for this subject have any arms yet');return}

  formModal({
    eyebrow:'Results',
    title:`${subjectName} marks`,
    sub:'Choose one or more classes to load their student rosters.',
    fields:[{name:'armIds',label:'Classes',type:'checkboxes',options:armOptions}],
    submitLabel:'Load roster',
    onSubmit:async d=>{
      const armIds=[].concat(d.armIds||[]);
      if(!armIds.length){toast('Select at least one class');return}
      openMarksEntryModal(subjectId,subjectName,armIds,armOptions);
    },
  });
}
/** Step 3: the actual marks-entry grid; one row per student across every
 * selected arm, CA + Exam inputs, blank rows are skipped on save. Each
 * filled row becomes its own POST /results (DRAFT), same "loop one call
 * per item" pattern as the multi-class teacher-subject assignment flow. */
async function openMarksEntryModal(subjectId,subjectName,armIds,armOptions){
  let term;
  try{
    const sessions=await window.SchoolOSApi.api('/academic-sessions');
    const currentSession=sessions.find(s=>s.isCurrent)||sessions[0];
    if(!currentSession){toast('No academic session found');return}
    const terms=await window.SchoolOSApi.api(`/academic-sessions/${currentSession.id}/terms`);
    term=terms.find(t=>t.isCurrent)||terms[0];
    if(!term){toast('No term found for the current session');return}
  }catch(err){toast(`Could not load the current term (${err.message})`);return}

  const armLabel=Object.fromEntries(armOptions.map(a=>[a.value,a.label]));
  let students=[];
  try{
    const rosters=await Promise.all(armIds.map(id=>window.SchoolOSApi.api('/students?classArmId='+id)));
    students=rosters.flatMap((list,i)=>list.map(s=>({...s,armLabel:armLabel[armIds[i]]})));
  }catch(err){toast(`Could not load students (${err.message})`);return}
  if(!students.length){toast('No students found in the selected classes');return}

  const rowsHtml=students.map((s,i)=>`<div class="attendance-row"><span class="person-cell"><span class="mini-avatar">${initialsOf(s.firstName+' '+s.lastName)}</span>${s.firstName} ${s.lastName}<small style="display:block;color:var(--muted);font-size:10px">${s.armLabel}</small></span><input class="attendance-reason" name="ca-${i}" type="number" min="0" max="100" placeholder="CA /100"><input class="attendance-reason" name="exam-${i}" type="number" min="0" max="100" placeholder="Exam /100"></div>`).join('');

  openModal(`<p class="eyebrow">Results</p><h2>${subjectName} marks · ${term.name}</h2><p class="modal-sub">Leave a student blank to skip them. Marks save as drafts. Submit each for approval when ready.</p><form onsubmit="__marksSubmit(event)"><div class="attendance-list">${rowsHtml}</div><div class="form-actions"><button type="button" class="outline-button" data-modal-close>Cancel</button><button type="submit" class="new-button">Save marks</button></div></form>`);

  window.__marksSubmit=async(e)=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const btn=e.target.querySelector('button[type=submit]');
    btn.disabled=true;btn.textContent='Saving…';
    let saved=0,failed=0;
    for(let i=0;i<students.length;i++){
      const ca=fd.get('ca-'+i),exam=fd.get('exam-'+i);
      if(!ca&&!exam)continue;
      try{
        await window.SchoolOSApi.api('/results',{method:'POST',body:JSON.stringify({
          studentId:students[i].id,
          subjectId,
          academicSessionId:term.academicSessionId,
          termId:term.id,
          continuousAssessmentScore:ca?Number(ca):undefined,
          examScore:exam?Number(exam):undefined,
        })});
        saved++;
      }catch(err){failed++}
    }
    closeModal();
    toast(`${saved} mark${saved===1?'':'s'} saved${failed?` · ${failed} failed`:''}`);
    loadRealTeacherResults();
  };
}

const pendingApprovals=[
  {type:'Assignment',title:'Trigonometry practice set',teacher:'Mrs. Dada',cls:'JSS 2A',submitted:'24 Aug'},
  {type:'CBT Exam',title:'Mid-term mock test',teacher:'Mrs. Dada',cls:'JSS 2A',submitted:'23 Aug'},
  {type:'Assignment',title:'Photosynthesis diagram labelling',teacher:'Mr. Eze',cls:'SS 1A',submitted:'22 Aug'}
];
function pageContentApprovals(label){
  return `<section class="page workspace-page" id="content-approvals"><div class="page-heading"><div><p class="eyebrow">Academic content</p><h1>${label}</h1><p class="subtitle">No approval workflow is built yet: this isn't showing you fake data.</p></div></div><section class="data-card"><div class="empty-state"><span class="mini-avatar">✓</span><h3>Coming soon</h3><p>Assignments post directly today (see Assignments); a review/approval step before publishing hasn't been built on the backend. CBT exams have no data source at all yet.</p></div></section></section>`;
}

const messageDirectory=['Adetola Okon (Proprietor)','Bolanle Adeyemi (Principal)','Chinwe Okafor (Bursar)','Miriam Danladi (HR)','Mrs. Dada (Teacher)','Mr. James (Teacher)','Alhaji Ibrahim (Parent)','Mrs. Nwosu (Parent)','Nneka Okon (Parent)','Ada Okon (Student)'];
const sentMessages=[
  {to:'All JSS 2A parents',subject:'Third-term open day',date:'25 Aug',preview:'Reminder: open day is this Saturday at 10am in the main hall.'},
  {to:'Nneka Okon (Parent)',subject:'Fee balance reminder',date:'24 Aug',preview:'Kindly note ₦45,000 is outstanding for Emeka this term.'}
];
function openComposeModal(){
  formModal({eyebrow:'Messages',title:'New message',
    fields:[{name:'to',label:'Send to',type:'select',options:messageDirectory},{name:'subject',label:'Subject',placeholder:'e.g. Third-term update'},{name:'body',label:'Message',type:'textarea',placeholder:'Type your message'}],
    submitLabel:'Send message',
    onSubmit:d=>{sentMessages.unshift({to:d.to,subject:d.subject||'(no subject)',date:'Today',preview:(d.body||'').slice(0,90)});refresh();toast(`Message sent · ${d.to}`)}
  });
}
function pageMessages(label){
  const kpis=[['Sent this term',String(sentMessages.length),'Across all channels'],['Delivery rate','98.7%','SMS, email and in-app'],['Unread replies','3','Awaiting your response'],['Scheduled','1','Next notice queued']];
  const rows=sentMessages.map(m=>`<tr><td><strong>${m.subject}</strong></td><td>${m.to}</td><td>${m.date}</td><td>${m.preview}</td></tr>`).join('')||'<tr><td colspan="4">No messages sent yet</td></tr>';
  return `<section class="page workspace-page" id="${slug(label)}"><div class="page-heading"><div><p class="eyebrow">Communication</p><h1>${label}</h1><p class="subtitle">Message any parent, teacher or staff member directly.</p></div><button class="new-button" data-modal="compose-message">+ Compose message</button></div><div class="screen-kpis">${kpis.map(s=>`<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('')}</div><section class="data-card"><table class="data-table"><thead><tr><th>Subject</th><th>To</th><th>Date</th><th>Preview</th></tr></thead><tbody>${rows}</tbody></table></section></section>`;
}

const reportCatalog=[
  {name:'Fee collection by campus',scope:'Finance',updated:'Today, 08:30'},
  {name:'Attendance trend',scope:'Academics',updated:'Today, 07:50'},
  {name:'Staff compliance',scope:'HR',updated:'Yesterday, 18:10'},
  {name:'Payroll cost summary',scope:'Finance',updated:'2 days ago'},
  {name:'Admissions pipeline',scope:'Admissions',updated:'Today, 09:00'}
];
function pageReports(label){
  const rows=reportCatalog.map(r=>`<tr><td><strong>${r.name}</strong></td><td>${r.scope}</td><td>${r.updated}</td><td class="row-action"><div class="row-actions"><button class="outline-button" data-toast="Generating report · ${r.name}">Generate</button><button class="new-button" data-toast="Report downloaded · ${r.name}">Download</button></div></td></tr>`).join('');
  return `<section class="page workspace-page" id="${slug(label)}"><div class="page-heading"><div><p class="eyebrow">Insights</p><h1>${label}</h1><p class="subtitle">Generate and download reports across your school.</p></div></div><section class="data-card"><table class="data-table"><thead><tr><th>Report</th><th>Scope</th><th>Last updated</th><th></th></tr></thead><tbody>${rows}</tbody></table></section></section>`;
}

function renderNav(role){nav.innerHTML=`<p class="nav-label">${roles[role].title} workspace</p>${navs[role].map((item,i)=>{const view=i===0?'dashboard':slug(item);return `<a class="nav-link ${i===0?'active':''}" href="#${view}" data-view="${view}"><span>${icons[i%icons.length]}</span>${item}${item==='Fees & payments'?'<b>38</b>':''}</a>`}).join('')}`;const mobile=role==='parent'||role==='student';document.getElementById('mobileBottomNav').innerHTML=mobile?navs[role].slice(0,5).map((item,i)=>`<a class="${i===0?'active':''}" href="#${i===0?'dashboard':slug(item)}" data-view="${i===0?'dashboard':slug(item)}"><span>${icons[i]}</span>${item}</a>`).join(''):'';bindNavigation()}
const dashboardScopes={proprietor:['fees','payroll','staff','students','academics','finance'],principal:['fees','payroll','staff','students','academics'],bursar:['fees','payroll','staff','students','finance'],hr:['payroll','staff','students'],teacher:['academics','students'],parent:[],student:[],operations:[],superadmin:[],compliance:['payroll']};
/** Fills the Control Center's real numbers: student/staff totals, real
 * campuses with real per-campus student counts, and the submitted-results
 * count that feeds both the "Academics" attention card and the
 * Proprietor/Principal workspace cards. Each fetch is independent
 * (Promise.all would let one 403, /staff-profiles isn't open to every
 * role, block the others that would have succeeded). Anything with no
 * live source yet (attendance %, fee collection) stays a plain "Coming
 * soon" cell rather than a fabricated number. */
async function loadRealDashboardMetrics(){
  if(!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken())return;
  const studentsEl=document.getElementById('dashStudentsCount');
  const staffEl=document.getElementById('dashStaffCount');
  const campusRows=document.getElementById('dashCampusRows');

  let students=[];
  try{
    students=await window.SchoolOSApi.api('/students');
    if(studentsEl)studentsEl.textContent=students.length.toLocaleString();
  }catch(err){
    if(studentsEl)studentsEl.textContent='—';
  }

  if(staffEl){
    try{
      const staff=await window.SchoolOSApi.api('/staff-profiles');
      staffEl.textContent=staff.length.toLocaleString();
    }catch(err){
      staffEl.textContent='—';
    }
  }

  if(campusRows){
    try{
      const campuses=await window.SchoolOSApi.api('/campuses');
      const countByCampus={};
      students.forEach(s=>{countByCampus[s.campusId]=(countByCampus[s.campusId]||0)+1});
      campusRows.innerHTML=campuses.length?campuses.map(c=>`<tr><td><span class="dot green"></span>${c.name}</td><td>${countByCampus[c.id]||0}</td><td>Coming soon</td><td>Coming soon</td></tr>`).join(''):'<tr><td colspan="4">No campuses yet.</td></tr>';
    }catch(err){
      campusRows.innerHTML=`<tr><td colspan="4">Could not load campuses (${err.message})</td></tr>`;
    }
  }

  try{
    const results=await window.SchoolOSApi.api('/results');
    realDashboardStats.submittedResults=results.filter(r=>r.status==='SUBMITTED').length;
  }catch(err){
    realDashboardStats.submittedResults=0;
  }
  // Re-run just the two bits that read realDashboardStats; not the full
  // renderDashboard(), which would reset #greeting back to the mock
  // persona name and undo loadRealStudentPortalData()'s real-name patch.
  applyPrincipalDashboardCopy(activeRole);
  const workspaceGrid=document.getElementById('workspaceGrid');
  if(workspaceGrid)workspaceGrid.innerHTML=workspaceCardsFor(activeRole).map(x=>`<article class="workspace-card"${x[3]?` data-goto-page="${x[3]}"`:''}><div class="workspace-icon">${x[0]}</div><h3>${x[1]}</h3><p>${x[2]}</p></article>`).join('');
}
window.loadRealDashboardMetrics=loadRealDashboardMetrics;
function applyDashboardScope(role){
  const scopes=new Set(dashboardScopes[role]||[]);
  const hideRevenue=revenueRestrictedRoles.has(role);
  document.querySelectorAll('[data-scope]').forEach(el=>{el.style.display=(scopes.has(el.dataset.scope)&&!(hideRevenue&&el.dataset.sensitive==='revenue'))?'':'none'});
  const attentionVisible=document.querySelectorAll('.attention-grid [data-scope]:not([style*="display: none"])').length;
  document.querySelector('.attention-section span').textContent=attentionVisible;
  document.querySelector('.attention-section').style.display=attentionVisible?'':'none';
  document.querySelector('.metrics').style.display=document.querySelectorAll('.metric-grid [data-scope]:not([style*="display: none"])').length?'':'none';
  document.querySelector('.lower-grid').style.display=document.querySelectorAll('.lower-grid [data-scope]:not([style*="display: none"])').length?'':'none';
}
const dashboardFeesCopy={
  proprietor:['₦8.4m is overdue','Families have missed payment by more than 30 days.'],
  principal:['Fees are overdue','Flag it to the bursar, revenue figures aren’t shown here.']
};
const revenueRestrictedRoles=new Set(['principal']);
function payrollCardCopyFor(role){
  const stage=payrollRun.stage,period=payrollRun.period;
  if(role==='proprietor'){
    if(stage==='approval')return['August payroll is ready','Awaiting your final approval.'];
    if(stage==='finalized')return['Payroll finalised',`${period} is ready for bank export.`];
    if(stage==='review')return['Payroll in review','Bursar and HR are reviewing before it reaches you.'];
    return['Payroll draft in progress',`The bursar has started ${period}.`];
  }
  if(role==='bursar'||role==='hr'){
    if(stage==='draft')return['Payroll draft in progress',`Continue preparing ${period}.`];
    if(stage==='review')return['Payroll in review','Check the run before submitting for approval.'];
    if(stage==='approval')return['Payroll submitted','Awaiting the owner’s final approval.'];
    return['Payroll finalised',`${period} is ready for bank export.`];
  }
  if(role==='compliance'){
    if(stage==='finalized')return['Payroll finalised',`Run a compliance check on ${period}.`];
    return['Payroll in progress','Review statutory deductions before it is finalised.'];
  }
  if(stage==='finalized')return['Payroll finalised',`${period} has been paid out.`];
  if(stage==='approval')return['Payroll is with the owner','Prepared by the bursar, awaiting final approval.'];
  if(stage==='review')return['Payroll in review','The bursar and HR are checking it before approval.'];
  return['Payroll in preparation',`The bursar is still working on ${period}.`];
}
/** Real counts filled in by loadRealDashboardMetrics() once the API
 * responds; null means "not loaded yet" so copy can show a neutral
 * loading state instead of a stale or fabricated number. Nothing here
 * gets a fake placeholder number; see submittedResultsCopy(). */
const realDashboardStats={submittedResults:null};
function submittedResultsCopy(){
  if(realDashboardStats.submittedResults===null)return 'Loading…';
  const n=realDashboardStats.submittedResults;
  return n?`${n} result${n===1?'':'s'} awaiting your approval.`:'Nothing waiting on you right now.';
}
const workspaceCardCopy={
  proprietor:[['⌂','Today’s priority','Approve payroll and clear overdue fees.','people-and-payroll'],['✓','Action queue',submittedResultsCopy,'academics'],['◫','Useful reports','Share a clear update with your team.','reports']],
  principal:[['✎','Result approvals',submittedResultsCopy,'academics'],['♟','Teacher coverage','Review assignments and class coverage this term.','teachers'],['✓','Attendance exceptions','Check classes with repeated absences.','attendance']],
  bursar:[['₦','Reconciliation queue','17 bank transfers need a reference.','reconciliation'],['◫','Payroll prep','Move this month’s payroll through review.','payroll'],['◫','Arrears follow-up','67 families are more than 30 days overdue.','arrears']],
  hr:[['♙','Leave requests','Coming soon. Leave tracking isn’t built yet.','leave'],['◫','Payroll inputs','Prepare salary inputs for this month’s run.','payroll'],['✓','Document renewals','Coming soon. Staff document tracking isn’t built yet.','documents']],
  teacher:[['✓','Take attendance','Mark today’s register for your class.','attendance'],['✎','Mark submissions','Coming soon. Assignment submission tracking isn’t built yet.','assignments'],['▤','Your timetable','See today’s periods at a glance.','timetable']],
  parent:[['♥','Fee balance','Pay Emeka’s outstanding balance.','fees'],['✓','Attendance','Check this week’s attendance for your children.','attendance'],['▤','Timetable','See what your children are studying today.','timetable']],
  student:[['✎','Assignments','Keep up with what’s due this week.','assignments'],['▤','Your timetable','See today’s classes at a glance.','timetable'],['✓','Results','Check your latest scores.','results']]
};
function workspaceCardsFor(role){
  const cards=workspaceCardCopy[role]||[['⌂','Today’s priority','Focus on the work that cannot wait.',''],['✓','Action queue','Complete approvals and updates.',''],['◫','Useful reports','Share a clear update with your team.','']];
  return cards.map(c=>[c[0],c[1],typeof c[2]==='function'?c[2]():c[2],c[3]]);
}
function applyPrincipalDashboardCopy(role){
  const urgent=document.querySelector('.attention-card.urgent'),warning=document.querySelector('.attention-card.warning'),neutral=document.querySelector('.attention-card.neutral');
  const feesCopy=dashboardFeesCopy[role]||dashboardFeesCopy.proprietor;
  if(urgent){urgent.querySelector('h3').textContent=feesCopy[0];urgent.querySelector('p:not(.tag)').textContent=feesCopy[1]}
  if(warning){const p=payrollCardCopyFor(role);warning.querySelector('h3').textContent=p[0];warning.querySelector('p:not(.tag)').textContent=p[1]}
  if(neutral){
    if(role==='principal'||role==='proprietor'){
      const n=realDashboardStats.submittedResults;
      neutral.querySelector('h3').textContent=n===null?'Loading…':`${n} result${n===1?'':'s'} awaiting approval`;
      neutral.querySelector('p:not(.tag)').textContent=submittedResultsCopy();
    }else{
      // Every other role that can see the "academics" scope (currently
      // just teacher) has no live-able summary yet, say so plainly
      // instead of showing the old fixed mock numbers.
      neutral.querySelector('h3').textContent='Coming soon';
      neutral.querySelector('p:not(.tag)').textContent='A live academics summary for this role isn’t built yet.';
    }
  }
}
function renderDashboard(role){applyDashboardScope(role);applyPrincipalDashboardCopy(role);const r=roles[role];document.getElementById('roleEyebrow').textContent=`Tuesday, 12 August · ${r.title} view`;document.getElementById('greeting').textContent=`Good morning, ${r.name}.`;document.getElementById('roleSubtitle').textContent=`Your ${r.title.toLowerCase()} workspace is ready.`;document.getElementById('roleSymbol').textContent=r.symbol;document.getElementById('roleBriefTitle').textContent=r.brief;document.getElementById('roleBriefText').textContent=r.text;const roleActionBtn=document.getElementById('roleAction');roleActionBtn.innerHTML=`${r.action} <span>→</span>`;roleActionBtn.removeAttribute('data-pay-child');if(role==='parent'){roleActionBtn.setAttribute('data-pay-child','Emeka Okon');roleActionBtn.removeAttribute('data-toast')}else{roleActionBtn.setAttribute('data-toast',`${r.action}: done`)}const perm=rolePermissions[role]||{chips:[],restricted:[]};document.getElementById('permissionChips').innerHTML=perm.chips.map(x=>`<span class="permission-chip">${x}</span>`).join('')+perm.restricted.map(x=>`<span class="permission-chip restricted">✕ ${x}</span>`).join('');document.getElementById('workspaceTitle').textContent=`${r.title} workspace`;document.getElementById('workspaceGrid').innerHTML=workspaceCardsFor(role).map(x=>`<article class="workspace-card"${x[3]?` data-goto-page="${x[3]}"`:''}><div class="workspace-icon">${x[0]}</div><h3>${x[1]}</h3><p>${x[2]}</p></article>`).join('')}
function showPage(view){dashboard.style.display=view==='dashboard'?'block':'none';document.querySelectorAll('.workspace-page').forEach(p=>p.classList.toggle('visible',p.id===view));document.querySelectorAll('[data-view]').forEach(l=>l.classList.toggle('active',l.dataset.view===view));if(view!=='dashboard')location.hash=view}
function bindNavigation(){document.querySelectorAll('[data-view]').forEach(l=>l.addEventListener('click',e=>{e.preventDefault();showPage(l.dataset.view)}))}
function toast(text){let el=document.querySelector('.toast');if(!el){el=document.createElement('div');el.className='toast';document.body.append(el)}el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2400)}
function openModal(html){document.getElementById('modalBox').innerHTML=`<button class="modal-close" data-modal-close>✕</button>${html}`;document.getElementById('modalOverlay').style.display='flex'}
function closeModal(){document.getElementById('modalOverlay').style.display='none';document.getElementById('modalBox').innerHTML=''}
function refresh(){changeRole(activeRole)}
function fieldHtml(f){
  if(f.type==='select')return `<div class="form-field"><label>${f.label}</label><select name="${f.name}">${f.options.map(o=>`<option>${o}</option>`).join('')}</select></div>`;
  if(f.type==='textarea')return `<div class="form-field"><label>${f.label}</label><textarea name="${f.name}" placeholder="${f.placeholder||''}"></textarea></div>`;
  if(f.type==='checkboxes')return `<div class="form-field"><label>${f.label}</label><div class="checkbox-group">${f.options.length?f.options.map(o=>`<label class="checkbox-option"><input type="checkbox" name="${f.name}" value="${o.value}">${o.label}</label>`).join(''):'<p class="modal-sub" style="margin:0">None yet.</p>'}</div></div>`;
  return `<div class="form-field"><label>${f.label}</label><input name="${f.name}" type="${f.type||'text'}" placeholder="${f.placeholder||''}" value="${f.value||''}"></div>`;
}
function formModal({eyebrow,title,sub,fields,submitLabel,onSubmit}){
  // Fields with the same name (e.g. a checkbox group) collect into an
  // array instead of the last value silently winning.
  window.__formSubmit=e=>{e.preventDefault();const data={};new FormData(e.target).forEach((v,k)=>{data[k]=k in data?[].concat(data[k],v):v});onSubmit(data);closeModal()};
  openModal(`<p class="eyebrow">${eyebrow}</p><h2>${title}</h2>${sub?`<p class="modal-sub">${sub}</p>`:''}<form onsubmit="__formSubmit(event)">${fields.map(fieldHtml).join('')}<div class="modal-upload">📎 Attach a file (optional, demo only)</div><div class="form-actions"><button type="button" class="outline-button" data-modal-close>Cancel</button><button type="submit" class="new-button">${submitLabel}</button></div></form>`);
}
function detailModal({eyebrow,title,sub,rows,footer}){
  openModal(`<p class="eyebrow">${eyebrow}</p><h2>${title}</h2>${sub?`<p class="modal-sub">${sub}</p>`:''}<div class="modal-detail">${rows.map(r=>`<div class="modal-detail-row"><span>${r[0]}</span><strong>${r[1]}</strong></div>`).join('')}</div>${footer||'<div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>'}`);
}

function openNewApplicationModal(){
  formModal({eyebrow:'Admissions',title:'New application',sub:'Register a prospective student into the pipeline.',
    fields:[{name:'name',label:'Applicant name',placeholder:'e.g. Halima Suleiman'},{name:'cls',label:'Class applying for',type:'select',options:['Creche','KG','Primary 1','Primary 2','JSS 1','JSS 2','JSS 3','SS 1','SS 2','SS 3']},{name:'campus',label:'Campus',type:'select',options:['Ikoyi','Lekki','Yaba']},{name:'guardian',label:'Guardian name',placeholder:'e.g. Mr. Suleiman'},{name:'phone',label:'Guardian phone',type:'tel',placeholder:'080...'}],
    submitLabel:'Add application',
    onSubmit:d=>{admissionsPipeline.push({stage:'submitted',name:d.name||'New applicant',cls:d.cls,campus:d.campus,date:'Today',docsLabel:'0/4 docs',docsOk:false});refresh();toast(`Application added · ${d.name||'New applicant'}`)}
  });
}
function advanceApplicant(name){
  const a=admissionsPipeline.find(x=>x.name===name);if(!a)return;
  const order=admissionsStages.map(s=>s[0]);const i=order.indexOf(a.stage);
  if(i>=order.length-1){openApplicantDetailModal(name);return}
  a.stage=order[i+1];
  if(a.stage==='review')a.docsLabel=a.docsOk?'4/4 docs':'3/4 docs';
  if(a.stage==='approved'){a.docsLabel='Offer sent';a.docsOk=true}
  if(a.stage==='enrolled')a.docsLabel='Enrolled';
  refresh();toast(`Moved to ${admissionsStages.find(s=>s[0]===a.stage)[1]} · ${name}`);
}
function openApplicantDetailModal(name){
  const a=admissionsPipeline.find(x=>x.name===name);if(!a)return;
  detailModal({eyebrow:'Applicant profile',title:a.name,rows:[['Class',a.cls],['Campus',a.campus],['Stage',admissionsStages.find(s=>s[0]===a.stage)[1]],['Documents',a.docsLabel],['Submitted',a.date]]});
}
function openApplicantReviewModal(name){
  const a=admissionsPipeline.find(x=>x.name===name);if(!a)return;
  detailModal({eyebrow:`Application · ${a.cls}`,title:a.name,rows:[
    ['Date of birth',a.dob||'—'],['Campus',a.campus],['Class applying for',a.cls],
    ['Guardian',a.guardian||'—'],['Guardian phone',a.phone||'—'],['Home address',a.address||'—'],
    ['Previous school',a.previousSchool||'—'],['Documents',a.docsLabel],['Notes',a.notes||'—']
  ],footer:`<div class="form-actions"><button class="outline-button" data-modal-close>Close</button><button class="new-button" data-modal-close data-advance-applicant="${a.name}">Move to review →</button></div>`});
}

function openNewFeeStructureModal(){
  formModal({eyebrow:'Fees & billing',title:'New fee structure',sub:'Set fees for a class band, effective this term.',
    fields:[{name:'cls',label:'Class band',placeholder:'e.g. Primary 1–3'},{name:'tuition',label:'Tuition (₦)',type:'number',placeholder:'120000'},{name:'transport',label:'Transport (₦)',type:'number',placeholder:'28000'},{name:'boarding',label:'Boarding (₦)',type:'number',placeholder:'0'},{name:'exam',label:'Exam levy (₦)',type:'number',placeholder:'6000'}],
    submitLabel:'Save fee structure',
    onSubmit:d=>{feeStructure.push({cls:d.cls||'New class band',tuition:Number(d.tuition)||0,transport:Number(d.transport)||0,boarding:Number(d.boarding)||0,exam:Number(d.exam)||0});refresh();toast(`Fee structure saved · ${d.cls||'New class band'}`)}
  });
}


function setPayrollStage(stage,label){payrollRun.stage=stage;refresh();toast(label)}
function resolvePayrollFlag(name){const r=payrollRows.find(x=>x.name===name);if(!r)return;r.status='Ready';refresh();toast(`Flag resolved · ${name}`)}

function submitTeacherExam(title){
  const e=teacherExams.find(x=>x.title===title);if(!e)return;
  e.status='Pending approval';delete e.rejectionReason;
  pendingApprovals.push({type:'CBT Exam',title:e.title,teacher:'Mrs. Dada',cls:e.cls,submitted:'Today'});
  refresh();toast(`Submitted for approval · ${title}`);
}
function openOwnExamResultModal(title){
  const e=cbtExams.find(x=>x.title===title);if(!e)return;
  detailModal({eyebrow:e.subject,title:e.title,rows:[['Your score',e.score||'—'],['Class average','78%'],['Questions',String(e.questions)]]});
}
function openExamResultsModal(title){
  detailModal({eyebrow:'Exam results',title,rows:[['Average score','78%'],['Highest score','96%'],['Lowest score','42%'],['Completion rate','92%']]});
}
/** Real assignment posting: POST /assignments via the SchoolOS API.
 * TEACHER is scoped to their own classes (/portal/teacher/class-arms);
 * PROPRIETOR/PRINCIPAL can post to any class in the tenant (/classes),
 * matching what the backend actually allows for each role. */
async function openNewAssignmentRealModal(){
  if(!window.SchoolOSApi||!window.SchoolOSApi.getAccessToken()){toast('Sign in to post an assignment');return}
  const user=window.SchoolOSApi.getUser();
  let arms=[];
  try{
    if(user&&user.role==='TEACHER'){
      arms=await window.SchoolOSApi.api('/portal/teacher/class-arms');
    }else{
      const classes=await window.SchoolOSApi.api('/classes');
      arms=classes.flatMap(c=>(c.arms||[]).map(a=>({id:a.id,schoolClassName:c.name,armName:a.name})));
    }
  }catch(err){toast(`Could not load your classes (${err.message})`);return}
  if(!arms.length){toast('No classes available to post to yet');return}
  const armByLabel=Object.fromEntries(arms.map(a=>[`${a.schoolClassName} · ${a.armName}`,a.id]));

  formModal({
    eyebrow:'Assignments',
    title:'Post assignment',
    sub:'Creates a real assignment via the SchoolOS API and notifies students and parents in that class.',
    fields:[
      {name:'classArm',label:'Class',type:'select',options:Object.keys(armByLabel)},
      {name:'title',label:'Title',placeholder:'e.g. Algebra worksheet'},
      {name:'description',label:'Description',type:'textarea',placeholder:'What should students do?'},
      {name:'dueDate',label:'Due date',type:'date'},
    ],
    submitLabel:'Post assignment',
    onSubmit:async d=>{
      const payload={
        classArmId:armByLabel[d.classArm],
        title:(d.title||'').trim(),
        description:(d.description||'').trim(),
        dueDate:d.dueDate||undefined,
      };
      if(!payload.classArmId||!payload.title||!payload.description){toast('Class, title and description are required');return}
      try{
        await window.SchoolOSApi.api('/assignments',{method:'POST',body:JSON.stringify(payload)});
        toast(`${payload.title} posted`);
        loadRealTeacherAssignments();
      }catch(err){
        toast(`Could not post assignment (${err.message})`);
      }
    },
  });
}
function openNewExamModal(){
  openModal(`<p class="eyebrow">CBT Exams</p><h2>New CBT exam</h2><p class="modal-sub">Add your questions below: each needs 4 options and a correct answer.</p>
    <form onsubmit="__examSubmit(event)">
      <div class="form-row"><div class="form-field"><label>Exam title</label><input name="title" placeholder="e.g. Mid-term mock test"></div><div class="form-field"><label>Class</label><select name="cls">${['JSS 2A','JSS 2B','JSS 3B','SS 1A'].map(c=>`<option>${c}</option>`).join('')}</select></div></div>
      <div class="form-field"><label>Duration (minutes)</label><input name="duration" type="number" placeholder="30"></div>
      <div id="examQuestions" class="question-builder"></div>
      <button type="button" class="outline-button" id="addExamQuestionBtn">+ Add question</button>
      <div class="form-actions"><button type="button" class="outline-button" data-modal-close>Cancel</button><button type="submit" class="new-button">Save as draft</button></div>
    </form>`);
  let qCount=0;
  const addQ=()=>{
    qCount++;
    const box=document.createElement('div');box.className='question-block';
    box.innerHTML=`<p class="question-label">Question ${qCount}</p><input placeholder="Question text" class="eq-text"><div class="form-row"><input placeholder="Option A" class="eq-opt"><input placeholder="Option B" class="eq-opt"></div><div class="form-row"><input placeholder="Option C" class="eq-opt"><input placeholder="Option D" class="eq-opt"></div><select class="eq-correct"><option value="0">Correct: A</option><option value="1">Correct: B</option><option value="2">Correct: C</option><option value="3">Correct: D</option></select>`;
    document.getElementById('examQuestions').appendChild(box);
  };
  document.getElementById('addExamQuestionBtn').addEventListener('click',addQ);
  addQ();
  window.__examSubmit=e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const title=fd.get('title')||'Untitled exam',cls=fd.get('cls');
    const blocks=document.querySelectorAll('#examQuestions .question-block');
    const questions=Array.from(blocks).map(b=>({q:b.querySelector('.eq-text').value||'Untitled question',options:Array.from(b.querySelectorAll('.eq-opt')).map(o=>o.value||'Option'),correct:Number(b.querySelector('.eq-correct').value)}));
    teacherExams.push({title,cls,questions:questions.length,status:'Draft',questionBank:questions});
    closeModal();refresh();toast(`Draft saved · ${title} (${questions.length} question${questions.length===1?'':'s'})`);
  };
}

function openAssignmentWorkModal(title){
  const a=studentAssignments.find(x=>x.title===title);if(!a)return;
  if(a.status==='Graded'){detailModal({eyebrow:a.subject,title:a.title,rows:[['Score',a.score],['Teacher comment','Good structure. Check your working in Q3.']]});return}
  if(a.status==='Submitted'){detailModal({eyebrow:a.subject,title:a.title,rows:[['Status','Submitted, awaiting grading'],['Submitted','Today']]});return}
  formModal({eyebrow:a.subject,title:a.title,sub:`Due ${a.due}`,
    fields:[{name:'answer',label:'Your answer',type:'textarea',placeholder:'Type your response, or attach a file below'}],
    submitLabel:'Submit assignment',
    onSubmit:()=>{a.status='Submitted';refresh();toast(`Submitted · ${title}`)}
  });
}

function openPaymentModal(name){
  const c=parentChildren.find(x=>x.name===name);if(!c)return;
  const paidAmount=c.feeBalance;
  formModal({eyebrow:'Fees',title:`Pay ${c.name}'s balance`,sub:'Payment is simulated in this demo.',
    fields:[{name:'amount',label:'Amount (₦)',type:'number',value:c.feeBalance.replace(/[₦,]/g,'')},{name:'method',label:'Payment method',type:'select',options:['Card','Bank transfer','USSD']}],
    submitLabel:'Pay now',
    onSubmit:d=>{
      c.feeBalance='₦0';c.feeStatus='Paid';
      (parentInvoices[c.name]||[]).forEach(i=>i.status='Paid');
      paymentHistory.unshift({date:'Today',child:c.name,item:'Third term balance',amount:paidAmount,method:d.method||'Card',receipt:`RCT-${1100+paymentHistory.length}`});
      refresh();toast(`Payment received · ${c.name}`);
    }
  });
}
function openReceiptModal(receipt){
  const p=paymentHistory.find(x=>x.receipt===receipt);if(!p)return;
  detailModal({eyebrow:'Receipt',title:p.receipt,rows:[['Date',p.date],['Child',p.child],['Item',p.item],['Amount',p.amount],['Method',p.method]],footer:'<div class="form-actions"><button class="outline-button" data-modal-close>Close</button><button class="new-button" data-toast="Receipt downloaded">Download PDF</button></div>'});
}
const childTestResults={
  'Ada Okon':[{test:'CA1',subject:'Mathematics',score:'18/20'},{test:'CA2',subject:'Mathematics',score:'19/20'},{test:'Exam',subject:'Mathematics',score:'52/60'},{test:'CA1',subject:'English',score:'16/20'},{test:'Exam',subject:'English',score:'48/60'}],
  'Emeka Okon':[{test:'CA1',subject:'Mathematics',score:'14/20'},{test:'Exam',subject:'Mathematics',score:'40/60'},{test:'CA1',subject:'English',score:'15/20'}]
};
function openChildResultsModal(name){
  const c=parentChildren.find(x=>x.name===name);if(!c)return;
  const tests=childTestResults[name]||[];
  const rows=[['Position',c.lastResult],...tests.map(t=>[`${t.subject} · ${t.test}`,t.score])];
  detailModal({eyebrow:'Results',title:c.name,rows,footer:`<div class="form-actions"><button class="outline-button" data-modal-close>Close</button><button class="new-button" data-modal-close data-view-report-card="${c.name}">View report card →</button></div>`});
}
function openReportCardModal(name){
  const c=parentChildren.find(x=>x.name===name);if(!c)return;
  detailModal({eyebrow:'Third term report card',title:c.name,rows:[['Class',c.cls],['Position',c.lastResult],['Attendance',c.attendance],['Mathematics','A'],['English','B'],['Basic Science','A'],['Class teacher’s remark','A consistent, hardworking student.']],
    footer:'<div class="form-actions"><button class="outline-button" data-modal-close>Close</button><button class="new-button" data-toast="Report card downloaded">Download PDF</button></div>'});
}
function openChildAttendanceModal(name){
  const c=parentChildren.find(x=>x.name===name);if(!c)return;
  detailModal({eyebrow:'Attendance',title:c.name,rows:[['This term',c.attendance],['Days present','61 / 64'],['Last absence','12 Aug']]});
}

const lessons=[
  {id:1,subject:'Mathematics',cls:'JSS 2A',term:'Third term',title:'Quadratic equations: introduction',date:'25 Aug',resources:[{name:'Quadratic-equations-notes.pdf',type:'PDF'},{name:'Worked-examples.pdf',type:'PDF'}]},
  {id:2,subject:'English',cls:'JSS 2A',term:'Third term',title:'Comprehension: reading for meaning',date:'24 Aug',resources:[{name:'Comprehension-passage.docx',type:'Doc'}]},
  {id:3,subject:'Basic Science',cls:'JSS 2A',term:'Third term',title:'Photosynthesis: process & diagram',date:'21 Aug',resources:[{name:'Photosynthesis-diagram.png',type:'Image'},{name:'Lesson-recording.mp4',type:'Video'}]},
  {id:4,subject:'Mathematics',cls:'JSS 2B',term:'Third term',title:'Simultaneous equations',date:'20 Aug',resources:[{name:'Simultaneous-equations.pdf',type:'PDF'}]},
  {id:5,subject:'Physics',cls:'SS 1A',term:'Third term',title:'Newton’s laws of motion',date:'23 Aug',resources:[{name:'Newtons-laws-slides.pdf',type:'PDF'}]}
];
let lessonSeq=6;
function resourceChipsFor(l){return l.resources.length?l.resources.map(r=>`<span class="permission-chip">${r.type} · ${r.name}</span>`).join(''):'<small>No resources yet</small>'}
function studentClassFor(){return 'JSS 2A'}
function pageLessonsTeacher(label){
  const kpis=[['Lessons this term',String(lessons.length),'Across your assigned classes'],['Resources uploaded',String(lessons.reduce((n,l)=>n+l.resources.length,0)),'Files, links & recordings'],['Classes covered',String(new Set(lessons.map(l=>l.cls)).size),'JSS & SS sections'],['Latest lesson',lessons[0]?lessons[0].title:'—',lessons[0]?`${lessons[0].subject} · ${lessons[0].cls}`:'']];
  const rows=lessons.map(l=>`<tr><td><strong>${l.title}</strong></td><td>${l.subject}</td><td>${l.cls}</td><td>${l.date}</td><td>${resourceChipsFor(l)}</td><td class="row-action"><div class="row-actions"><button class="outline-button" data-add-resource="${l.id}">+ Resource</button></div></td></tr>`).join('');
  return `<section class="page workspace-page" id="lessons"><div class="page-heading"><div><p class="eyebrow">Deliver learning</p><h1>${label}</h1><p class="subtitle">Create lessons and share resources with your assigned subject and class.</p></div><button class="new-button" data-modal="new-lesson">+ New lesson</button></div><div class="screen-kpis">${kpis.map(s=>`<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('')}</div><section class="data-card"><table class="data-table"><thead><tr><th>Lesson</th><th>Subject</th><th>Class</th><th>Date</th><th>Resources</th><th></th></tr></thead><tbody>${rows}</tbody></table></section></section>`;
}
function pageLessonsStudent(label){
  return `<section class="page workspace-page" id="lessons"><div class="page-heading"><div><p class="eyebrow">Your lessons</p><h1>${label}</h1><p class="subtitle">No lesson/resource data source is built yet: this isn't showing you fake data.</p></div></div><section class="data-card"><div class="empty-state"><span class="mini-avatar">▤</span><h3>Not available yet</h3><p>Lesson notes and resources haven't been built on the backend. Assignments (with attached resource links) already work — check that page instead.</p></div></section></section>`;
}
function pageLessonsParent(label){
  const rows=parentChildren.map(c=>{const cls=c.cls.split(' · ')[0];return lessons.filter(l=>l.cls===cls).map(l=>`<tr><td><strong>${l.title}</strong></td><td>${c.name}</td><td>${l.subject}</td><td>${l.date}</td><td>${l.resources.length} file${l.resources.length===1?'':'s'}</td><td class="row-action"><button class="outline-button" data-view-lesson="${l.id}">View resources</button></td></tr>`).join('')}).join('');
  const assignmentRows=studentAssignments.map(a=>`<tr class="${a.status==='Overdue'?'row-flagged':''}"><td><strong>${a.title}</strong></td><td>Emeka Okon</td><td>${a.subject}</td><td>${a.due}</td><td><span class="status ${a.status==='Not started'||a.status==='Overdue'?'pending':''}">${a.status}</span></td><td>${a.score||'—'}</td><td class="row-action">${a.status==='Graded'?`<button class="outline-button" data-view-child-assignment="${a.title}">View feedback</button>`:'<span class="view-only-badge">View only</span>'}</td></tr>`).join('');
  return `<section class="page workspace-page" id="lessons"><div class="page-heading"><div><p class="eyebrow">Your children’s learning</p><h1>${label}</h1><p class="subtitle">Lessons, resources and assignment feedback for your children.</p></div></div><div class="screen-tabs" data-tabs><button class="active" data-tab="lessons">Lessons</button><button data-tab="assignments">Assignments</button></div><div data-tab-panel="lessons" class="tab-panel visible"><section class="data-card"><table class="data-table"><thead><tr><th>Lesson</th><th>Child</th><th>Subject</th><th>Date</th><th>Resources</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="6">No lessons published yet.</td></tr>'}</tbody></table></section></div><div data-tab-panel="assignments" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Assignment</th><th>Child</th><th>Subject</th><th>Due date</th><th>Status</th><th>Score</th><th></th></tr></thead><tbody>${assignmentRows}</tbody></table></section></div></section>`;
}
/** Out-of-scope Lessons module still shows this as pre-existing mock demo
 * data (Lessons has no backend at all, untouched this pass). The real
 * Assignments page/module no longer reads from this array. */
const teacherAssignments=[
  {title:'Quadratic equations worksheet',cls:'JSS 2A',due:'28 Aug',submissions:'18/31',status:'Published'},
  {title:'Essay: My holiday',cls:'JSS 2A',due:'26 Aug',submissions:'31/31',status:'Published'},
  {title:'Trigonometry practice set',cls:'JSS 2A',due:'2 Sep',submissions:'0/31',status:'Pending approval'},
  {title:'Mid-term revision pack',cls:'JSS 2B',due:'5 Sep',submissions:'—',status:'Draft'}
];
function pageLessonsOversight(label){
  const kpis=[['Lessons this term',String(lessons.length),'Across all classes'],['Resources shared',String(lessons.reduce((n,l)=>n+l.resources.length,0)),'This term'],['Assignments published',String(teacherAssignments.filter(a=>a.status==='Published').length),'Live for students'],['Submissions to grade','18','Across published assignments']];
  const lessonRows=lessons.map(l=>`<tr><td><strong>${l.title}</strong></td><td>${l.subject}</td><td>${l.cls}</td><td>${l.date}</td><td>${l.resources.length} file${l.resources.length===1?'':'s'}</td></tr>`).join('');
  const assignmentRows=teacherAssignments.map(a=>`<tr><td><strong>${a.title}</strong></td><td>${a.cls}</td><td>${a.due}</td><td>${a.submissions}</td><td><span class="status ${a.status!=='Published'?'pending':''}">${a.status}</span></td></tr>`).join('');
  return `<section class="page workspace-page" id="lessons"><div class="page-heading"><div><p class="eyebrow">Academic oversight</p><h1>${label}</h1><p class="subtitle">Lessons and assignments across every class, view only.</p></div><span class="view-only-badge">View only</span></div><div class="screen-kpis">${kpis.map(s=>`<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('')}</div><div class="screen-tabs" data-tabs><button class="active" data-tab="lessons">Lessons</button><button data-tab="assignments">Assignments</button></div><div data-tab-panel="lessons" class="tab-panel visible"><section class="data-card"><table class="data-table"><thead><tr><th>Lesson</th><th>Subject</th><th>Class</th><th>Date</th><th>Resources</th></tr></thead><tbody>${lessonRows}</tbody></table></section></div><div data-tab-panel="assignments" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Assignment</th><th>Class</th><th>Due date</th><th>Submissions</th><th>Status</th></tr></thead><tbody>${assignmentRows}</tbody></table></section></div></section>`;
}
function pageLessons(label){
  if(activeRole==='teacher')return pageLessonsTeacher(label);
  if(activeRole==='student')return pageLessonsStudent(label);
  if(activeRole==='parent')return pageLessonsParent(label);
  return pageLessonsOversight(label);
}
function openNewLessonModal(){
  formModal({eyebrow:'Lessons',title:'New lesson',sub:'Publish a lesson to your assigned subject and class. Add resources after saving.',
    fields:[{name:'title',label:'Lesson title',placeholder:'e.g. Introduction to fractions'},{name:'subject',label:'Subject',type:'select',options:['Mathematics','English','Basic Science','Civic Education','French','Physics']},{name:'cls',label:'Class / arm',type:'select',options:['JSS 2A','JSS 2B','JSS 3B','SS 1A']},{name:'term',label:'Term',type:'select',options:['First term','Second term','Third term']},{name:'notes',label:'Notes for students',type:'textarea',placeholder:'What should students focus on?'}],
    submitLabel:'Save lesson',
    onSubmit:d=>{lessons.unshift({id:lessonSeq++,subject:d.subject,cls:d.cls,term:d.term,title:d.title||'Untitled lesson',date:'Today',resources:[]});refresh();toast(`Lesson published · ${d.title||'Untitled lesson'}`)}
  });
}
function openAddResourceModal(id){
  const l=lessons.find(x=>x.id===Number(id));if(!l)return;
  formModal({eyebrow:'Lesson resource',title:`Add resource · ${l.title}`,sub:'Accepted: PDF, DOCX, PPT, MP4, JPG/PNG, max 50MB. Stored privately and served through signed URLs.',
    fields:[{name:'name',label:'File / link name',placeholder:'e.g. Worked-examples.pdf'},{name:'type',label:'Resource type',type:'select',options:['PDF','Doc','Slides','Video','Image','Link']}],
    submitLabel:'Add resource',
    onSubmit:d=>{l.resources.push({name:d.name||'Untitled resource',type:d.type});refresh();toast(`Resource added · ${d.name||'Untitled resource'}`)}
  });
}
function openLessonResourcesModal(id){
  const l=lessons.find(x=>x.id===Number(id));if(!l)return;
  const list=l.resources.length?l.resources.map(r=>`<div class="submission-row"><span class="person-cell"><span class="mini-avatar">${r.type[0]}</span>${r.name}</span><button class="outline-button" data-toast="Opening ${r.name}, signed URL generated (demo)">Open</button></div>`).join(''):'<p class="modal-sub">No resources have been added to this lesson yet.</p>';
  openModal(`<p class="eyebrow">${l.subject} · ${l.cls}</p><h2>${l.title}</h2><div class="submission-list">${list}</div><div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>`);
}
function openChildAssignmentModal(title){
  const a=studentAssignments.find(x=>x.title===title);if(!a)return;
  if(a.status==='Graded'){detailModal({eyebrow:a.subject,title:a.title,rows:[['Score',a.score],['Teacher comment','Good structure. Check your working in Q3.']]});return}
  detailModal({eyebrow:a.subject,title:a.title,rows:[['Status',a.status],['Due date',a.due]]});
}

const libraryItems=[
  {id:1,title:'Things Fall Apart',author:'Chinua Achebe',isbn:'978-0385474542',category:'Literature',total:8,available:5,shelf:'A-12'},
  {id:2,title:'New General Mathematics JSS 2',author:'M.F. Macrae',isbn:'978-9780177450',category:'Textbook',total:40,available:6,shelf:'B-04'},
  {id:3,title:'Basic Science for Junior Secondary',author:'STAN',isbn:'978-9782000123',category:'Textbook',total:35,available:2,shelf:'B-09'},
  {id:4,title:'Half of a Yellow Sun',author:'Chimamanda Ngozi Adichie',isbn:'978-0007200283',category:'Literature',total:6,available:0,shelf:'A-15'},
  {id:5,title:'Atlas of the World',author:'National Geographic',isbn:'978-1426217129',category:'Reference',total:3,available:3,shelf:'C-02'}
];
let librarySeq=6;
const libraryLoans=[
  {id:1,item:'New General Mathematics JSS 2',borrower:'Tunde Bello',borrowerType:'Student · JSS 2A',issued:'10 Aug',due:'24 Aug',returned:null,status:'Overdue'},
  {id:2,item:'Basic Science for Junior Secondary',borrower:'Chidinma Eze',borrowerType:'Student · JSS 2A',issued:'18 Aug',due:'1 Sep',returned:null,status:'Active'},
  {id:3,item:'Half of a Yellow Sun',borrower:'Mrs. Dada',borrowerType:'Staff · Teacher',issued:'2 Aug',due:'16 Aug',returned:null,status:'Overdue'},
  {id:4,item:'Things Fall Apart',borrower:'Fatima Ibrahim',borrowerType:'Student · JSS 2A',issued:'20 Aug',due:'3 Sep',returned:null,status:'Active'},
  {id:5,item:'Atlas of the World',borrower:'David Chukwu',borrowerType:'Student · JSS 2B',issued:'5 Aug',due:'19 Aug',returned:'20 Aug',status:'Returned'}
];
let loanSeq=6;
function pageLibraryStaff(label){
  const overdue=libraryLoans.filter(l=>l.status==='Overdue');
  const lowStock=libraryItems.filter(i=>i.available<=2);
  const kpis=[['Titles in catalog',String(libraryItems.length),`${libraryItems.reduce((n,i)=>n+i.total,0)} copies total`],['Copies on loan',String(libraryLoans.filter(l=>l.status!=='Returned').length),'Across students & staff'],['Overdue loans',String(overdue.length),'Send a reminder from this screen'],['Low-copy titles',String(lowStock.length),'2 or fewer copies available']];
  const catalogRows=libraryItems.map(i=>`<tr><td><strong>${i.title}</strong></td><td>${i.author}</td><td>${i.isbn}</td><td>${i.category}</td><td>${i.available} / ${i.total}</td><td>${i.shelf}</td></tr>`).join('');
  const loanRows=libraryLoans.map(l=>`<tr class="${l.status==='Overdue'?'row-flagged':''}"><td><strong>${l.item}</strong></td><td>${l.borrower}</td><td>${l.borrowerType}</td><td>${l.issued}</td><td>${l.due}</td><td><span class="status ${l.status!=='Returned'?'pending':''}">${l.status}</span></td><td class="row-action">${l.status!=='Returned'?`<button class="outline-button" data-checkin-loan="${l.id}">Check in</button>`:'—'}</td></tr>`).join('');
  const overdueRows=overdue.map(l=>`<tr><td><strong>${l.item}</strong></td><td>${l.borrower}</td><td>${l.due}</td><td class="row-action"><button class="outline-button" data-send-reminder="${l.id}">Send reminder</button></td></tr>`).join('')||'<tr><td colspan="4">No overdue loans right now.</td></tr>';
  return `<section class="page workspace-page" id="library"><div class="page-heading"><div><p class="eyebrow">Library</p><h1>${label}</h1><p class="subtitle">Catalog, check-outs and overdue tracking for your campus.</p></div><div class="row-actions"><button class="outline-button" data-modal="check-out-book">Check out</button><button class="new-button" data-modal="new-library-item">+ New item</button></div></div><div class="screen-kpis">${kpis.map((s,i)=>`<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small class="${i===2?'warn':''}">${s[2]}</small></article>`).join('')}</div><div class="screen-tabs" data-tabs><button class="active" data-tab="catalog">Catalog</button><button data-tab="loans">Check-out / check-in</button><button data-tab="overdue">Overdue & alerts</button></div><div data-tab-panel="catalog" class="tab-panel visible"><section class="data-card"><table class="data-table"><thead><tr><th>Title</th><th>Author</th><th>ISBN</th><th>Category</th><th>Available</th><th>Shelf</th></tr></thead><tbody>${catalogRows}</tbody></table></section></div><div data-tab-panel="loans" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Item</th><th>Borrower</th><th>Type</th><th>Issued</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody>${loanRows}</tbody></table></section></div><div data-tab-panel="overdue" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Item</th><th>Borrower</th><th>Due date</th><th></th></tr></thead><tbody>${overdueRows}</tbody></table></section></div></section>`;
}
function pageLibraryOversight(label){
  const kpis=[['Titles in catalog',String(libraryItems.length),`${libraryItems.reduce((n,i)=>n+i.total,0)} copies total`],['Copies on loan',String(libraryLoans.filter(l=>l.status!=='Returned').length),'Across students & staff'],['Overdue loans',String(libraryLoans.filter(l=>l.status==='Overdue').length),'Flagged for the library team'],['Low-copy titles',String(libraryItems.filter(i=>i.available<=2).length),'2 or fewer copies available']];
  const catalogRows=libraryItems.map(i=>`<tr><td><strong>${i.title}</strong></td><td>${i.author}</td><td>${i.category}</td><td>${i.available} / ${i.total}</td><td>${i.shelf}</td></tr>`).join('');
  const loanRows=libraryLoans.map(l=>`<tr class="${l.status==='Overdue'?'row-flagged':''}"><td><strong>${l.item}</strong></td><td>${l.borrower}</td><td>${l.borrowerType}</td><td>${l.due}</td><td><span class="status ${l.status!=='Returned'?'pending':''}">${l.status}</span></td></tr>`).join('');
  return `<section class="page workspace-page" id="library"><div class="page-heading"><div><p class="eyebrow">Library</p><h1>${label}</h1><p class="subtitle">Catalog and loan activity across the campus, view only.</p></div><span class="view-only-badge">View only</span></div><div class="screen-kpis">${kpis.map(s=>`<article class="screen-kpi"><p>${s[0]}</p><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('')}</div><div class="screen-tabs" data-tabs><button class="active" data-tab="catalog">Catalog</button><button data-tab="loans">Loans</button></div><div data-tab-panel="catalog" class="tab-panel visible"><section class="data-card"><table class="data-table"><thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Available</th><th>Shelf</th></tr></thead><tbody>${catalogRows}</tbody></table></section></div><div data-tab-panel="loans" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Item</th><th>Borrower</th><th>Type</th><th>Due</th><th>Status</th></tr></thead><tbody>${loanRows}</tbody></table></section></div></section>`;
}
function pageLibrary(label){return activeRole==='operations'?pageLibraryStaff(label):pageLibraryOversight(label)}
function openNewLibraryItemModal(){
  formModal({eyebrow:'Library',title:'New catalog item',sub:'Add a new title to the campus library.',
    fields:[{name:'title',label:'Title',placeholder:'e.g. Fluid Mechanics'},{name:'author',label:'Author',placeholder:'e.g. J. Smith'},{name:'isbn',label:'ISBN',placeholder:'978-...'},{name:'category',label:'Category',type:'select',options:['Textbook','Literature','Reference','Periodical','Other']},{name:'total',label:'Total copies',type:'number',placeholder:'5'},{name:'shelf',label:'Shelf location',placeholder:'e.g. B-07'}],
    submitLabel:'Add to catalog',
    onSubmit:d=>{const total=Number(d.total)||1;libraryItems.push({id:librarySeq++,title:d.title||'Untitled title',author:d.author||'Unknown',isbn:d.isbn||'—',category:d.category,total,available:total,shelf:d.shelf||'—'});refresh();toast(`Added to catalog · ${d.title||'Untitled title'}`)}
  });
}
function openCheckOutModal(){
  const available=libraryItems.filter(i=>i.available>0);
  formModal({eyebrow:'Library',title:'Check out an item',sub:'Issue a book to a student or staff member.',
    fields:[{name:'item',label:'Item',type:'select',options:available.map(i=>i.title)},{name:'borrower',label:'Borrower name',placeholder:'e.g. Tunde Bello'},{name:'borrowerType',label:'Borrower type',type:'select',options:['Student · JSS 2A','Student · JSS 2B','Student · SS 1A','Staff · Teacher','Staff · Admin']},{name:'due',label:'Due date',type:'date'}],
    submitLabel:'Check out',
    onSubmit:d=>{const item=libraryItems.find(i=>i.title===d.item);if(item&&item.available>0)item.available--;libraryLoans.unshift({id:loanSeq++,item:d.item,borrower:d.borrower||'Unnamed borrower',borrowerType:d.borrowerType,issued:'Today',due:d.due||'TBC',returned:null,status:'Active'});refresh();toast(`Checked out · ${d.item} → ${d.borrower||'Unnamed borrower'}`)}
  });
}
function checkInLoan(id){
  const l=libraryLoans.find(x=>x.id===Number(id));if(!l)return;
  l.status='Returned';l.returned='Today';
  const item=libraryItems.find(i=>i.title===l.item);if(item)item.available=Math.min(item.total,item.available+1);
  refresh();toast(`Checked in · ${l.item}`);
}
function sendOverdueReminder(id){
  const l=libraryLoans.find(x=>x.id===Number(id));if(!l)return;
  toast(`Reminder sent to ${l.borrower} · ${l.item} is overdue`);
}

const brandingSettings={schoolName:'Greenfield International Schools',primaryColor:'#1d6f5c',secondaryColor:'#f2b134',logoLabel:'greenfield-logo.png',loginHeadline:'Welcome back to Greenfield',loginSubtext:'Sign in to your school portal to continue.',campus:'All campuses'};
const documentTemplates=[
  {name:'Report card',status:'Published',version:'v3',updated:'12 Aug'},
  {name:'Fee bill / invoice',status:'Published',version:'v2',updated:'3 Aug'},
  {name:'Payment receipt',status:'Draft',version:'v1',updated:'Today'},
  {name:'Admission letter',status:'Published',version:'v1',updated:'20 Jul'}
];
const templateMergeFields={
  'Report card':['{{student.name}}','{{student.class}}','{{student.position}}','{{subject.scores}}','{{term.name}}','{{school.name}}','{{school.logo}}'],
  'Fee bill / invoice':['{{student.name}}','{{invoice.number}}','{{invoice.items}}','{{invoice.total}}','{{invoice.dueDate}}','{{school.name}}','{{school.bankDetails}}'],
  'Payment receipt':['{{receipt.number}}','{{student.name}}','{{payment.amount}}','{{payment.method}}','{{payment.date}}','{{school.name}}'],
  'Admission letter':['{{applicant.name}}','{{applicant.class}}','{{school.name}}','{{school.principalName}}','{{term.startDate}}']
};
const bulkImportHistory=[
  {type:'Students',rows:812,status:'Completed',date:'3 days ago'},
  {type:'Staff',rows:64,status:'Completed',date:'3 days ago'}
];
function brandPreviewHtml(){
  const b=brandingSettings;
  return `<div class="brand-preview"><div class="brand-preview-chrome"><span></span><span></span><span></span></div><div class="brand-preview-body" style="background:${b.primaryColor}"><div class="brand-preview-card"><p class="brand-preview-logo">${b.schoolName}</p><h3>${b.loginHeadline}</h3><p>${b.loginSubtext}</p><div class="brand-preview-btn" style="background:${b.secondaryColor}">Sign in</div></div></div></div>`;
}
function pageSettingsProprietor(label){
  const templateRows=documentTemplates.map(t=>`<tr><td><strong>${t.name}</strong></td><td><span class="status ${t.status!=='Published'?'pending':''}">${t.status}</span></td><td>${t.version}</td><td>${t.updated}</td><td class="row-action"><div class="row-actions"><button class="outline-button" data-preview-template="${t.name}">Preview</button><button class="outline-button" data-edit-template="${t.name}">Edit</button>${t.status==='Draft'?`<button class="new-button" data-publish-template="${t.name}">Publish</button>`:''}</div></td></tr>`).join('');
  const importRows=bulkImportHistory.map(h=>`<tr><td>${h.type}</td><td>${h.rows}</td><td><span class="status">${h.status}</span></td><td>${h.date}</td></tr>`).join('');
  return `<section class="page workspace-page" id="settings"><div class="page-heading"><div><p class="eyebrow">Settings</p><h1>${label}</h1><p class="subtitle">Branding, document templates and mid-term data migration for your school.</p></div></div><div class="screen-tabs" data-tabs><button class="active" data-tab="branding">Branding</button><button data-tab="templates">Document templates</button><button data-tab="bulk-import">Bulk import</button></div><div data-tab-panel="branding" class="tab-panel visible"><div class="workspace-grid-main"><section class="data-card" style="padding:18px"><form id="brandingForm" onsubmit="__brandingSubmit(event)"><div class="form-row"><div class="form-field"><label>School display name</label><input name="schoolName" value="${brandingSettings.schoolName}"></div><div class="form-field"><label>Applies to</label><select name="campus">${['All campuses','Ikoyi','Lekki','Yaba'].map(c=>`<option ${c===brandingSettings.campus?'selected':''}>${c}</option>`).join('')}</select></div></div><div class="form-row"><div class="form-field"><label>Primary colour</label><input name="primaryColor" type="color" value="${brandingSettings.primaryColor}"></div><div class="form-field"><label>Secondary colour</label><input name="secondaryColor" type="color" value="${brandingSettings.secondaryColor}"></div></div><div class="modal-upload">📎 Upload logo (demo only), current: ${brandingSettings.logoLabel}</div><div class="form-field"><label>Login page headline</label><input name="loginHeadline" value="${brandingSettings.loginHeadline}"></div><div class="form-field"><label>Login page subtext</label><textarea name="loginSubtext">${brandingSettings.loginSubtext}</textarea></div><div class="form-actions"><button type="submit" class="new-button">Save branding</button></div></form></section><aside class="workspace-aside"><section class="side-card"><p class="eyebrow">Live preview</p><h3 id="brandPreviewName">${brandingSettings.schoolName}</h3><div id="brandPreviewBox">${brandPreviewHtml()}</div><small>This is what families see on your school’s login page. Never resolves for other tenants.</small></section></aside></div></div><div data-tab-panel="templates" class="tab-panel"><section class="data-card"><table class="data-table"><thead><tr><th>Template</th><th>Status</th><th>Version</th><th>Last updated</th><th></th></tr></thead><tbody>${templateRows}</tbody></table></section></div><div data-tab-panel="bulk-import" class="tab-panel"><section class="data-card" style="padding:18px"><p class="modal-sub">Import existing student, staff and result records so a school can switch mid-term without losing history.</p><div class="workspace-grid"><article class="side-card"><p class="eyebrow">Students</p><h3>Student records</h3><p>Name, class, guardian, admission number</p><div class="row-actions"><button class="outline-button" data-toast="Template downloaded (demo)">Download template</button><button class="new-button" data-bulk-import="Students">Upload & import</button></div></article><article class="side-card"><p class="eyebrow">Staff</p><h3>Staff records</h3><p>Name, role, subjects, employment date</p><div class="row-actions"><button class="outline-button" data-toast="Template downloaded (demo)">Download template</button><button class="new-button" data-bulk-import="Staff">Upload & import</button></div></article><article class="side-card"><p class="eyebrow">Results</p><h3>Result records</h3><p>Student, subject, term, scores</p><div class="row-actions"><button class="outline-button" data-toast="Template downloaded (demo)">Download template</button><button class="new-button" data-bulk-import="Results">Upload & import</button></div></article></div></section><section class="data-card" style="margin-top:14px"><div class="data-toolbar"><strong>Import history</strong></div><table class="data-table"><thead><tr><th>Type</th><th>Rows</th><th>Status</th><th>Date</th></tr></thead><tbody>${importRows}</tbody></table></section></div></section>`;
}
function pageSettings(label){return activeRole==='proprietor'?pageSettingsProprietor(label):pageMarkup(label)}
function saveBranding(form){
  const fd=new FormData(form);
  brandingSettings.schoolName=fd.get('schoolName')||brandingSettings.schoolName;
  brandingSettings.campus=fd.get('campus');
  brandingSettings.primaryColor=fd.get('primaryColor');
  brandingSettings.secondaryColor=fd.get('secondaryColor');
  brandingSettings.loginHeadline=fd.get('loginHeadline')||brandingSettings.loginHeadline;
  brandingSettings.loginSubtext=fd.get('loginSubtext')||brandingSettings.loginSubtext;
  const box=document.getElementById('brandPreviewBox');if(box)box.innerHTML=brandPreviewHtml();
  const nameEl=document.getElementById('brandPreviewName');if(nameEl)nameEl.textContent=brandingSettings.schoolName;
  toast(`Branding saved · applies to ${brandingSettings.campus}`);
}
window.__brandingSubmit=e=>{e.preventDefault();saveBranding(e.target)};
function openTemplatePreviewModal(name){
  const fields=(templateMergeFields[name]||[]).map(f=>`<span class="permission-chip">${f}</span>`).join('');
  openModal(`<p class="eyebrow">Template preview</p><h2>${name}</h2><p class="modal-sub">Merge fields used by this template, replaced with real data when a document is generated. Tenant-scoped: this template and its assets never resolve for another school.</p><div class="submission-list">${fields}</div><div class="form-actions"><button class="outline-button" data-modal-close>Close</button></div>`);
}
function openTemplateEditModal(name){
  const t=documentTemplates.find(x=>x.name===name);if(!t)return;
  formModal({eyebrow:'Edit template',title:name,sub:'Editing creates a new draft version. Publish it to make it live for every new document.',
    fields:[{name:'notes',label:'Change notes',type:'textarea',placeholder:'What did you change in this version?'}],
    submitLabel:'Save as draft',
    onSubmit:()=>{const n=Number(t.version.replace('v',''))+1;t.version=`v${n}`;t.status='Draft';t.updated='Today';refresh();toast(`Draft saved · ${name} (v${n})`)}
  });
}
function publishTemplate(name){
  const t=documentTemplates.find(x=>x.name===name);if(!t)return;
  t.status='Published';t.updated='Today';
  refresh();toast(`Published · ${name} is now used for every new document`);
}
function openBulkImportModal(kind){
  formModal({eyebrow:'Bulk import',title:`Import ${kind.toLowerCase()} records`,sub:'CSV only. Rows are matched to existing records where possible; the rest are queued for review.',
    fields:[{name:'notes',label:'Import notes',type:'textarea',placeholder:'e.g. Mid-term transfer from previous system'}],
    submitLabel:'Upload & import',
    onSubmit:()=>{
      const rows=kind==='Students'?128:kind==='Staff'?14:960;
      bulkImportHistory.unshift({type:kind,rows,status:'Completed',date:'Today'});
      refresh();toast(`Import complete · ${rows} ${kind.toLowerCase()} rows processed`);
    }
  });
}

const bespokePages={admissions:pageAdmissions,fees:pageFees,'fees-and-payments':pageFees,academics:pageAcademics,payroll:pagePayroll,'people-and-payroll':pagePayroll,assignments:pageAssignments,'cbt-exams':pageCbtExam,'my-children':pageMyChildren,'content-approvals':pageContentApprovals,'schools-campuses':pageSchools,attendance:pageAttendance,messages:pageMessages,communication:pageMessages,reports:pageReports,teachers:pageTeachersReal,classes:pageStudentClasses,timetable:pageTimetable,results:pageResults,lessons:pageLessons,library:pageLibrary,settings:pageSettings,students:pageStudentsReal,notices:pageStudentNoticesReal,profile:pageStudentProfileReal};
function bindTabs(){document.querySelectorAll('[data-tabs]').forEach(group=>{group.querySelectorAll('button').forEach(btn=>{btn.addEventListener('click',()=>{group.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===btn));group.parentElement.querySelectorAll('[data-tab-panel]').forEach(p=>p.classList.toggle('visible',p.dataset.tabPanel===btn.dataset.tab))})})})}
let activeRole='proprietor';
function changeRole(role){if(cbtState){clearInterval(cbtState.timer);cbtState=null}activeRole=role;renderNav(role);renderDashboard(role);workspacePages.innerHTML=navs[role].slice(1).map(item=>{const s=slug(item);return bespokePages[s]?bespokePages[s](item):pageMarkup(item)}).join('');bindTabs();loadRealStudents();loadRealStudentPortalData();loadRealTeachers();loadRealClasses();loadRealSubjects();loadRealTeacherResults();loadRealDashboardMetrics();loadRealAcademicsResults();loadRealTeacherAttendance();loadRealAttendanceOverview();loadRealParentResults();loadRealParentAttendance();loadRealTeacherAssignments();const target=location.hash.slice(1);showPage(target&&document.getElementById(target)?target:'dashboard')}
Object.entries(roles).forEach(([key,value])=>select.insertAdjacentHTML('beforeend',`<option value="${key}">${value.title}</option>`));select.addEventListener('change',()=>changeRole(select.value));const modalOpeners={'new-application':openNewApplicationModal,'new-fee-structure':openNewFeeStructureModal,'new-assignment-real':openNewAssignmentRealModal,'new-exam':openNewExamModal,'new-school':openNewSchoolModal,'new-payroll':openNewPayrollModal,'compose-message':openComposeModal,'new-timetable':openNewTimetableModal,'new-lesson':openNewLessonModal,'new-library-item':openNewLibraryItemModal,'check-out-book':openCheckOutModal,'new-student':openNewStudentModal,'new-teacher':openNewTeacherModal,'new-class':openNewClassModal,'new-subject':openNewSubjectModal,'add-marks':openAddMarksModal};
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-toast]');if(b)toast(b.dataset.toast);
  const start=e.target.closest('[data-cbt-start]');if(start)startCbtExam(start.dataset.cbtStart);
  const opt=e.target.closest('.cbt-option');if(opt)cbtSelectOption(Number(opt.dataset.opt));
  const qbtn=e.target.closest('#cbtQGrid button');if(qbtn)cbtGoTo(Number(qbtn.dataset.q));
  if(e.target.closest('#cbtNextBtn'))cbtNext();
  if(e.target.closest('#cbtPrevBtn'))cbtPrev();
  if(e.target.closest('#cbtSubmitBtn'))cbtSubmitExam();
  if(e.target.closest('#cbtBackBtn')){document.getElementById('cbtResultView').style.display='none';document.getElementById('cbtListView').style.display=''}
  const modal=e.target.closest('[data-modal]');if(modal)modalOpeners[modal.dataset.modal]?.();
  const addArm=e.target.closest('[data-add-arm]');if(addArm)openNewClassArmModal(addArm.dataset.addArm);
  const viewClass=e.target.closest('[data-view-class]');if(viewClass)openClassDetailModal(viewClass.dataset.viewClass);
  const viewTeacher=e.target.closest('[data-view-teacher]');if(viewTeacher)openTeacherDetailModal(viewTeacher.dataset.viewTeacher);
  const viewStudent=e.target.closest('[data-view-student]');if(viewStudent)openStudentDetailModal(viewStudent.dataset.viewStudent);
  const submitResultBtn=e.target.closest('[data-submit-result]');if(submitResultBtn)submitResult(submitResultBtn.dataset.submitResult);
  const approveRealResultBtn=e.target.closest('[data-approve-real-result]');if(approveRealResultBtn)approveRealResult(approveRealResultBtn.dataset.approveRealResult);
  const publishRealResultBtn=e.target.closest('[data-publish-real-result]');if(publishRealResultBtn)publishRealResult(publishRealResultBtn.dataset.publishRealResult);
  const gp=e.target.closest('[data-goto-page]');if(gp&&document.getElementById(gp.dataset.gotoPage))showPage(gp.dataset.gotoPage);
  const gt=e.target.closest('[data-goto-tab]');if(gt){const tb=document.querySelector(`.workspace-page.visible [data-tab="${gt.dataset.gotoTab}"]`);if(tb)tb.click()}
  const adv=e.target.closest('[data-advance-applicant]');if(adv)advanceApplicant(adv.dataset.advanceApplicant);
  const va=e.target.closest('[data-view-applicant]');if(va)openApplicantDetailModal(va.dataset.viewApplicant);
  const ra=e.target.closest('[data-review-applicant]');if(ra)openApplicantReviewModal(ra.dataset.reviewApplicant);
  const ps=e.target.closest('[data-payroll-stage]');if(ps)setPayrollStage(ps.dataset.payrollStage,ps.dataset.payrollLabel);
  const rf=e.target.closest('[data-resolve-flag]');if(rf)resolvePayrollFlag(rf.dataset.resolveFlag);
  const ste=e.target.closest('[data-submit-teacher-exam]');if(ste)submitTeacherExam(ste.dataset.submitTeacherExam);
  const ver=e.target.closest('[data-view-exam-results]');if(ver)openExamResultsModal(ver.dataset.viewExamResults);
  const vor=e.target.closest('[data-view-own-result]');if(vor)openOwnExamResultModal(vor.dataset.viewOwnResult);
  const oa=e.target.closest('[data-open-assignment]');if(oa)openAssignmentWorkModal(oa.dataset.openAssignment);
  const adr=e.target.closest('[data-add-resource]');if(adr)openAddResourceModal(adr.dataset.addResource);
  const vl=e.target.closest('[data-view-lesson]');if(vl)openLessonResourcesModal(vl.dataset.viewLesson);
  const vcasg=e.target.closest('[data-view-child-assignment]');if(vcasg)openChildAssignmentModal(vcasg.dataset.viewChildAssignment);
  const cil=e.target.closest('[data-checkin-loan]');if(cil)checkInLoan(cil.dataset.checkinLoan);
  const sr=e.target.closest('[data-send-reminder]');if(sr)sendOverdueReminder(sr.dataset.sendReminder);
  const pt=e.target.closest('[data-preview-template]');if(pt)openTemplatePreviewModal(pt.dataset.previewTemplate);
  const et=e.target.closest('[data-edit-template]');if(et)openTemplateEditModal(et.dataset.editTemplate);
  const pbt=e.target.closest('[data-publish-template]');if(pbt)publishTemplate(pbt.dataset.publishTemplate);
  const bi=e.target.closest('[data-bulk-import]');if(bi)openBulkImportModal(bi.dataset.bulkImport);
  const pc=e.target.closest('[data-pay-child]');if(pc)openPaymentModal(pc.dataset.payChild);
  const vr=e.target.closest('[data-view-receipt]');if(vr)openReceiptModal(vr.dataset.viewReceipt);
  const vcr=e.target.closest('[data-view-child-results]');if(vcr)openChildResultsModal(vcr.dataset.viewChildResults);
  const vrc=e.target.closest('[data-view-report-card]');if(vrc)openReportCardModal(vrc.dataset.viewReportCard);
  const vca=e.target.closest('[data-view-child-attendance]');if(vca)openChildAttendanceModal(vca.dataset.viewChildAttendance);
  const eg=e.target.closest('[data-edit-grade]');if(eg)openEditGradeModal(eg.dataset.editGrade);
  const ec=e.target.closest('[data-edit-cell]');if(ec){const[r,c]=ec.dataset.editCell.split(',').map(Number);openEditTimetableCellModal(r,c)}
  const tra=e.target.closest('[data-take-real-attendance]');if(tra)openTakeRealAttendanceModal(tra.dataset.takeRealAttendance);
  const es=e.target.closest('[data-edit-salary-grade]');if(es)openEditSalaryGradeModal(es.dataset.editSalaryGrade);
  if(e.target.closest('[data-modal-close]')||e.target===document.getElementById('modalOverlay'))closeModal();
  const feesCard=e.target.closest('.attention-card.urgent a, .collection-card a');
  if(feesCard){const t=navs[activeRole].find(x=>/fee/i.test(x));if(t){e.preventDefault();showPage(slug(t))}}
  const payrollCard=e.target.closest('.attention-card.warning a');
  if(payrollCard){const t=navs[activeRole].find(x=>/payroll/i.test(x));if(t){e.preventDefault();showPage(slug(t))}}
  const academicsCard=e.target.closest('.attention-card.neutral a');
  if(academicsCard){const t=navs[activeRole].find(x=>/academic/i.test(x));if(t){e.preventDefault();showPage(slug(t))}}
  const campusCard=e.target.closest('.campus-card a');
  if(campusCard){const t=navs[activeRole].find(x=>/report/i.test(x));if(t){e.preventDefault();showPage(slug(t))}}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
document.addEventListener('change',e=>{if(e.target.id==='timetableClassSelect')selectTimetableClass(e.target.value)});
document.getElementById('newButton').addEventListener('click',()=>{
  const page=document.querySelector('.workspace-page.visible')?.id;
  if(page==='admissions')openNewApplicationModal();
  else if(page==='fees'||page==='fees-and-payments')openNewFeeStructureModal();
  else if(page==='assignments'&&activeRole==='teacher')openNewAssignmentRealModal();
  else if(page==='cbt-exams'&&activeRole==='teacher')openNewExamModal();
  else if(page==='schools-campuses')openNewSchoolModal();
  else if(page==='payroll'||page==='people-and-payroll')openNewPayrollModal();
  else if(page==='messages'||page==='communication')openComposeModal();
  else if(page==='teachers')openNewTeacherModal();
  else toast('Open a workspace page to create a matching record');
});
changeRole('proprietor');
