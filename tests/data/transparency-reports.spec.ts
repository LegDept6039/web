import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { readSupabaseCollection } from "../../lib/content/supabase";
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

const pdfPath = (n: number) =>
  `transparency/${users.superadmin}/00000000-0000-4000-8000-${String(n).padStart(12, "0")}.pdf`;
test("017 backfills annual frequency/year while preserving legacy identity, date and PDF", async () => {
  const row = (
    await db.query(
      "select id,date::text,description,file_url,attachment_path,annual_pdf_path,report_frequency,report_year from municipal_documents where id='preserved-annual'",
    )
  ).rows[0];
  expect(row).toEqual({
    id: "preserved-annual",
    date: "2025-04-15",
    description: "Keep description",
    file_url: "/transparency/files/preserved-annual",
    attachment_path: pdfPath(1),
    annual_pdf_path: pdfPath(1),
    report_frequency: "annual",
    report_year: 2025,
  });
  expect(
    (
      await db.query(
        "select id from document_categories where id='full-disclosure'",
      )
    ).rows,
  ).toHaveLength(1);
});

test("quarterly reports support partial publication and independent replacement; titles repeat across years", async () => {
  await as("superadmin", async () => {
    await db.query(
      "insert into municipal_documents(id,title,date,description,category_id,content_scope,published,sort_order,report_frequency,report_year,q1_pdf_path,file_url) values('partial-report','Reusable report','2026-01-01','','report-module','transparency',true,1,'quarterly',2026,$1,'/transparency/files/partial-report')",
      [pdfPath(2)],
    );
    await db.query(
      "update municipal_documents set q2_pdf_path=$1 where id='partial-report'",
      [pdfPath(3)],
    );
    await db.query(
      "update municipal_documents set q1_pdf_path=$1 where id='partial-report'",
      [pdfPath(4)],
    );
    expect(
      (
        await db.query(
          "select q1_pdf_path,q2_pdf_path,q3_pdf_path,q4_pdf_path,annual_pdf_path from municipal_documents where id='partial-report'",
        )
      ).rows[0],
    ).toEqual({
      q1_pdf_path: pdfPath(4),
      q2_pdf_path: pdfPath(3),
      q3_pdf_path: null,
      q4_pdf_path: null,
      annual_pdf_path: null,
    });
    await db.query(
      "insert into municipal_documents(id,title,date,description,category_id,content_scope,published,sort_order,report_frequency,report_year) values('next-year','Reusable report','2027-01-01','','report-module','transparency',false,0,'quarterly',2027)",
    );
    expect(
      (
        await db.query(
          "select id from municipal_documents where title='Reusable report'",
        )
      ).rows,
    ).toHaveLength(2);
    expect(
      (
        await db.query(
          "select transparency_pdf_published($1) as old,transparency_pdf_published($2) as current",
          [pdfPath(2), pdfPath(4)],
        )
      ).rows[0],
    ).toEqual({ old: false, current: true });
    await expect(
      db.exec(
        "update municipal_documents set report_frequency='annual' where id='partial-report'",
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        "update municipal_documents set published=true,sort_order=1 where id='next-year'",
      ),
    ).rejects.toThrow();
  });
});

