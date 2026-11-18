// Test-process transport only. Never imported by application code.
if (process.env.PORTAL_AUTH_TEST_FIXTURE === "1") {
  const realFetch = globalThis.fetch;
  const staffSessions = new Map();
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
    departments,
    department_contacts,
  };
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
  const scope = (table, row) =>
    table === "departments"
      ? row.department
      : `${row.content_scope}:${row.office_id || "unassigned"}`;
  function reorder(table, old, next) {
    if (table === "committee_master") return;
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
  const authUser = (p) => ({
    id: p.user_id,
    email: p.email,
    aud: "authenticated",
    role: "authenticated",
    created_at: now,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
  });
  const token = (p) =>
    [
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
        "base64url",
      ),
      Buffer.from(
        JSON.stringify({
          sub: p.user_id,
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
    let subject;
    try {
      subject = JSON.parse(
        Buffer.from(
          (headers.get("authorization") || "")
            .replace("Bearer ", "")
            .split(".")[1],
          "base64url",
        ).toString(),
      ).sub;
    } catch {}
    const actor = users.find((u) => u.user_id === subject);
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
      if (!actor?.active || actor.deleted_at) return response(null);
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
      if (!user || body.password !== "TestPassword123!")
        return response(
          {
            msg: "Invalid login credentials",
            error_code: "invalid_credentials",
          },
          400,
        );
      return response({
        access_token: token(user),
        refresh_token: "fixture-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user: authUser(user),
      });
    }
    if (url.pathname === "/auth/v1/user")
      return actor
        ? response(authUser(actor))
        : response({ msg: "Unauthorized" }, 401);
    if (url.pathname === "/auth/v1/logout")
      return new Response(null, { status: 204 });
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
          display_name: "",
          role: "viewer",
          active: false,
          deleted_at: null,
          created_at: now,
          updated_at: now,
        };
        users.push(user);
        return response({ user: authUser(user) });
      }
      const id = url.pathname.split("/").pop();
      const user = users.find((u) => u.user_id === id);
      if (method === "DELETE") {
        const i = users.indexOf(user);
        if (i >= 0) users.splice(i, 1);
        return response({});
      }
      return user
        ? response({ user: authUser(user) })
        : response({ msg: "Not found" }, 404);
    }
    if (url.pathname === "/rest/v1/rpc/manage_staff") {
      if (actor?.role !== "superadmin") return response({ code: "42501" }, 403);
      const target = users.find((u) => u.user_id === body.p_user_id);
      if (!target) return response({ code: "22023" }, 400);
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
          "officials",
          "news",
          "programs",
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
        const inserted = (Array.isArray(body) ? body : [body]).map((record) => {
          const row = {
            ...record,
            ...([
              "committee_master",
              "legislative_terms",
              "officials",
              "department_contacts",
              "departments",
              "programs",
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
              body: record.body ?? "",
              head_description: record.head_description ?? "",
            });
          reorder(table, null, row);
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
          .filter((n) => n.published)
          .map((n) => {
            const d = departments.find(
              (d) => d.office_id === n.office_id && d.published,
            );
            return {
              ...n,
              source: {
                name: d?.name || "Municipal information portal",
                slug: d?.slug,
              },
            };
          });
      if (actor?.role !== "superadmin") {
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
      if (!actor && table !== "legislative_terms") rows = rows.filter((r) => r.published);
      for (const [key, val] of url.searchParams) {
        if (val.startsWith("ilike."))
          rows = rows.filter((r) =>
            String(r[key] || "")
              .toLowerCase()
              .includes(val.slice(6).replaceAll("%", "").toLowerCase()),
          );
        if (val.startsWith("eq."))
          rows = rows.filter((r) => String(r[key]) === val.slice(3));
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
        rows.forEach((r) => {
          const next = { ...r, ...body };
          reorder(table, r, next);
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
