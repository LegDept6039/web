// Test-process transport only. Never imported by application code.
if (process.env.PORTAL_AUTH_TEST_FIXTURE === "1") {
  const realFetch = globalThis.fetch;
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
  const programs = [];
  const department_contacts = [];
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
      url.pathname.startsWith("/storage/v1/object/upload/sign/") &&
      method === "POST"
    )
      return response({
        url: url.pathname.replace("/storage/v1", "") + "?token=fixture-upload",
      });
    if (
      (url.pathname.startsWith("/storage/v1/object/municipal-news-staging/") || url.pathname.startsWith("/storage/v1/object/public/municipal-media/")) &&
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
          "officials",
          "news",
          "programs",
          "departments",
          "department_contacts",
        ].includes(table)
      ) {
        const row = {
          ...body,
          ...([
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
            published: body.published ?? true,
            is_sample: false,
            sort_order: body.sort_order ?? 0,
            active: body.active ?? true,
            archived_at: null,
            body: body.body ?? "",
            head_description: body.head_description ?? "",
          });
        ({ officials, news, programs, departments, department_contacts })[
          table
        ].push(row);
        return response([row]);
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
      for (const [key, val] of url.searchParams) {
        if (val.startsWith("eq."))
          rows = rows.filter((r) => String(r[key]) === val.slice(3));
        if (val.startsWith("is.null"))
          rows = rows.filter((r) => r[key] == null);
        if (val.startsWith("in.(")) {
          const values = val.slice(4, -1).split(",");
          rows = rows.filter((r) => values.includes(String(r[key])));
        }
      }
      if (method === "PATCH") {
        rows.forEach((r) =>
          Object.assign(r, body, { updated_at: new Date().toISOString() }),
        );
        return response(rows);
      }
      if (method === "DELETE") {
        const target = { officials, news, programs, departments }[table];
        if (target)
          for (const row of rows) target.splice(target.indexOf(row), 1);
        return response(rows);
      }
      const count = rows.length;
      const offset = Number(url.searchParams.get("offset") || 0),
        limit = Number(url.searchParams.get("limit") || 1000);
      rows = rows.slice(offset, offset + limit);
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