test("Superadmin-only report/module writes and safe module deletion are enforced by real SQL", async () => {
  for (const actor of ["mho", "legislative", "viewer"] as const)
    await as(actor, async () => {
      expect(
        (await db.exec("select can_manage_transparency()"))[0].rows,
      ).toEqual([{ can_manage_transparency: false }]);
      expect(
        (
          await db.query(
            "update municipal_documents set title='forged' where id='preserved-annual' returning id",
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "update document_categories set name='forged' where id='report-module' returning id",
          )
        ).rows,
      ).toHaveLength(0);
      await expect(
        db.exec(
          "insert into document_categories(name,description,content_scope) values('Forged','','transparency')",
        ),
      ).rejects.toThrow();
      await expect(
        db.exec(
          "insert into municipal_documents(title,date,description,category_id,content_scope,report_frequency,report_year) values('Forged','2026-01-01','','report-module','transparency','annual',2026)",
        ),
      ).rejects.toThrow();
      await expect(
        db.query(
          "insert into storage.objects values('municipal-transparency',$1)",
          [
            `transparency/${users[actor]}/00000000-0000-4000-8000-000000000099.pdf`,
          ],
        ),
      ).rejects.toThrow();
    });
  await as("superadmin", async () => {
    await expect(
      db.exec(
        "update document_categories set deleted_at=now(),published=false,sort_order=0 where id='report-module'",
      ),
    ).rejects.toThrow();
    await expect(
      db.exec("delete from municipal_documents where id='preserved-annual'"),
    ).rejects.toThrow();
    await expect(
      db.exec(
        "update municipal_documents set category_id='full-disclosure' where id='preserved-annual'",
      ),
    ).rejects.toThrow();
  });
});

