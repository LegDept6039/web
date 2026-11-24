// Test-process transport only. Never imported by application code.
if (process.env.PORTAL_AUTH_TEST_FIXTURE === "1") {
  const barangayAffairsFixture = process.env.PORTAL_BARANGAY_AFFAIRS_TEST_FIXTURE === "1";
  const departmentBranchesFixture = process.env.PORTAL_DEPARTMENT_BRANCHES_TEST_FIXTURE === "1";
  const barangayAffairsOfficeId = "10000000-0000-4000-8000-000000000008";
  const realFetch = globalThis.fetch;
  const staffSessions = new Map();
  const authSessions = new Map();
  const passwords = new Map();
  const passwordResets = new Map();
  const officeIds = {
    mpdc: "10000000-0000-4000-8000-000000000001",
    assessor: "10000000-0000-4000-8000-000000000002",
    mayor: "10000000-0000-4000-8000-000000000003",
    sb: "10000000-0000-4000-8000-000000000004",
    mho: "10000000-0000-4000-8000-000000000005",
    menro: "10000000-0000-4000-8000-000000000006",
    accounting: "10000000-0000-4000-8000-000000000007",
  };
  const now = new Date().toISOString();
  const users = ["superadmin", "editor", "admin", "viewer"].map((role, i) => ({
    user_id: `00000000-0000-4000-8000-00000000000${i + 1}`,
    email: `${role}@example.test`,
    display_name: role === "superadmin" ? "Test Super Admin" : `Test ${role}`,
    role,
    active: true,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  }));
  for (const [index, name] of [
    "secretary",
    "vmo",
    "restricted",
    "mho",
    "accounting",
  ].entries())
    users.push({
      user_id: `00000000-0000-4000-8000-00000000000${index + 5}`,
      email: `${name}@example.test`,
      display_name: name,
      role: "admin",
      active: true,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    });
  for (const [i, scenario] of [
    "legislative-editor",
    "inactive",
    "missing-profile",
    "no-membership",
    "profile-error",
    "membership-error",
    "invalid-role",
  ].entries())
    users.push({
      user_id: `20000000-0000-4000-8000-00000000000${i + 1}`,
      email: `${scenario}@example.test`,
      display_name: scenario,
      role: scenario === "invalid-role" ? "old-role" : "editor",
      active: scenario !== "inactive",
      deleted_at: null,
      created_at: now,
      updated_at: now,
      scenario,
    });
  const officials = [];
  const offices = Object.entries(officeIds).map(([slug, id]) => ({
    id,
    name: {
      mpdc: "Municipal Planning and Development Office",
      assessor: "Municipal Assessor",
      mayor: "Mayor's Office",
      sb: "Legislative Access",
      mho: "Municipal Health Office",
      menro: "Municipal Environment Office",
      accounting: "Municipal Accounting Office",
      vmo: "Vice-Mayor Office",
      secretary: "SB Secretary",
    }[slug],
    short_name: slug === "sb" ? "Legislative Access" : slug.toUpperCase(),
    archived_at: null,
    slug,
    department: ["sb", "vmo", "secretary"].includes(slug)
      ? "legislative"
      : "executive",
    active: true,
    description: "Test office",
    created_at: now,
    updated_at: now,
  }));
  let access = [
    {
      user_id: users[1].user_id,
      office_id: officeIds.mpdc,
      permission_level: "editor",
    },
    ...[officeIds.mpdc, officeIds.assessor].map((office_id) => ({
      user_id: users[2].user_id,
      office_id,
      permission_level: "manager",
    })),
    {
      user_id: users[3].user_id,
      office_id: officeIds.sb,
      permission_level: "viewer",
    },
  ];
  access.push(
    ...["secretary", "vmo", "restricted", "mho", "accounting"].map((name) => ({
      user_id: users.find((u) => u.email === `${name}@example.test`).user_id,
      office_id:
        name === "restricted"
          ? officeIds.mayor
          : ["mho", "accounting"].includes(name)
            ? officeIds[name]
            : officeIds.sb,
      permission_level: "manager",
    })),
  );
  access.push({
    user_id: users.find((u) => u.scenario === "legislative-editor").user_id,
    office_id: officeIds.sb,
    permission_level: "editor",
  });
  for (const [index, role] of ["editor", "viewer"].entries()) {
    const user_id = `60000000-0000-4000-8000-00000000000${index + 1}`;
    users.push({
      user_id,
      email: `service-${role}@example.test`,
      display_name: `Service ${role}`,
      role,
      active: true,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    });
    access.push({ user_id, office_id: officeIds.mho, permission_level: role });
  }
  // Independent accounts isolate password mutations from other administration tests.
  for (const [deviceIndex, device] of ["desktop", "mobile"].entries()) {
    for (const [scenarioIndex, scenario] of ["success", "expired", "replaced", "restricted", "disabled"].entries()) {
      const user_id = `70000000-0000-4000-8000-${String(deviceIndex * 10 + scenarioIndex + 1).padStart(12, "0")}`;
      users.push({
        user_id,
        email: `reset-${scenario}-${device}@example.test`,
        display_name: `Reset ${scenario} ${device}`,
        role: "editor",
        active: scenario !== "disabled",
        deleted_at: null,
        created_at: now,
        updated_at: now,
        scenario: `reset-${scenario}`,
      });
      access.push({ user_id, office_id: officeIds.mho, permission_level: "editor" });
    }
  }
  const departments = Object.entries(officeIds).map(([slug, office_id]) => ({
    ...offices.find((o) => o.id === office_id),
    id: office_id,
    legacy_profile_id: `test-${slug}`,
    body: "",
    image_url: null,
    head_description: "",
    slug,
    head_name: ["mho", "menro"].includes(slug)
      ? `${slug.toUpperCase()} head`
      : null,
    head_title: null,
    head_photo: null,
    name: `${slug.toUpperCase()} draft`,
    description: "Private test content",
    office_id,
    content_scope: ["sb", "vmo", "secretary"].includes(slug)
      ? "legislative"
      : "executive",
    published: ["mho", "menro"].includes(slug),
    is_sample: false,
    sort_order: 0,
    updated_at: now,
  }));
  const news = [
    {
      id: "30000000-0000-4000-8000-000000000001",
      slug: "menro-draft",
      title: "MENRO private draft",
      category: "Environment",
      date: "2026-10-02",
      excerpt: "Private",
      image: "/images/news/community.svg",
      content: ["Private"],
      office_id: officeIds.menro,
      content_scope: "executive",
      published: false,
      is_sample: false,
      sort_order: 0,
    },
  ];
  const sessions = [],
    committees = [],
    ordinances = [],
    resolutions = [],
    municipal_documents = [];
  const programs = [];
  const services = [
    {
      id: "61000000-0000-4000-8000-000000000003",
      name: "Legacy consultation guidance",
      description: "Existing plain-text service guidance.",
      body: "Bring your identification.\nPresent your existing records.\n\nStaff will explain the next steps.",
      rich_body: null,
      icon: "FileText",
      office: "MHO draft",
      steps: [],
      office_id: officeIds.mho,
      content_scope: "executive",
      published: true,
      is_sample: false,
      sort_order: 1,
      updated_at: now,
    },
    {
      id: "61000000-0000-4000-8000-000000000001",
      name: "MENRO private service",
      description: "Private environment service",
      body: "Private environment service details.",
      icon: "FileText",
      office: "MENRO draft",
      steps: [],
      office_id: officeIds.menro,
      content_scope: "executive",
      published: false,
      is_sample: false,
      sort_order: 0,
      updated_at: now,
    },
    {
      id: "61000000-0000-4000-8000-000000000002",
      name: "Unpublished department service",
      description: "Must stay hidden with its department",
      body: "Service owned by a department that is not public.",
      icon: "FileText",
      office: "MPDC draft",
      steps: [],
      office_id: officeIds.mpdc,
      content_scope: "executive",
      published: true,
      is_sample: false,
      sort_order: 1,
      updated_at: now,
    },
  ];
  const document_categories = [
    {
      id: "fixture-bids",
      name: "Bidding documents",
      description: "Procurement notices",
      content_scope: "transparency",
      office_id: null,
      is_sample: false,
      published: true,
      sort_order: 1,
      updated_at: now,
    },
  ];
  const department_contacts = [];
  const municipal_contact_settings = [{
    id: "municipal",
    municipality_name: "Municipality of Pinamungajan",
    address: "Municipal Hall\nPinamungajan, Cebu\nPhilippines",
    telephone: null,
    email: null,
    office_hours: null,
    social_label: null,
    social_url: null,
    map_embed_url: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d635.3927542769925!2d123.58431921186467!3d10.270176820265034!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33a96f90bd4bd703%3A0x7e7ba0656a6eb073!2sPinamungajan%20Municipal%20Hall!5e1!3m2!1sen!2sph!4v1795094335905!5m2!1sen!2sph",
    updated_at: now,
  }];
  for (const [i, d] of departments.filter((d) => d.published).entries())
    d.sort_order = i + 1;
  const legislative_terms = [
    { id: '20000000-0000-4000-8000-000000000001', name: 'Current Council', start_date: '2025-07-01', end_date: '2028-06-30', updated_at: now },
    { id: '20000000-0000-4000-8000-000000000002', name: 'Previous Council', start_date: '2022-07-01', end_date: '2025-06-30', updated_at: now },
  ];
  const committee_master = ['Current Committee', 'Committee desktop', 'Committee mobile'].map((name, i) => ({id: `30000000-0000-4000-8000-00000000000${i+1}`,name,sort_order:i,updated_at:now}));
  if (process.env.PORTAL_COMMITTEE_MASTER_TEST_FIXTURE === "1")
    for (let index=4; index<=25; index++) committee_master.push({id:`30000000-0000-4000-8000-${String(index).padStart(12,'0')}`, name:index === 4 ? 'Committee for Long Catalog Names, Community Organizations, Public Participation and Administrative Coordination' : `Additional Standing Committee ${index}`,sort_order:index,updated_at:now});
  const collections = {
    barangays: [],
    sk_profiles: [],
    committee_master,
    legislative_terms,
    sessions,
    committees,
    ordinances,
    resolutions,
    municipal_documents,
    document_categories,
    officials,
    news,
    programs,
    services,
    departments,
    department_contacts,
    municipal_contact_settings,
    audit_logs: [],
  };
  if (barangayAffairsFixture) {
    const office = {
      id: barangayAffairsOfficeId, office_id: barangayAffairsOfficeId,
      name: "Barangay Affairs", short_name: "Barangay Affairs", slug: "barangay-affairs",
      department: "executive", content_scope: "executive", active: true,
      published: false, archived_at: null, is_sample: false, sort_order: 0,
      description: "Barangay content workspace", body: "", head_description: "",
      image_url: null, head_name: null, head_title: null, head_photo: null,
      created_at: now, updated_at: now,
    };
    offices.push({...office});
    departments.push({...office});
    for (const [index, role] of ["editor", "admin", "viewer"].entries()) {
      const user_id = `81000000-0000-4000-8000-00000000000${index + 1}`;
      users.push({user_id,email:`barangay-${role}@example.test`,display_name:`Barangay ${role}`,role,
        active:true,deleted_at:null,created_at:now,updated_at:now});
      access.push({user_id,office_id:barangayAffairsOfficeId,permission_level:role === "admin" ? "manager" : role});
    }
    for (const [index, name, published] of [[1,"Anislag",true],[2,"Anopog",true],[3,"Draft Community",false]])
      collections.barangays.push({id:`80000000-0000-4000-8000-00000000000${index}`,name,
        slug:name.toLowerCase().replaceAll(" ","-"),captain_name:`Captain ${name}`,image_url:null,
        body:`Information about ${name}.`,rich_body:null,published,sort_order:index,created_at:now,updated_at:now});
    const base = {category:"Barangay Affairs",date:"2026-11-23",excerpt:"Community news for residents.",
      image:"/images/news/community.svg",content:["Community news details."],rich_body:null,
      office_id:barangayAffairsOfficeId,content_scope:"executive",is_sample:false,created_at:now,updated_at:now};
    for (const [index, slug, title, barangay, published] of [
      [1,"anislag-community-update","Anislag community update",1,true],
      [2,"anislag-private-update","Anislag unpublished news",1,false],
      [3,"anopog-community-update","Anopog community update",2,true],
      [4,"hidden-community-update","Unpublished community news",3,true],
    ]) news.push({...base,id:`82000000-0000-4000-8000-00000000000${index}`,slug,title,
      barangay_id:`80000000-0000-4000-8000-00000000000${barangay}`,published,sort_order:published ? index : 0});
    news.push({...base,id:"82000000-0000-4000-8000-000000000005",slug:"ordinary-office-update",
      title:"Ordinary department update",office_id:officeIds.mho,barangay_id:null,published:true,sort_order:1});
  }
  const affairsAccess = (actor, write = false) => {
    if (!actor?.active || actor.deleted_at) return false;
    if (actor.role === "superadmin") return true;
    const membership = access.find(a => a.user_id === actor.user_id && a.office_id === barangayAffairsOfficeId);
    const office = departments.find(d => d.id === barangayAffairsOfficeId);
    return Boolean(office?.active && !office.archived_at && membership &&
      (!write || (["admin","editor"].includes(actor.role) && ["editor","manager"].includes(membership.permission_level))));
  };
  const newsWriteAllowed = (actor, record) => Boolean(actor?.active && !actor.deleted_at &&
    (actor.role === "superadmin" || (["admin","editor"].includes(actor.role) && access.some(a =>
      a.user_id === actor.user_id && a.office_id === record.office_id && ["editor","manager"].includes(a.permission_level)))));
  const validNewsBarangay = (record) => record.office_id === barangayAffairsOfficeId
    ? record.content_scope === "executive" && collections.barangays.some(b => b.id === record.barangay_id)
    : record.barangay_id == null;
  if (process.env.PORTAL_TERM_TEST_FIXTURE === '1') {
    const currentTerm = legislative_terms[0].id, previousTerm = legislative_terms[1].id;
    const base = { office_id: officeIds.sb, content_scope: 'legislative', published: true, is_sample: false, sort_order: 1, updated_at: now, created_at: now };
    for (const [id, name, term_id, published] of [['term-current-a','Current Member A',currentTerm,true],['term-current-b','Current Member B',currentTerm,true],['term-previous-a','Previous Member',previousTerm,true],['term-draft','Draft Member',currentTerm,false],['term-unassigned','Unassigned Member',null,true],['committees','Legacy Member desktop',null,true],['finance','Legacy Member mobile',null,true]])
      officials.push({...base,id,name,term_id,published,branch:'legislative',legislative_role:'SANGGUNIANG_BAYAN',role:'Council member',description:'Member description',photo_url:null});
    committees.push({...base,id:'term-committee',name:'Current Committee',term_id:currentTerm,responsibility:'Current responsibilities',chair:'',chair_id:'term-current-a',vice_chair_id:'term-current-b'});
    sessions.push({...base,id:'term-session',name:'Current Session',term_id:currentTerm,number:'1',date:'2026-11-16',type:'Regular session',description:'Session description',agenda:[],image:'/images/department-placeholder.svg'});
    sessions.push({...base,id:'term-old-session',name:'Previous Session',term_id:previousTerm,number:'1',date:'2024-11-16',type:'Regular session',description:'Session description',agenda:[],image:'/images/department-placeholder.svg'});
  }
  if (process.env.PORTAL_TRANSFER_TEST_FIXTURE === "1") {
    officials.push({id:'transfer-vice-mayor',name:'Vice Mayor',office_id:officeIds.sb,content_scope:'legislative',branch:'legislative',legislative_role:'MUNICIPAL_VICE_MAYOR',term_id:legislative_terms[0].id,published:true,is_sample:false,sort_order:1,description:'Vice Mayor',role:'Vice Mayor',updated_at:now});
    officials.push({
      id: "transfer-executive-official",
      name: "Executive Office Official",
      office_id: officeIds.mpdc,
      content_scope: "executive",
      branch: "executive",
      role: "Department head",
      term_id: null,
      description: "An official outside the Legislative office",
      published: true,
      is_sample: false,
      sort_order: 1,
      updated_at: now,
    });
    for (const [index, title] of ["Pagination first record", "Pagination duplicate target"].entries())
      municipal_documents.push({
        id: `00000000-0000-4000-8000-00000000010${index}`,
        title,
        date: "2026-11-17",
        description: "Existing report for capped pagination checks.",
        office_id: officeIds.sb,
        content_scope: "legislative",
        document_type: "executive-order",
        term_id: legislative_terms[0].id,
        published: true,
        is_sample: false,
        sort_order: index + 1,
        file_url: "",
        deleted_at: null,
        updated_at: now,
      });
  }
  if (process.env.PORTAL_DOCUMENT_SESSION_TEST_FIXTURE === "1") {
    const base = sessions.find(s => s.id === 'term-session');
    for (const [id,name,date] of [['sixth-session','6th Regular Session','2025-08-08'],['seventh-session','7th Regular Session','2025-08-09'],['special-session','Special Session','2025-08-09']])
      sessions.push({...base,id,name,date});
    officials.push({...officials.find(o => o.id === 'term-current-a'),id:'vice-mayor-session-test',name:'Vice Mayor Test',legislative_role:'MUNICIPAL_VICE_MAYOR'});
  }
  for (const committee of committees) {
    committee.master_id = committee_master.find(m => m.name === committee.name)?.id || null;
  }
  if (process.env.PORTAL_COMMITTEE_MASTER_TEST_FIXTURE === "1")
    for (const device of ['desktop','mobile']) committees.push({id:`legacy-${device}`,name:`Historical Committee ${device}`,master_id:null,term_id:null,chair:'',responsibility:'Historical description',office_id:officeIds.sb,content_scope:'legislative',published:true,is_sample:false,sort_order:1,created_at:now,updated_at:now});
  if (process.env.PORTAL_PAGINATION_TEST_FIXTURE === "1") {
    const currentTerm = legislative_terms[0].id;
    const previousTerm = legislative_terms[1].id;
    const base = { office_id: officeIds.sb, content_scope: "legislative", published: true, is_sample: false, term_id: currentTerm, created_at: now, updated_at: now };
    const sequence = (value) => String(value).padStart(2, "0");
    for (const rows of [officials, sessions, committees, committee_master, municipal_documents, document_categories]) rows.length = 0;
    for (let index = 1; index <= 31; index++) {
      const suffix = sequence(index);
      const masterId = `51000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
      const moduleId = `pagination-module-${suffix}`;
      officials.push({ ...base, id: `pagination-official-${suffix}`, name: `Pagination Official ${suffix}`, description: "Fixture council member", branch: "legislative", legislative_role: "SANGGUNIANG_BAYAN", role: "Council Member", sort_order: index });
      sessions.push({ ...base, id: `pagination-session-${suffix}`, name: `Pagination Session ${suffix}`, number: suffix, date: "2026-11-17", type: "Regular session", description: "Fixture session", agenda: [], image: "/images/department-placeholder.svg", sort_order: index });
      committee_master.push({ id: masterId, name: `Pagination Committee ${suffix}`, sort_order: index, updated_at: now });
      committees.push({ ...base, id: `pagination-committee-${suffix}`, master_id: masterId, name: `Pagination Committee ${suffix}`, chair: "", chair_id: "pagination-official-01", vice_chair_id: "pagination-official-02", responsibility: "Fixture committee", sort_order: index });
      municipal_documents.push({ ...base, id: `pagination-document-${suffix}`, title: `Pagination Report ${suffix}`, date: "2026-11-17", description: "Fixture Executive Order", document_type: "executive-order", session_id: null, file_url: "", deleted_at: null, sort_order: index });
      document_categories.push({ id: moduleId, name: `Pagination Module ${suffix}`, description: "Fixture Transparency module", content_scope: "transparency", office_id: null, published: true, deleted_at: null, is_sample: false, sort_order: index, updated_at: now });
      municipal_documents.push({ id: `pagination-transparency-${suffix}`, title: `Quarterly Budget ${suffix}`, date: "2026-11-17", description: "Fixture Transparency report", report_frequency: "quarterly", report_year: 2026, category_id: "pagination-module-01", q1_pdf_path: "transparency/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.pdf", content_scope: "transparency", office_id: null, published: true, deleted_at: null, is_sample: false, sort_order: index, updated_at: now });
      users.push({ user_id: `52000000-0000-4000-8000-${String(index).padStart(12, "0")}`, email: `pagination${suffix}@example.test`, display_name: `Pagination Staff ${suffix}`, role: "viewer", active: true, deleted_at: null, created_at: "2026-01-01T00:00:00Z", updated_at: now });
      const departmentId = `53000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
      departments.push({ id: departmentId, office_id: departmentId, name: `Pagination Department ${suffix}`, short_name: `PD${suffix}`, slug: `pagination-department-${suffix}`, department: "executive", content_scope: "executive", active: true, published: true, archived_at: null, is_sample: false, sort_order: index + 10, description: "Fixture department", body: "", head_description: "", created_at: now, updated_at: now });
    }
    officials.push({ ...officials[0], id: "pagination-previous-official", name: "Previous Term Official", term_id: previousTerm, sort_order: 1 });
    officials.push({ ...officials[0], id: "pagination-foreign-official", name: "Foreign Office Official", office_id: officeIds.mpdc, content_scope: "executive", branch: "executive", legislative_role: null, term_id: null });
    sessions.push({ ...sessions[0], id: "pagination-previous-session", name: "Previous Term Session", date: "2024-11-17", term_id: previousTerm });
    municipal_documents.push({ ...municipal_documents[0], id: "pagination-agenda", title: "Agenda Outside EO Filter", document_type: "agenda", session_id: sessions[0].id });
    municipal_documents.push({ ...municipal_documents[0], id: "pagination-previous-document", title: "Previous Term Report", date: "2024-11-17", term_id: previousTerm });
    municipal_documents.push({ ...municipal_documents[1], id: "pagination-transparency-old", title: "Previous Year Budget", category_id: "pagination-module-02", report_year: 2025 });
    for (let index = 1; index <= 27; index++) committees.push({ ...base, id: `pagination-historical-${sequence(index)}`, name: `Preserved Committee ${sequence(index)}`, master_id: null, chair: "", chair_id: "pagination-official-01", vice_chair_id: "pagination-official-02", responsibility: "Existing unlinked composition", sort_order: index + 31 });
    for (let index = 1; index <= 29; index++) legislative_terms.push({ id: `54000000-0000-4000-8000-${String(index).padStart(12, "0")}`, name: `Historical Term ${sequence(index)}`, start_date: `${1900 + index}-01-01`, end_date: `${1900 + index}-12-31`, updated_at: now });
    collections.audit_logs = Array.from({ length: 55 }, (_, index) => ({ id: `pagination-audit-${sequence(index + 1)}`, user_id: users[0].user_id, action: "fixture_review", entity_type: "pagination_fixture", entity_id: String(index + 1), office_id: officeIds.sb, description: `Pagination Audit ${sequence(index + 1)}`, created_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString() }));
  }
  // Isolated, read-only dashboard scenarios. Never enabled by other suites or production.
  if (process.env.PORTAL_LEGISLATIVE_DASHBOARD_TEST_FIXTURE === "1") {
    const currentTerm = legislative_terms[0].id;
    const previousTerm = legislative_terms[1].id;
    const base = { office_id: officeIds.sb, content_scope: "legislative", published: true, is_sample: false, term_id: currentTerm, sort_order: 1, created_at: now, updated_at: now, deleted_at: null };
    const addOfficial = (id, name, extra = {}) => officials.push({ ...base, id, name, description: "Dashboard fixture official", branch: "legislative", legislative_role: "SANGGUNIANG_BAYAN", role: "Council member", photo_url: null, ...extra });
    addOfficial("dashboard-a", "Dashboard Official A");
    addOfficial("dashboard-b", "Dashboard Official B", { sort_order: 2 });
    addOfficial("dashboard-zero", "Dashboard Zero Official", { sort_order: 3 });
    addOfficial("dashboard-draft", "Dashboard Draft Official", { sort_order: 4, published: false });
    addOfficial("dashboard-vice", "Dashboard Vice Mayor", { sort_order: 0, legislative_role: "MUNICIPAL_VICE_MAYOR", role: "Vice Mayor" });
    addOfficial("dashboard-previous", "Dashboard Previous Official", { term_id: previousTerm });
    addOfficial("dashboard-unassigned", "Dashboard Unassigned Official", { term_id: null });
    addOfficial("dashboard-foreign", "Dashboard Foreign Official", { office_id: officeIds.mpdc, content_scope: "executive", branch: "executive", legislative_role: null });
    const addAct = (rows, id, author_id, co_author_id, extra = {}) => rows.push({ ...base, id, title: `Dashboard ${id}`, number: id, date_approved: "2026-11-17", summary: "Dashboard fixture measure", author: "", co_author: "", author_id, co_author_id, file_url: "", ...extra });
    addAct(resolutions, "dashboard-resolution-a", "dashboard-a", "dashboard-b");
    addAct(resolutions, "dashboard-resolution-b", "dashboard-a", null);
    addAct(resolutions, "dashboard-resolution-c", "dashboard-b", "dashboard-a");
    addAct(ordinances, "dashboard-ordinance-a", "dashboard-b", "dashboard-a");
    addAct(ordinances, "dashboard-ordinance-b", "dashboard-b", null);
    for (const [rows, type] of [[resolutions, "resolution"], [ordinances, "ordinance"]]) {
      addAct(rows, `dashboard-${type}-draft`, "dashboard-a", "dashboard-b", { published: false });
      addAct(rows, `dashboard-${type}-foreign`, "dashboard-a", "dashboard-b", { office_id: officeIds.mpdc, content_scope: "executive" });
      addAct(rows, `dashboard-${type}-wrong-scope`, "dashboard-a", "dashboard-b", { content_scope: "transparency" });
      addAct(rows, `dashboard-${type}-previous`, "dashboard-previous", null, { term_id: previousTerm, date_approved: "2024-11-17" });
    }
    const addSession = (id, extra = {}) => sessions.push({ ...base, id, name: `Dashboard ${id}`, number: id, date: "2026-11-17", type: "Regular session", description: "Dashboard fixture session", agenda: [], image: "/images/department-placeholder.svg", ...extra });
    addSession("dashboard-session-current");
    addSession("dashboard-session-draft", { published: false });
    addSession("dashboard-session-previous", { term_id: previousTerm, date: "2024-11-17" });
    addSession("dashboard-session-unassigned", { term_id: null });
    addSession("dashboard-session-foreign", { office_id: officeIds.mpdc, content_scope: "executive" });
    const addDocument = (id, extra = {}) => municipal_documents.push({ ...base, id, title: `Dashboard ${id}`, date: "2026-11-17", description: "Dashboard fixture document", document_type: "agenda", session_id: null, file_url: "", ...extra });
    addDocument("dashboard-document-agenda");
    addDocument("dashboard-document-minutes", { document_type: "minutes" });
    addDocument("dashboard-document-draft", { published: false });
    addDocument("dashboard-document-deleted", { deleted_at: now });
    addDocument("dashboard-document-foreign", { office_id: officeIds.mpdc, content_scope: "executive" });
    addDocument("dashboard-document-wrong-scope", { content_scope: "transparency" });
    addDocument("dashboard-document-previous", { term_id: previousTerm, date: "2024-11-17" });
  }
  // Representative, isolated rows for the CMS action-control presentation audit.
  if (process.env.PORTAL_ACTION_ICONS_TEST_FIXTURE === "1") {
    const base = { published: true, is_sample: false, sort_order: 1, created_at: now, updated_at: now };
    collections.sk_profiles.push({ ...base, id: "93000000-0000-4000-8000-000000000001",
      barangay_id: "80000000-0000-4000-8000-000000000001", slug: "anislag",
      chairperson_name: "Fixture SK chairperson", image_url: null, body: "Fixture SK profile", rich_body: null });
    programs.push({ ...base, id: "94000000-0000-4000-8000-000000000001", name: "CMS community program",
      description: "Fixture program", category: "Community", status: "Ongoing",
      office_id: officeIds.mho, content_scope: "executive" });
    department_contacts.push({ ...base, id: "94000000-0000-4000-8000-000000000002", type: "EMAIL",
      value: "records@example.test", label: "Records", office_id: officeIds.mho, content_scope: "executive" });
    collections.hearings = [{ ...base, id: "actions-hearing", title: "CMS public hearing", date: "2026-11-23",
      venue: "Municipal Hall", sectors: "Residents", related_ordinance: "", status: "Upcoming",
      office_id: officeIds.sb, content_scope: "legislative" }];
    municipal_documents.push({ ...base, id: "95000000-0000-4000-8000-000000000001",
      title: "CMS quarterly report", description: "Fixture report", report_frequency: "quarterly", report_year: 2026,
      category_id: "fixture-bids", q1_pdf_path: "transparency/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.pdf",
      office_id: null, content_scope: "transparency", deleted_at: null });
    const user_id = "92000000-0000-4000-8000-000000000001";
    users.push({ user_id, email: "actions-viewer@example.test", display_name: "CMS read-only viewer", role: "viewer",
      active: true, deleted_at: null, transparency_access: true, created_at: now, updated_at: now });
    access.push(...[officeIds.sb, barangayAffairsOfficeId].map(office_id => ({user_id, office_id, permission_level: "viewer"})));
  }
  if (departmentBranchesFixture) {
    for (const department of departments) department.parent_department_id = null;
    const branchRows = [
      ["001", "Treasury", "TREASURY", "treasury", null, null],
      ["002", "Engineering", "ENGINEERING", "engineering", null, null],
      ["003", "Market Affairs", "MARKET", "market-affairs", "001", "/images/news/community.svg"],
      ["004", "Slaughter House", "SLAUGHTER", "slaughter-house", "001", "/images/news/coast.svg"],
      ["005", "Waterworks", "WATERWORKS", "waterworks", "002", "/images/news/council.svg"],
    ];
    for (const [suffix, name, short_name, slug, parent, image_url] of branchRows) {
      const id = `97000000-0000-4000-8000-000000000${suffix}`;
      const department = { id, office_id: id, name, short_name, slug, department: "executive",
        content_scope: "executive", parent_department_id: parent ? `97000000-0000-4000-8000-000000000${parent}` : null,
        active: true, archived_at: null, published: true, sort_order: Number(suffix) + 2,
        description: `${name} community services.`, body: `${name} has its own office information.`,
        image_url, head_name: `${name} officer`, head_title: "Office head", head_description: "Serving the municipality.",
        head_photo: "/images/logos/seal.png", is_sample: false, created_at: now, updated_at: now };
      departments.push(department);
      offices.push(department);
    }
    for (const [index, username, office, permission_level] of [
      [1, "treasury-editor", "001", "editor"],
      [2, "market-editor", "003", "editor"],
      [3, "branch-viewer", "003", "viewer"],
      [4, "mixed-branch-editor", "003", "editor"],
    ]) {
      const user_id = `98000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
      users.push({ user_id, email: `${username}@example.test`, display_name: username,
        role: permission_level, active: true, deleted_at: null, created_at: now, updated_at: now });
      access.push({ user_id, office_id: `97000000-0000-4000-8000-000000000${office}`, permission_level });
      if (username === "mixed-branch-editor")
        access.push({ user_id, office_id: officeIds.sb, permission_level: "editor" });
    }
  }
  function publicDepartmentVisible(row) {
    if (!row.published || !row.active || row.archived_at) return false;
    if (!row.parent_department_id) return true;
    const parent = departments.find(item => item.id === row.parent_department_id);
    return !!parent && parent.published && parent.active && !parent.archived_at;
  }
  const scope = (table, row) =>
    table === "departments"
      ? row.department
      : `${row.content_scope}:${row.office_id || "unassigned"}`;
  function reorder(table, old, next) {
    if (["committee_master", "municipal_contact_settings"].includes(table)) return;
    const all = collections[table];
    if (!all) return;
    if (
      old &&
      next &&
      old.published === next.published &&
      old.sort_order === next.sort_order &&
      scope(table, old) === scope(table, next)
    )
      return;
    if (old?.published)
      for (const r of all)
        if (
          r !== old &&
          r.published &&
          scope(table, r) === scope(table, old) &&
          r.sort_order > old.sort_order
        ) {
          r.sort_order--;
          r.updated_at = new Date().toISOString();
        }
    if (next?.published)
      for (const r of all)
        if (
          r !== old &&
          r.published &&
          scope(table, r) === scope(table, next) &&
          r.sort_order >= next.sort_order
        ) {
          r.sort_order++;
          r.updated_at = new Date().toISOString();
        }
    if (next && !next.published) next.sort_order = 0;
  }
  // Usernames are staff identities; Auth keeps its private email credential.
  for (const user of users) user.username = user.email.split("@")[0];
  const authUser = (p) => ({
    id: p.user_id,
    email: p.email,
    aud: "authenticated",
    role: "authenticated",
    created_at: now,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
  });
  const token = (p, sessionId) =>
    [
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
        "base64url",
      ),
      Buffer.from(
        JSON.stringify({
          sub: p.user_id,
          session_id: sessionId,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          aud: "authenticated",
          role: "authenticated",
        }),
      ).toString("base64url"),
      "test-signature",
    ].join(".");
  const response = (data, status = 200, headers = {}) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (url.hostname !== "fixture.supabase.test") return realFetch(input, init);
    const headers = new Headers(init.headers);
    const method = (init.method || "GET").toUpperCase();
    const body =
      init.body && !url.pathname.startsWith("/storage/")
        ? JSON.parse(String(init.body))
        : {};
    let subject, claims;
    try {
      claims = JSON.parse(
        Buffer.from(
          (headers.get("authorization") || "")
            .replace("Bearer ", "")
            .split(".")[1],
          "base64url",
        ).toString(),
      );
      subject = claims.sub;
    } catch {}
    const actor = users.find((u) => u.user_id === subject);
    const authSession = authSessions.get(claims?.session_id);
    const credentialsReady = (user, session = authSession) => {
      if (!user?.active || user.deleted_at) return false;
      const reset = passwordResets.get(user.user_id);
      return !reset || (reset.state === "complete" && session?.user_id === user.user_id && session.created_at > Date.parse(reset.completed_at));
    };
    const serviceRole = headers.get("apikey") === "sb_secret_fixture_test";
    if (url.pathname === "/rest/v1/rpc/password_reset_status") {
      if (!actor) return response({ code: "42501" }, 403);
      const reset = passwordResets.get(subject);
      return response({
        required: Boolean(reset && reset.state !== "complete"),
        ready: credentialsReady(actor),
        generation: reset?.generation || null,
        state: reset?.state || null,
        expires_at: reset?.expires_at || null,
        session_id: claims?.session_id || null,
      });
    }
    if (url.pathname === "/rest/v1/staff_password_resets") {
      if (!serviceRole || method !== "GET") return response({ code: "42501" }, 403);
      const id = url.searchParams.get("user_id")?.replace(/^eq\./, "");
      const rows = [...passwordResets.values()].filter((reset) => !id || reset.user_id === id);
      return response(headers.get("accept")?.includes("vnd.pgrst.object") ? rows[0] || null : rows);
    }
    if (url.pathname.startsWith("/rest/v1/rpc/") && [
      "begin_staff_password_reset", "activate_staff_password_reset", "claim_staff_password_change",
      "finish_staff_password_change", "fail_staff_password_reset", "begin_staff_password_update",
    ].includes(url.pathname.split("/").pop())) {
      if (!serviceRole) return response({ code: "42501" }, 403);
      const name = url.pathname.split("/").pop();
      const user = users.find((candidate) => candidate.user_id === body.p_user_id);
      const reset = passwordResets.get(body.p_user_id);
      const deny = () => response({ code: "42501", message: "Password operation unavailable" }, 403);
      const addAudit = (user_id, action, description) => collections.audit_logs.push({
        id: crypto.randomUUID(), user_id, action, entity_type: "staff_accounts",
        entity_id: body.p_user_id, description, created_at: new Date().toISOString(),
      });
      const clearBrowserSessions = () => {
        for (const key of staffSessions.keys()) if (key.startsWith(`${body.p_user_id}:`)) staffSessions.delete(key);
      };
      if (name === "begin_staff_password_reset" || name === "begin_staff_password_update") {
        if (!user?.active || user.deleted_at || ["issuing", "completing"].includes(reset?.state)) return deny();
        if (name === "begin_staff_password_reset") {
          const initiator = users.find((candidate) => candidate.user_id === body.p_actor);
          const initiatorSession = authSessions.get(body.p_actor_session);
          if (initiator?.role !== "superadmin" || initiator.user_id === user.user_id ||
            initiatorSession?.user_id !== initiator.user_id || !credentialsReady(initiator, initiatorSession)) return deny();
        } else if (!credentialsReady(user, authSessions.get(body.p_session_id))) return deny();
        passwordResets.set(user.user_id, {
          user_id: user.user_id, generation: body.p_generation,
          state: name === "begin_staff_password_reset" ? "issuing" : "completing",
          operation: name === "begin_staff_password_reset" ? "reset" : "change",
          initiated_by: body.p_actor || user.user_id,
          initiated_at: new Date().toISOString(), activated_at: null, expires_at: null,
          completed_at: null, temp_password_hash: body.p_password_hash,
        });
        clearBrowserSessions();
        if (name === "begin_staff_password_reset") addAudit(body.p_actor, "password_reset_started", "Superadmin initiated a temporary password reset");
        return response(true);
      }
      if (!reset || reset.generation !== body.p_generation) return deny();
      if (name === "activate_staff_password_reset") {
        if (reset.state !== "issuing") return deny();
        reset.state = "pending";
        reset.activated_at = new Date().toISOString();
        reset.expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      } else if (name === "claim_staff_password_change") {
        const session = authSessions.get(body.p_session_id);
        if (reset.state !== "pending" || Date.parse(reset.expires_at) <= Date.now() ||
          !user.active || user.deleted_at || session?.user_id !== user.user_id || session.created_at < Date.parse(reset.activated_at)) return deny();
        reset.state = "completing";
      } else if (name === "finish_staff_password_change") {
        if (reset.state !== "completing" || !user.active || user.deleted_at) return deny();
        reset.state = "complete";
        reset.completed_at = new Date().toISOString();
        reset.temp_password_hash = null;
        clearBrowserSessions();
        addAudit(user.user_id, reset.operation === "change" ? "password_changed" : "password_reset_completed", "Staff completed a password change");
      } else if (name === "fail_staff_password_reset") {
        if (!["issuing", "completing"].includes(reset.state)) return deny();
        reset.state = "failed";
        reset.temp_password_hash = null;
      }
      return response(true);
    }
    if (
      url.pathname.startsWith("/rest/v1/rpc/") &&
      [
        "start_staff_session",
        "staff_session_deadline",
        "end_staff_session",
      ].includes(url.pathname.split("/").pop())
    ) {
      const name = url.pathname.split("/").pop();
      const key = `${subject}:${body.p_hash}`;
      if (name === "end_staff_session") {
        staffSessions.delete(key);
        return response(null);
      }
      if (!credentialsReady(actor)) return response(null);
      if (name === "start_staff_session") {
        staffSessions.set(key, Date.now() + 3600000);
        return response(true);
      }
      const expiry = staffSessions.get(key) || 0;
      if (expiry <= Date.now()) return response(0);
      if (body.p_touch) staffSessions.set(key, Date.now() + 3600000);
      return response(staffSessions.get(key) - Date.now());
    }

    if (
      url.pathname.startsWith("/storage/v1/object/upload/sign/") &&
      method === "POST"
    )
      return response({
        url: url.pathname.replace("/storage/v1", "") + "?token=fixture-upload",
      });
    if (
      url.pathname.startsWith(
        "/storage/v1/object/municipal-document-staging/",
      ) &&
      method === "GET"
    )
      return new Response("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n", {
        headers: { "Content-Type": "application/pdf" },
      });
    if (
      (url.pathname.startsWith("/storage/v1/object/municipal-news-staging/") ||
        url.pathname.startsWith(
          "/storage/v1/object/public/municipal-media/",
        )) &&
      method === "GET"
    ) {
      const { default: sharp } = await import("sharp");
      return new Response(
        await sharp("public/images/logos/seal.png")
          .resize(40, 40)
          .png()
          .toBuffer(),
        { headers: { "Content-Type": "image/png" } },
      );
    }
    if (
      url.pathname.startsWith("/storage/v1/object/sign/") &&
      method === "POST"
    )
      return response({
        signedURL:
          url.pathname.replace("/storage/v1", "") + "?token=fixture-download",
      });
    if (url.pathname.startsWith("/storage/v1/object/"))
      return response({
        Key: "municipal-media/" + url.pathname.split("/municipal-media/")[1],
      });
    if (url.pathname === "/auth/v1/token") {
      if (url.searchParams.get("grant_type") === "refresh_token")
        return response(
          {
            msg: "Invalid Refresh Token: Refresh Token Not Found",
            error_code: "refresh_token_not_found",
          },
          400,
        );
      const user = users.find((u) => u.email === body.email);
      if (!user || body.password !== (passwords.get(user.user_id) || "TestPassword123!"))
        return response(
          {
            msg: "Invalid login credentials",
            error_code: "invalid_credentials",
          },
          400,
        );
      const sessionId = crypto.randomUUID();
      authSessions.set(sessionId, { user_id: user.user_id, created_at: Date.now() });
      // Exercise a deadline passing after valid authentication, without exposing
      // an application test hook or waiting 30 minutes in browser tests.
      const reset = passwordResets.get(user.user_id);
      if (user.scenario === "reset-expired" && reset?.state === "pending")
        reset.expires_at = new Date(Date.now() - 1000).toISOString();
      return response({
        access_token: token(user, sessionId),
        refresh_token: "fixture-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user: authUser(user),
      });
    }
    if (url.pathname === "/auth/v1/user") {
      if (!actor) return response({ msg: "Unauthorized" }, 401);
      if (!authSession || authSession.user_id !== actor.user_id)
        return response({ msg: "Session from session_id claim in JWT does not exist", error_code: "session_not_found" }, 403);
      if (method === "PUT" && body.password) passwords.set(actor.user_id, body.password);
      return response(authUser(actor));
    }
    if (url.pathname === "/auth/v1/logout") {
      if (!authSession || authSession.user_id !== subject)
        return response({ msg: "Session from session_id claim in JWT does not exist", error_code: "session_not_found" }, 403);
      for (const [id, session] of authSessions) {
        if ((url.searchParams.get("scope") || "global") === "global" ? session.user_id === subject : id === claims?.session_id)
          authSessions.delete(id);
      }
      return new Response(null, { status: 204 });
    }
    if (url.pathname.startsWith("/auth/v1/admin/users")) {
      if (headers.get("apikey") !== "sb_secret_fixture_test")
        return response({ msg: "Missing server key" }, 403);
      if (method === "POST") {
        if (users.some((u) => u.email === body.email))
          return response({ msg: "Already registered" }, 422);
        const user = {
          user_id:
            "00000000-0000-4000-8000-" +
            String(users.length + 1).padStart(12, "0"),
          email: body.email,
          username: null,
          display_name: "",
          role: "viewer",
          active: false,
          deleted_at: null,
          created_at: now,
          updated_at: now,
        };
        users.push(user);
        if (body.password) passwords.set(user.user_id, body.password);
        return response({ user: authUser(user) });
      }
      const id = url.pathname.split("/").pop();
      const user = users.find((u) => u.user_id === id);
      if (user && method === "PUT" && body.password) {
        passwords.set(user.user_id, body.password);
        // Auth's admin password update atomically revokes every existing session.
        for (const [sessionId, session] of authSessions)
          if (session.user_id === user.user_id) authSessions.delete(sessionId);
      }
      if (method === "DELETE") {
        const i = users.indexOf(user);
        if (i >= 0) users.splice(i, 1);
        return response({});
      }
      return user
        ? response({ user: authUser(user) })
        : response({ msg: "Not found" }, 404);
    }
    if (["/rest/v1/rpc/manage_staff", "/rest/v1/rpc/manage_staff_account"].includes(url.pathname)) {
      if (actor?.role !== "superadmin" || !credentialsReady(actor)) return response({ code: "42501" }, 403);
      const target = users.find((u) => u.user_id === body.p_user_id);
      if (!target) return response({ code: "22023" }, 400);
      if (url.pathname.endsWith("/manage_staff_account")) {
        const username = String(body.p_username || "").trim().toLowerCase();
        if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username))
          return response({ code: "22023", message: "Invalid username" }, 400);
        if (users.some((user) => user !== target && user.username === username))
          return response({ code: "23505", message: "Username is already in use" }, 409);
        target.username = username;
      }
      Object.assign(target, {
        display_name: body.p_display_name,
        role: body.p_role,
        active: body.p_active && !body.p_delete,
        deleted_at: body.p_delete ? now : null,
        transparency_access:
          !body.p_delete && body.p_transparency_access === true,
      });
      access = access
        .filter((a) => a.user_id !== target.user_id)
        .concat(body.p_access.map((a) => ({ ...a, user_id: target.user_id })));
      return response(null);
    }
    if (url.pathname === "/rest/v1/rpc/audit_password_reset")
      return response(null);
    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.split("/").pop();
      if (["barangays", "sk_profiles"].includes(table) && !["GET", "HEAD"].includes(method) &&
          ((table === "barangays" && barangayAffairsFixture ? !affairsAccess(actor, true) :
            actor?.role !== "superadmin" || !actor.active || actor.deleted_at) || method === "DELETE"))
        return response({code: "42501", message: "Superadmin access required"}, 403);
      if (actor && !credentialsReady(actor) && table !== "staff_accounts")
        return response({ code: "42501", message: "Password change required" }, 403);
      if (table === "municipal_contact_settings" && method !== "GET" && method !== "HEAD") {
        if (method !== "PATCH" || actor?.role !== "superadmin" || !actor.active || actor.deleted_at)
          return response({ code: "42501", message: "Superadmin access required" }, 403);
      }
      // Opt-in latency for loading UI tests; ordinary fixture suites stay fast.
      if (
        process.env.PORTAL_TEST_CONTENT_DELAY_MS &&
        method === "GET" &&
        ["departments", "news", "department_contacts"].includes(table)
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, Number(process.env.PORTAL_TEST_CONTENT_DELAY_MS)),
        );
      }
      if (
        (table === "staff_accounts" && actor?.scenario === "profile-error") ||
        (table === "user_office_access" &&
          actor?.scenario === "membership-error")
      )
        return response(
          { code: "42501", message: "permission denied for table " + table },
          403,
        );
      if (
        method === "POST" &&
        [
          "committee_master",
          "legislative_terms",
          "barangays",
          "sk_profiles",
          "officials",
          "news",
          "programs",
          "services",
          "departments",
          "department_contacts",
          "sessions",
          "committees",
          "ordinances",
          "resolutions",
          "municipal_documents",
          "document_categories",
        ].includes(table)
      ) {
        if (barangayAffairsFixture && table === "news" && (Array.isArray(body) ? body : [body]).some(record =>
          !newsWriteAllowed(actor, record) || !validNewsBarangay(record)))
          return response({code:"42501",message:"Invalid barangay news ownership"},403);
        if (table === "barangays" && (Array.isArray(body) ? body : [body]).some((record) =>
          collections.barangays.some((existing) => existing.slug === record.slug)))
          return response({code:"23505",message:'duplicate key value violates unique constraint "barangays_slug_key"'},409);
        if (table === "sk_profiles") {
          for (const record of Array.isArray(body) ? body : [body]) {
            if (!collections.barangays.some((barangay) => barangay.id === record.barangay_id))
              return response({code:"23503",message:"Invalid barangay"},409);
            if (collections.sk_profiles.some((existing) => existing.barangay_id === record.barangay_id))
              return response({code:"23505",message:'duplicate key value violates unique constraint "sk_profiles_barangay_id_key"'},409);
            if (collections.sk_profiles.some((existing) => existing.slug === record.slug))
              return response({code:"23505",message:'duplicate key value violates unique constraint "sk_profiles_slug_key"'},409);
          }
        }
        const inserted = (Array.isArray(body) ? body : [body]).map((record) => {
          const row = {
            ...record,
            ...([
              "committee_master",
              "legislative_terms",
              "barangays",
              "sk_profiles",
              "officials",
              "department_contacts",
              "departments",
              "programs",
              "services",
            ].includes(table)
              ? { id: crypto.randomUUID() }
              : {}),
            created_by: actor?.user_id,
            updated_at: new Date().toISOString(),
          };
          if (table === "departments")
            Object.assign(row, {
              office_id: row.id,
              content_scope: row.department,
              published: record.published ?? true,
              is_sample: false,
              sort_order: record.sort_order ?? 0,
              active: record.active ?? true,
              archived_at: null,
              ...(departmentBranchesFixture ? { parent_department_id: record.parent_department_id ?? null } : {}),
              body: record.body ?? "",
              head_description: record.head_description ?? "",
            });
          if (!["barangays", "sk_profiles"].includes(table)) reorder(table, null, row);
          collections[table].push(row);
          return row;
        });
        return response(inserted);
      }
      let rows =
        table === "officials"
          ? officials
          : table === "staff_accounts"
            ? users.filter((u) => u.scenario !== "missing-profile")
            : table === "offices"
              ? offices
              : table === "user_office_access"
                ? access
                : table === "departments"
                  ? departments
                  : [];
      if (collections[table]) rows = collections[table];
      if (departmentBranchesFixture && table === "departments" && ["GET", "HEAD"].includes(method) &&
          url.searchParams.get("select")?.includes("parent:departments"))
        return response({ code: "PGRST200", details: "The departments self relationship is absent from the schema cache.",
          hint: null, message: "Could not find a relationship between 'departments' and 'departments' in the schema cache" }, 400);
      if (table === "barangays" && actor?.role !== "superadmin" && !(barangayAffairsFixture && affairsAccess(actor)))
        rows = rows.filter((row) => row.published);
      if (table === "sk_profiles") {
        if (actor?.role !== "superadmin") rows = rows.filter((row) => row.published &&
          collections.barangays.some((barangay) => barangay.id === row.barangay_id && barangay.published));
        if (["GET", "HEAD"].includes(method) && url.searchParams.get("select")?.includes("barangay:barangays"))
          rows = rows.map((row) => ({...row, barangay: collections.barangays.find((barangay) => barangay.id === row.barangay_id) || null}));
      }
      if (table === "legislative_documents")
        rows = [
          ...ordinances.map((r) => ({
            ...r,
            collection: "ordinances",
            document_type: "ordinance",
            date: r.date_approved,
            body: r.summary,
          })),
          ...resolutions.map((r) => ({
            ...r,
            collection: "resolutions",
            document_type: "resolution",
            date: r.date_approved,
            body: r.summary,
          })),
          ...municipal_documents.map((r) => ({
            ...r,
            collection: "documents",
            document_type: r.document_type || "legacy",
            body: r.description,
          })),
        ].filter((r) => r.content_scope === "legislative");
      if (table === "department_contacts") rows = department_contacts;
      if (table === "news") rows = news;
      if (table === "programs") rows = programs;
      if (table === "published_programs")
        rows = programs
          .filter((p) => p.published)
          .map((p) => {
            const d = departments.find((d) => d.id === p.office_id);
            return {
              ...p,
              source: {
                name: d?.name || "Municipal information portal",
                slug:
                  d?.active && d?.published && d?.department === "executive"
                    ? d.slug
                    : undefined,
              },
            };
          });
      if (table === "published_news")
        rows = news
          .filter((n) => n.published && (!barangayAffairsFixture || !n.barangay_id ||
            collections.barangays.some(b => b.id === n.barangay_id && b.published)))
          .map((n) => {
            const d = departments.find(
              (d) => d.office_id === n.office_id && d.published,
            );
            return {
              ...n,
              source: {
                name: (barangayAffairsFixture && collections.barangays.find(b => b.id === n.barangay_id)?.name) || d?.name || "Municipal information portal",
                slug: d?.slug,
              },
            };
          });
      if (!serviceRole && actor?.role !== "superadmin") {
        const assigned = access
          .filter((a) => a.user_id === actor?.user_id)
          .map((a) => a.office_id);
        if (table === "offices")
          rows = rows.filter((o) => assigned.includes(o.id));
        if (table === "staff_accounts")
          rows = rows.filter((u) => u.user_id === actor?.user_id);
        if (table === "departments")
          rows = rows.filter(
            (d) => d.published || assigned.includes(d.office_id),
          );
      }
      if (!actor && !serviceRole && !["legislative_terms", "municipal_contact_settings"].includes(table)) rows = rows.filter((r) => r.published);
      if (departmentBranchesFixture && !actor && !serviceRole && table === "departments")
        rows = rows.filter(publicDepartmentVisible);
      if (!actor && table === "services")
        rows = rows.filter((service) =>
          service.office_id == null || departments.some((department) =>
            department.id === service.office_id && department.department === "executive" &&
            department.active && department.published && department.archived_at == null,
          ),
        );
      for (const [key, val] of url.searchParams) {
        if (val.startsWith("ilike."))
          rows = rows.filter((r) =>
            String(r[key] || "")
              .toLowerCase()
              .includes(val.slice(6).replaceAll("%", "").toLowerCase()),
          );
        if (val.startsWith("eq."))
          rows = rows.filter((r) => String(key.split(".").reduce((value, part) => value?.[part], r)) === val.slice(3));
        if (val.startsWith("neq."))
          rows = rows.filter((r) => String(r[key]) !== val.slice(4));
        if (val === "not.is.null") rows = rows.filter((r) => r[key] != null);
        if (val.startsWith("is.null"))
          rows = rows.filter((r) => r[key] == null);
        if (val.startsWith("in.(")) {
          const values = val.slice(4, -1).split(",");
          rows = rows.filter((r) => values.includes(String(r[key])));
        }
      }
      if (method === "PATCH") {
        if (barangayAffairsFixture && table === "news") {
          rows = rows.filter(record => newsWriteAllowed(actor, record));
          if (rows.some(record => !newsWriteAllowed(actor, {...record,...body}) || !validNewsBarangay({...record,...body})))
            return response({code:"42501",message:"Invalid barangay news ownership"},403);
        }
        if (table === "sk_profiles" && body.barangay_id) {
          if (!collections.barangays.some((barangay) => barangay.id === body.barangay_id))
            return response({code:"23503",message:"Invalid barangay"},409);
          if (collections.sk_profiles.some((existing) => !rows.includes(existing) && existing.barangay_id === body.barangay_id))
            return response({code:"23505",message:'duplicate key value violates unique constraint "sk_profiles_barangay_id_key"'},409);
        }
        rows.forEach((r) => {
          const next = { ...r, ...body };
          if (!["barangays", "sk_profiles"].includes(table)) reorder(table, r, next);
          Object.assign(r, next, { updated_at: new Date().toISOString() });
        });
        return response(rows);
      }
      if (method === "DELETE") {
        const target = collections[table];
        if (target)
          for (const row of rows) {
            reorder(table, row, null);
            target.splice(target.indexOf(row), 1);
          }
        return response(rows);
      }
      const order = (url.searchParams.get("order") || "")
        .split(",")
        .filter(Boolean);
      rows = [...rows].sort((a, b) => {
        for (const field of order) {
          const [key, direction] = field.split(".");
          const x = a[key],
            y = b[key];
          const cmp = x === y ? 0 : x < y ? -1 : 1;
          if (cmp) return direction === "desc" ? -cmp : cmp;
        }
        return 0;
      });
      const count = rows.length;
      const offset = Number(url.searchParams.get("offset") || 0);
      let limit = Number(url.searchParams.get("limit") || 1000);
      if (
        process.env.PORTAL_TRANSFER_TEST_FIXTURE === "1" &&
        [200, 500].includes(limit) &&
        url.searchParams.get("select") !== "*" &&
        ["officials", "committees", "sessions", "ordinances", "resolutions", "municipal_documents"].includes(table)
      ) limit = 1;
      rows = rows.slice(offset, offset + limit);
      rows = rows.map((r) => ({
        ...r,
        author_record: officials.find((o) => o.id === r.author_id),
        co_author_record: officials.find((o) => o.id === r.co_author_id),
        chair_record: officials.find((o) => o.id === r.chair_id),
        committee_record: committees.find((o) => o.id === r.committee_id),
        session_record: sessions.find((o) => o.id === r.session_id),
      }));
      if (table === "staff_accounts") {
        const selected = url.searchParams.get("select");
        if (selected && selected !== "*") {
          const fields = selected.split(",");
          rows = rows.map((row) => Object.fromEntries(fields.map((field) => [field, row[field]])));
        }
      }
      const result = headers.get("accept")?.includes("vnd.pgrst.object")
        ? rows[0] || null
        : rows;
      return response(result, 200, {
        "content-range": `${offset}-${Math.max(offset, offset + rows.length - 1)}/${count}`,
      });
    }
    return response({ message: "Unhandled test request" }, 404);
  };
}
