import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

let db: PGlite;
let offices: Record<string, string>;
const term = "20000000-0000-4000-8000-000000000001";
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  mho: "00000000-0000-4000-8000-000000000002",
  legislative: "00000000-0000-4000-8000-000000000003",
  viewer: "00000000-0000-4000-8000-000000000004",
};
async function as(user: keyof typeof users, run: () => Promise<void>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    users[user],
  ]);
  await db.exec("set role authenticated");
  try {
    await run();
  } finally {
    await db.exec(
      "reset role;select set_config('request.jwt.claim.sub','',false)",
    );
  }
}
test.beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;grant usage on schema auth to authenticated;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
  );
  for (const f of [
    "202609300001_content.sql",
    "202609300003_auth.sql",
    "202610010004_office_access.sql",
    "202610010005_legislative_modules.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(
    `create schema storage;grant usage on schema storage to authenticated;create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;create policy public_media_read on storage.objects for select to authenticated using(bucket_id='municipal-media');`,
  );
  for (const f of [
    "202610010006_official_photos.sql",
    "202610010007_single_legislative_access.sql",
    "202610020008_department_scope.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  offices = Object.fromEntries(
    (
      await db.query<{ id: string; slug: string }>(
        "select id,slug from offices",
      )
    ).rows.map((o) => [o.slug, o.id]),
  );
  for (const [name, id] of Object.entries(users))
    await db.query("insert into auth.users values($1,$2)", [
      id,
      name + "@test.local",
    ]);
  await db.query(
    "update staff_accounts set role='superadmin',active=true where user_id=$1",
    [users.superadmin],
  );
  await as("superadmin", async () => {
    for (const [user, office, role, level] of [
      ["mho", "municipal-health", "admin", "manager"],
      ["legislative", "legislative-access", "admin", "manager"],
      ["viewer", "municipal-health", "viewer", "viewer"],
    ])
      await db.query("select manage_staff($1,$2,true,$3,$4::jsonb,false)", [
        users[user as keyof typeof users],
        role,
        user,
        JSON.stringify([
          { office_id: offices[office], permission_level: level },
        ]),
      ]);
    await db.query(
      "insert into offices(name,short_name,slug,department) values('Municipal Environment Office','MENRO','menro','executive')",
    );
  });
  offices = Object.fromEntries(
    (
      await db.query<{ id: string; slug: string }>(
        "select id,slug from offices",
      )
    ).rows.map((o) => [o.slug, o.id]),
  );
});
test.afterAll(async () => await db.close());

async function document(
  table: string,
  id: string,
  date = "2025-08-08",
  author = "sb-a",
  coauthor: string | null = null,
  session: string | null = null,
) {
  return db.query(
    `insert into ${table}(id,number,title,date_approved,year,author,status,summary,author_id,co_author_id,session_id,office_id,content_scope)
    values($1,$1,$1,$2,2025,'','Approved','Body',$3,$4,$5,$6,'legislative') returning session_id,term_id`,
    [id, date, author, coauthor, session, offices["legislative-access"]],
  );
}

test.beforeAll(async () => {
  await db.exec(
    "update departments set head_name='Existing Head',head_photo='/images/existing-head.webp' where id='health'",
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610020009_dynamic_departments.sql",
      "utf8",
    ),
  );
});
test.beforeAll(async () => {
  await db.exec(
    readFileSync(
      "supabase/migrations/202610050010_department_identity.sql",
      "utf8",
    ),
  );
});

test.beforeAll(async () => {
  await db.exec(
    "create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])",
  );
  const sql = readFileSync(
    "supabase/migrations/202610080011_content_workflows.sql",
    "utf8",
  );
  await db.exec(sql);
  await db.exec(sql);
});

