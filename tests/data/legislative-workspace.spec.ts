import { parseLegislative } from "../../lib/legislative/validation";
import { decodeRecord } from "../../lib/content/schema";
import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
let db: PGlite;
let offices: Record<string, string>;
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

let legacy: unknown[];
test.beforeAll(async () => {
  await db.exec(
    readFileSync(
      "supabase/migrations/202610100012_admin_authoring.sql",
      "utf8",
    ),
  );
  legacy = (
    await db.query(
      "select id,author,co_author,published,pdf_url from ordinances order by id",
    )
  ).rows;
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

test("Transparency preserves legacy records and isolates Superadmin publication and private PDFs", async () => {
  const original = (
    await db.query(
      "select id from document_categories where id='full-disclosure'",
    )
  ).rows;
  expect(original).toHaveLength(1);
  const category = (
    await db.query<{ id: string }>(
      "select id from document_categories where content_scope='transparency' order by sort_order limit 1",
    )
  ).rows[0].id;
  const path = `transparency/${users.superadmin}/11111111-1111-4111-8111-111111111111.pdf`;
  await as("superadmin", async () => {
    await db.query(
      "insert into municipal_documents(id,title,date,description,category_id,content_scope,published,sort_order,attachment_path,file_url) values('transparency-test','Bid notice','2026-11-10','Procurement record',$1,'transparency',false,0,$2,'/transparency/files/transparency-test')",
      [category, path],
    );
    await db.query(
      "insert into storage.objects values('municipal-transparency',$1)",
      [path],
    );
  });
  async function publicCounts(expected: number) {
    await db.exec("set role anon");
    try {
      expect(
        (
          await db.query(
            "select id from municipal_documents where id='transparency-test'",
          )
        ).rows,
      ).toHaveLength(expected);
      expect(
        (
          await db.query(
            "select name from storage.objects where bucket_id='municipal-transparency'",
          )
        ).rows,
      ).toHaveLength(expected);
    } finally {
      await db.exec("reset role");
    }
  }
  await publicCounts(0);
  for (const actor of ["mho", "legislative", "viewer"] as const)
    await as(actor, async () => {
      expect(
        (
          await db.query(
            "select * from municipal_documents where id='transparency-test'",
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "update municipal_documents set title='forged' where id='transparency-test' returning id",
          )
        ).rows,
      ).toHaveLength(0);
      await expect(
        db.query(
          "insert into municipal_documents(title,date,category_id,content_scope,published,sort_order) values('forged','2026-11-10',$1,'transparency',false,0)",
          [category],
        ),
      ).rejects.toThrow();
      await expect(
        db.query(
          "insert into storage.objects values('municipal-transparency',$1)",
          [
            `transparency/${users[actor]}/22222222-2222-4222-8222-222222222222.pdf`,
          ],
        ),
      ).rejects.toThrow();
      expect(
        (
          await db.query(
            "select public.can_upload_transparency_pdf($1) as allowed",
            [path],
          )
        ).rows,
      ).toEqual([{ allowed: false }]);
    });
  await as("superadmin", async () => {
    await expect(
      db.query(
        "insert into municipal_documents(title,date,category_id,content_scope,published,sort_order) values('missing PDF','2026-11-10',$1,'transparency',true,1)",
        [category],
      ),
    ).rejects.toThrow();
    await db.exec(
      "update municipal_documents set published=true,sort_order=1 where id='transparency-test'",
    );
    expect(
      (
        await db.query(
          "delete from storage.objects where bucket_id='municipal-transparency' returning name",
        )
      ).rows,
    ).toHaveLength(0);
  });
  await publicCounts(1);
  await as("superadmin", async () => {
    await db.query(
      "update document_categories set published=false,sort_order=0 where id=$1",
      [category],
    );
  });
  await publicCounts(0);
  await as("superadmin", async () => {
    await db.query(
      "update document_categories set published=true,sort_order=1 where id=$1",
      [category],
    );
    await db.exec(
      "update municipal_documents set published=false,sort_order=0 where id='transparency-test'",
    );
    await expect(
      db.exec(
        "update municipal_documents set content_scope='legislative' where id='transparency-test'",
      ),
    ).rejects.toThrow();
  });
  await publicCounts(0);
});

test("015 PDF storage restricts uploads and protects referenced attachments", async () => {
  const path = `legislative/${offices["legislative-access"]}/${users.legislative}/documents/00000000-0000-4000-8000-000000000001.pdf`;
  await as("legislative", async () => {
    for (const bucket of ["municipal-document-staging", "municipal-media"])
      await db.query(
        "insert into storage.objects(bucket_id,name) values($1,$2)",
        [bucket, path],
      );
    await db.query(
      "insert into municipal_documents(id,title,date,description,file_url,content_scope,office_id,published,sort_order) values('pdf-record','Attached PDF','2026-11-09','Body',$1,'legislative',$2,true,1)",
      [
        "https://example.supabase.co/storage/v1/object/public/municipal-media/" +
          path,
        offices["legislative-access"],
      ],
    );
    expect(
      (
        await db.query(
          "delete from storage.objects where bucket_id='municipal-media' and name=$1 returning name",
          [path],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "delete from storage.objects where bucket_id='municipal-document-staging' and name=$1 returning name",
          [path],
        )
      ).rows,
    ).toHaveLength(1);
    for (const forged of [
      path.replace(users.legislative, users.mho),
      path.replace("/documents/", "/news/"),
      path + "/bad.pdf",
    ])
      await expect(
        db.query(
          "insert into storage.objects(bucket_id,name) values('municipal-document-staging',$1)",
          [forged],
        ),
      ).rejects.toThrow();
    const unused = path.replace(
      "00000000-0000-4000-8000-000000000001.pdf",
      "00000000-0000-4000-8000-000000000002.pdf",
    );
    await db.query(
      "insert into storage.objects(bucket_id,name) values('municipal-media',$1)",
      [unused],
    );
    expect(
      (
        await db.query(
          "delete from storage.objects where bucket_id='municipal-media' and name=$1 returning name",
          [unused],
        )
      ).rows,
    ).toHaveLength(1);
  });
  for (const role of ["mho", "viewer"] as const)
    await as(role, async () => {
      await expect(
        db.query(
          "insert into storage.objects(bucket_id,name) values('municipal-document-staging',$1)",
          [path.replace(users.legislative, users[role])],
        ),
      ).rejects.toThrow();
    });
  await as("superadmin", async () => {
    await db.query(
      "insert into storage.objects(bucket_id,name) values('municipal-document-staging',$1)",
      [path.replace(users.legislative, users.superadmin)],
    );
  });
  await db.exec(
    "grant usage on schema storage to anon; grant select on storage.objects to anon; set role anon",
  );
  try {
    expect(
      (
        await db.query(
          "select * from storage.objects where bucket_id='municipal-document-staging'",
        )
      ).rows,
    ).toHaveLength(0);
  } finally {
    await db.exec("reset role");
  }
});
test("014 preserves legacy records and restricts relationship writes to Legislative ownership", async () => {
  expect(
    (
      await db.query(
        "select id,author,co_author,published,pdf_url from ordinances order by id",
      )
    ).rows,
  ).toEqual(legacy);
  await as("legislative", async () => {
    const office = offices["legislative-access"];
    await db.query(
      `insert into officials(id,name,role,branch,legislative_role,description,content_scope,office_id,published,sort_order) values('workspace-author','New Member','Member','legislative','SANGGUNIANG_BAYAN','Description','legislative',$1,true,1)`,
      [office],
    );
    await db.query(
      `insert into sessions(id,name,number,type,date,description,image,content_scope,office_id,published,sort_order) values('workspace-session','November session','25','Regular session','2026-11-06','','/images/department-placeholder.svg','legislative',$1,true,1)`,
      [office],
    );
    await db.query(
      `insert into committees(id,name,responsibility,chair,chair_id,content_scope,office_id,published,sort_order) values('workspace-committee','Finance','','','workspace-author','legislative',$1,true,1)`,
      [office],
    );
    await db.query(
      `insert into ordinances(title,number,date_approved,year,author,status,summary,author_id,co_author_id,committee_id,session_id,content_scope,office_id,published,sort_order) values('New measure','100','2026-11-06',2026,'','Approved','Body','workspace-author',null,'workspace-committee','workspace-session','legislative',$1,true,1)`,
      [office],
    );
    await expect(
      db.query(`update ordinances set author_id='mayor' where number='100'`),
    ).rejects.toThrow();
    await expect(
      db.query(
        `update ordinances set session_id='missing-session' where number='100'`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(`delete from officials where id='workspace-author'`),
    ).rejects.toThrow();
    for (const type of ["agenda", "minutes", "executive-order"])
      await db.query(
        `insert into municipal_documents(title,date,description,document_type,session_id,content_scope,office_id,published,sort_order) values($1,'2026-11-06','Document body',$1,$2,'legislative',$3,true,1)`,
        [type, type === "executive-order" ? null : "workspace-session", office],
      );
    await db.query(
      `insert into municipal_documents(id,title,date,description,content_scope,office_id) values('workspace-private','Private document','2026-11-06','Legacy private','legislative',$1)`,
      [office],
    );
    expect(
      (
        await db.query(
          "select count(*)::int n from legislative_documents where published and (number='100' or document_type in ('agenda','minutes','executive-order'))",
        )
      ).rows,
    ).toEqual([{ n: 4 }]);
  });
  await as("mho", async () => {
    await expect(
      db.query(
        `insert into municipal_documents(title,date,description,document_type,content_scope,office_id,published,sort_order) values('Forbidden','2026-11-06','Body','executive-order','legislative',$1,true,1)`,
        [offices["legislative-access"]],
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.exec(
          "update municipal_documents set title='Forged' where id='workspace-private'",
        )
      )[0].affectedRows,
    ).toBe(0);
  });
  await as("superadmin", async () => {
    await expect(
      db.query(
        "update officials set office_id=$1,content_scope='executive',branch='executive',legislative_role=null where id='workspace-author'",
        [offices["municipal-health"]],
      ),
    ).rejects.toThrow();
    await expect(
      db.exec("update ordinances set author_id=null where number='100'"),
    ).rejects.toThrow();
  });
  await db.exec("set role anon");
  try {
    expect(
      (
        await db.query(
          "select id from legislative_documents where id='workspace-private'",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "select id from legislative_documents where title='New measure'",
        )
      ).rows,
    ).toHaveLength(1);
  } finally {
    await db.exec("reset role");
  }
});

test("document validation publishes valid records, keeps N/A null, and refuses unpublished edits", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    title: "Measure",
    number: "26-1",
    date_approved: "2026-11-06",
    year: "2026",
    author_id: "workspace-author",
    co_author_id: "",
    committee_id: "workspace-committee",
    session_id: "workspace-session",
    summary: "Body",
  }))
    form.set(key, value);
  const row = parseLegislative("ordinances", form, null);
  expect(row.published).toBe(true);
  expect(row.co_author_id).toBeNull();
  expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(row.author).toBe("");
  expect(() =>
    parseLegislative("ordinances", form, { id: "old", published: false }),
  ).toThrow("unpublished");
  form.append("author_id", "another");
  expect(() => parseLegislative("ordinances", form, null)).toThrow(
    "exactly one",
  );
  const decoded = decodeRecord("ordinances", {
    ...row,
    author_record: { name: "Current official name" },
    co_author: "Preserved old text",
    is_sample: false,
  });
  expect(decoded.author).toBe("Current official name");
  expect(decoded.coAuthor).toBeUndefined();
});