test("soft deletion retains report bytes and references but revokes public files and permits empty-module deletion", async () => {
  await as("superadmin", async () => {
    await db.exec(
      "insert into document_categories(id,name,description,content_scope,published,sort_order) values('deletable-module','Temporary','','transparency',true,1)",
    );
    await db.query(
      "insert into municipal_documents(id,title,date,description,category_id,content_scope,published,sort_order,report_frequency,report_year,annual_pdf_path,file_url) values('deletable-report','Temporary','2026-01-01','','deletable-module','transparency',true,1,'annual',2026,$1,'/transparency/files/deletable-report')",
      [pdfPath(5)],
    );
    await db.query(
      "insert into storage.objects values('municipal-transparency',$1)",
      [pdfPath(5)],
    );
  });
  await db.exec("set role anon");
  expect(
    (
      await db.query(
        "select id from municipal_documents where id='deletable-report'",
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query("select name from storage.objects where name=$1", [
        pdfPath(5),
      ])
    ).rows,
  ).toHaveLength(1);
  await db.exec("reset role");
  await as("superadmin", async () => {
    await db.exec(
      "update municipal_documents set deleted_at=now(),published=false,sort_order=0 where id='deletable-report'",
    );
    expect(
      (
        await db.query(
          "select transparency_pdf_unreferenced($1) as removable",
          [pdfPath(5)],
        )
      ).rows,
    ).toEqual([{ removable: false }]);
    await db.exec(
      "update document_categories set deleted_at=now(),published=false,sort_order=0 where id='deletable-module'",
    );
  });
  await db.exec("set role anon");
  expect(
    (
      await db.query(
        "select id from municipal_documents where id='deletable-report'",
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query("select name from storage.objects where name=$1", [
        pdfPath(5),
      ])
    ).rows,
  ).toHaveLength(0);
  await db.exec("reset role");
  expect(
    (
      await db.query(
        "select annual_pdf_path from municipal_documents where id='deletable-report'",
      )
    ).rows,
  ).toEqual([{ annual_pdf_path: pdfPath(5) }]);
});

test("public adapters request only published, nondeleted records and decode all quarter slots", async () => {
  const rows = await readSupabaseCollection(
    "documents",
    { url: "https://fixture.supabase.test", key: "sb_publishable_test" },
    async (url) => {
      const params = new URL(url).searchParams;
      expect(params.get("deleted_at")).toBe("is.null");
      expect(params.get("published")).toBe("eq.true");
      expect(params.get("content_scope")).toBe("eq.transparency");
      if (params.get("offset") !== "0") return Response.json([]);
      return Response.json([
        {
          id: "quarter",
          title: "Quarter report",
          description: "",
          date: "2026-01-01",
          is_sample: false,
          report_frequency: "quarterly",
          report_year: 2026,
          q1_pdf_path: pdfPath(1),
          q2_pdf_path: pdfPath(2),
          q3_pdf_path: null,
          q4_pdf_path: null,
        },
      ]);
    },
    { content_scope: "transparency" },
  );
  expect(rows[0]).toMatchObject({
    reportFrequency: "quarterly",
    reportYear: 2026,
    q1PdfPath: pdfPath(1),
    q2PdfPath: pdfPath(2),
  });
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
  await as("superadmin", async () => {
    await db.exec(
      "insert into document_categories(id,name,description,content_scope,published,sort_order) values('report-module','Reports','Dynamic module','transparency',true,1)",
    );
    await db.query(
      "insert into municipal_documents(id,title,date,description,category_id,content_scope,published,sort_order,attachment_path,file_url) values('preserved-annual','Existing report','2025-04-15','Keep description','report-module','transparency',true,1,$1,'/transparency/files/preserved-annual')",
      [pdfPath(1)],
    );
  });
  await db.exec(
    readFileSync(
      "supabase/migrations/202611100017_transparency_reports.sql",
      "utf8",
    ),
  );
});

test.describe.serial("018 explicit Transparency assignments", () => {
  test.beforeAll(async () => {
    await db.exec(
      readFileSync(
        "supabase/migrations/202611130018_transparency_access.sql",
        "utf8",
      ),
    );
  });
  const ownPath = `transparency/${users.mho}/00000000-0000-4000-8000-000000000777.pdf`;
  async function assign(
    role = "editor",
    granted = true,
    active = true,
    deleted = false,
  ) {
    await as("superadmin", async () => {
      await db.query(
        "select manage_staff($1,$2,$3,'Transparency staff','[]'::jsonb,$4,$5)",
        [users.mho, role, active, deleted, granted],
      );
    });
  }
  test("migration preserves reports and defaults to no staff assignments; only Superadmin grants access", async () => {
    expect(
      (
        await db.query(
          "select count(*)::int as n from staff_accounts where transparency_access",
        )
      ).rows,
    ).toEqual([{ n: 0 }]);
    expect(
      (
        await db.query(
          "select id from municipal_documents where id='preserved-annual'",
        )
      ).rows,
    ).toHaveLength(1);
    await as("mho", async () => {
      await expect(
        db.query(
          "select manage_staff($1,'admin',true,'Forged','[]'::jsonb,false,true)",
          [users.mho],
        ),
      ).rejects.toThrow();
      await expect(
        db.query(
          "update staff_accounts set transparency_access=true where user_id=$1",
          [users.mho],
        ),
      ).rejects.toThrow();
    });
    await assign();
    expect(
      (
        await db.query(
          "select office_id from user_office_access where user_id=$1",
          [users.mho],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "select description from audit_logs where action='transparency_access' and entity_id=$1",
          [users.mho],
        )
      ).rows,
    ).toEqual([{ description: "Transparency access granted" }]);
  });
  test("assigned Editor manages modules, private reports and PDFs but cannot transfer scope or access other branches", async () => {
    await as("mho", async () => {
      expect(
        (await db.query("select can_manage_transparency() as allowed")).rows,
      ).toEqual([{ allowed: true }]);
      await db.exec(
        "insert into document_categories(id,name,description,content_scope,published,sort_order) values('assigned-module','Assigned module','','transparency',true,1)",
      );
      await db.query(
        "insert into storage.objects values('municipal-document-staging',$1),('municipal-transparency',$1)",
        [ownPath],
      );
      await expect(
        db.query(
          "insert into storage.objects values('municipal-document-staging',$1)",
          [pdfPath(777)],
        ),
      ).rejects.toThrow();
      await db.query(
        "insert into municipal_documents(id,title,date,description,category_id,content_scope,published,sort_order,report_frequency,report_year,annual_pdf_path,file_url) values('assigned-report','Staff report','2026-01-01','','assigned-module','transparency',false,0,'annual',2026,$1,'/transparency/files/assigned-report')",
        [ownPath],
      );
      await db.exec(
        "update document_categories set name='Edited module' where id='assigned-module'",
      );
      await db.exec(
        "update municipal_documents set title='Edited report' where id='assigned-report'",
      );
      await expect(
        db.exec(
          "update municipal_documents set content_scope='legislative' where id='assigned-report'",
        ),
      ).rejects.toThrow();
      await expect(
        db.exec(
          "insert into document_categories(name,description,content_scope,published,sort_order) values('Forbidden','','legislative',true,1)",
        ),
      ).rejects.toThrow();
      expect(
        (await db.query("update departments set body='forged' returning id"))
          .rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "delete from storage.objects where bucket_id='municipal-transparency' and name=$1 returning name",
            [ownPath],
          )
        ).rows,
      ).toHaveLength(0);
      await db.exec(
        "update municipal_documents set published=true,sort_order=1 where id='assigned-report'",
      );
      await db.exec(
        "update municipal_documents set published=false,sort_order=0 where id='assigned-report'",
      );
    });
    await db.exec("set role anon");
    try {
      expect(
        (
          await db.query(
            "select id from municipal_documents where id='assigned-report'",
          )
        ).rows,
      ).toHaveLength(0);
    } finally {
      await db.exec("reset role");
    }
  });
  test("assigned Viewer can read drafts and PDFs but cannot write, upload or delete", async () => {
    await assign("viewer");
    await as("mho", async () => {
      expect(
        (
          await db.query(
            "select can_read_transparency() as read,can_manage_transparency() as write",
          )
        ).rows,
      ).toEqual([{ read: true, write: false }]);
      expect(
        (
          await db.query(
            "select id from municipal_documents where id='assigned-report'",
          )
        ).rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query(
            "select name from storage.objects where bucket_id='municipal-transparency' and name=$1",
            [ownPath],
          )
        ).rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query(
            "update municipal_documents set title='forged' where id='assigned-report' returning id",
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "update document_categories set name='forged' where id='assigned-module' returning id",
          )
        ).rows,
      ).toHaveLength(0);
      await expect(
        db.query(
          "insert into storage.objects values('municipal-document-staging',$1)",
          [ownPath],
        ),
      ).rejects.toThrow();
    });
  });
  test("revocation, disablement and deletion immediately remove access; Admin can safely delete assigned records", async () => {
    for (const [granted, active, deleted] of [
      [false, true, false],
      [true, false, false],
      [true, true, true],
    ]) {
      await assign("admin", granted, active, deleted);
      await as("mho", async () => {
        expect(
          (
            await db.query(
              "select can_read_transparency() as read,can_manage_transparency() as write",
            )
          ).rows,
        ).toEqual([{ read: false, write: false }]);
        expect(
          (
            await db.query(
              "select id from municipal_documents where id='assigned-report'",
            )
          ).rows,
        ).toHaveLength(0);
        expect(
          (
            await db.query(
              "select name from storage.objects where bucket_id='municipal-transparency' and name=$1",
              [ownPath],
            )
          ).rows,
        ).toHaveLength(0);
      });
    }
    expect(
      (
        await db.query(
          "select transparency_access from staff_accounts where user_id=$1",
          [users.mho],
        )
      ).rows,
    ).toEqual([{ transparency_access: false }]);
    await assign("admin");
    await as("mho", async () => {
      await expect(
        db.exec(
          "update document_categories set deleted_at=now(),published=false,sort_order=0 where id='assigned-module'",
        ),
      ).rejects.toThrow();
      await expect(
        db.exec("delete from municipal_documents where id='assigned-report'"),
      ).rejects.toThrow();
      await db.exec(
        "update municipal_documents set deleted_at=now(),published=false,sort_order=0 where id='assigned-report'",
      );
      await db.exec(
        "update document_categories set deleted_at=now(),published=false,sort_order=0 where id='assigned-module'",
      );
    });
    expect(
      (
        await db.query(
          "select annual_pdf_path from municipal_documents where id='assigned-report'",
        )
      ).rows,
    ).toEqual([{ annual_pdf_path: ownPath }]);
  });
});