test.beforeAll(async () => {
  await db.exec(
    readFileSync(
      "supabase/migrations/202610100012_admin_authoring.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202611060014_legislative_workspace.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202611090015_legislative_pdf_uploads.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync("supabase/migrations/202611100016_transparency.sql", "utf8"),
  );
  await db.exec(
    "grant usage on schema storage,auth to anon;grant select on storage.objects to anon",
  );
});

test.beforeAll(async () => {
  for (const file of [
    "202611100017_transparency_reports.sql",
    "202611130018_transparency_access.sql",
    "202611160019_legislative_terms.sql",
    "202611180020_committee_master.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
});

test.beforeAll(async () => {
  const before = (
    await db.query("select to_jsonb(o) row from ordinances o order by id")
  ).rows;
  await db.exec(
    readFileSync(
      "supabase/migrations/202611180021_document_session_authors.sql",
      "utf8",
    ),
  );
  expect(
    (await db.query("select to_jsonb(o) row from ordinances o order by id"))
      .rows,
  ).toEqual(before);
  await as("superadmin", async () => {
    await db.query(
      "insert into legislative_terms(id,name,start_date,end_date) values($1,'Current','2025-07-01','2028-06-30')",
      [term],
    );
    for (const [id, role] of [
      ["sb-a", "SANGGUNIANG_BAYAN"],
      ["sb-b", "SANGGUNIANG_BAYAN"],
      ["vm", "MUNICIPAL_VICE_MAYOR"],
    ])
      await db.query(
        "insert into officials(id,name,role,description,branch,legislative_role,office_id,content_scope,term_id) values($1,$1,'Official','','legislative',$2,$3,'legislative',$4)",
        [id, role, offices["legislative-access"], term],
      );
    for (const [id, date] of [
      ["sixth", "2025-08-08"],
      ["seventh", "2025-08-09"],
      ["special", "2025-08-09"],
    ])
      await db.query(
        "insert into sessions(id,name,number,date,type,description,agenda,image,office_id,content_scope) values($1,$1,'6',$2,'Regular session','',array[]::text[],'/images/department-placeholder.svg',$3,'legislative')",
        [id, date, offices["legislative-access"]],
      );
  });
});

test("document date selects its unique session; ambiguity and wrong dates fail", async () => {
  await as("legislative", async () => {
    expect((await document("ordinances", "auto-ordinance")).rows).toEqual([
      { session_id: "sixth", term_id: term },
    ]);
    expect(
      (
        await document(
          "resolutions",
          "auto-resolution",
          "2025-08-08",
          "sb-a",
          "sb-b",
        )
      ).rows,
    ).toEqual([{ session_id: "sixth", term_id: term }]);
    await expect(
      document("ordinances", "missing-session", "2025-08-10"),
    ).rejects.toThrow("No matching session");
    await expect(
      document("ordinances", "ambiguous", "2025-08-09"),
    ).rejects.toThrow("Multiple sessions");
    await expect(
      document(
        "ordinances",
        "wrong-session",
        "2025-08-08",
        "sb-a",
        null,
        "seventh",
      ),
    ).rejects.toThrow("Session must match");
    expect(
      (
        await document(
          "ordinances",
          "chosen-session",
          "2025-08-09",
          "sb-a",
          null,
          "special",
        )
      ).rows[0],
    ).toEqual({ session_id: "special", term_id: term });
    await expect(
      db.query(
        "update ordinances set date_approved='2025-08-09' where id='auto-ordinance'",
      ),
    ).rejects.toThrow("Session must match");
    await db.query(
      "update ordinances set date_approved='2025-08-09',session_id='seventh' where id='auto-ordinance'",
    );
  });
});

test("Vice-Mayor cannot be author/co-author and parent changes preserve links", async () => {
  await as("legislative", async () => {
    await expect(
      document("ordinances", "vm-author", "2025-08-08", "vm"),
    ).rejects.toThrow("Sangguniang Bayan");
    await expect(
      document("resolutions", "vm-coauthor", "2025-08-08", "sb-a", "vm"),
    ).rejects.toThrow("Sangguniang Bayan");
    await expect(
      db.query(
        "update resolutions set co_author_id='vm' where id='auto-resolution'",
      ),
    ).rejects.toThrow("Sangguniang Bayan");
    await expect(
      db.query(
        "update officials set legislative_role='MUNICIPAL_VICE_MAYOR' where id='sb-a'",
      ),
    ).rejects.toThrow("Sangguniang Bayan");
    await expect(
      db.query("update sessions set date='2025-08-10' where id='sixth'"),
    ).rejects.toThrow("linked documents");
    await db.query(
      "update resolutions set updated_at=now() where id='auto-resolution'",
    );
  });
  await as("mho", async () => {
    await expect(document("ordinances", "unauthorized")).rejects.toThrow();
  });
});

test("Agenda and Minutes auto-match by date while Executive Orders remain session-free", async () => {
  await as("legislative", async () => {
    for (const type of ["agenda", "minutes", "executive-order"]) {
      const result = await db.query(
        "insert into municipal_documents(id,title,description,date,document_type,office_id,content_scope) values($1,$1,'Body','2025-08-08',$1,$2,'legislative') returning session_id,term_id",
        [type, offices["legislative-access"]],
      );
      expect(result.rows[0]).toEqual({
        session_id: type === "executive-order" ? null : "sixth",
        term_id: term,
      });
    }
    await expect(
      db.query(
        "update municipal_documents set date='2025-08-09' where id='agenda'",
      ),
    ).rejects.toThrow("Session must match");
  });
});
