import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { definitions } from "../../lib/content/schema";
import { permits } from "../../lib/offices/permissions";
let db: PGlite;
const ids = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  editor: "00000000-0000-4000-8000-000000000002",
  admin: "00000000-0000-4000-8000-000000000003",
  viewer: "00000000-0000-4000-8000-000000000004",
  legacy: "00000000-0000-4000-8000-000000000005",
};
let offices: Record<string, string>;
async function as(role: keyof typeof ids, run: () => Promise<void>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[role],
  ]);
  await db.exec("set role authenticated");
  try {
    await run();
  } finally {
    await db.exec("reset role");
    await db.exec("select set_config('request.jwt.claim.sub','',false)");
  }
}
test.beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;grant usage on schema auth to authenticated;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
  );
  for (const file of ["202609300001_content.sql", "202609300003_auth.sql"])
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  for (const [role, id] of Object.entries(ids))
    await db.query("insert into auth.users values($1,$2)", [
      id,
      role + "@example.test",
    ]);
  await db.query(
    "update public.staff_accounts set role='superadmin',active=true where user_id=$1",
    [ids.superadmin],
  );
  await db.exec(
    readFileSync("supabase/migrations/202610010004_office_access.sql", "utf8"),
  );
  offices = Object.fromEntries(
    (
      await db.query<{ id: string; slug: string }>(
        "select id,slug from public.offices",
      )
    ).rows.map((o) => [o.slug, o.id]),
  );
  await db.exec(
    "insert into municipal_documents(id,category_id,title,description,date,file_url) values('test-doc','full-disclosure','Test','Description','2026-10-01','/file.pdf')",
  );
  for (const { table, key } of Object.values(definitions)
    .map((d) => ({ ...d, key: d.table === "news" ? "slug" : d.key }))
    .filter((d) => d.table !== "department_contacts"))
    for (const slug of [
      "mpdc",
      "mayors-office",
      "municipal-assessor",
      "vice-mayor",
      "sangguniang-bayan",
    ])
      await db.query(
        `insert into public.${table} select(jsonb_populate_record(null::public.${table},to_jsonb(t)||jsonb_build_object('${key}',$1::text,'office_id',$2::text,'published',false))).* from public.${table} t limit 1`,
        ["office-" + slug, offices[slug]],
      );
  await as("superadmin", async () => {
    for (const [role, slugs, level] of [
      ["editor", ["mpdc"], "editor"],
      ["admin", ["mpdc", "municipal-assessor"], "manager"],
      ["viewer", ["sangguniang-bayan"], "manager"],
    ] as const) {
      await db.query(
        "select public.manage_staff($1,$2,true,$3,$4::jsonb,false)",
        [
          ids[role],
          role,
          role,
          JSON.stringify(
            slugs.map((slug) => ({
              office_id: offices[slug],
              permission_level: level,
            })),
          ),
        ],
      );
    }
  });
});
test.afterAll(async () => {
  await db?.close();
});
test("migration preserves superadmin and migrates old user role to viewer; sixteen offices are records", async () => {
  expect((await db.query("select * from offices")).rows).toHaveLength(16);
  expect(
    (
      await db.query<{ role: string }>(
        "select role from staff_accounts where user_id=$1",
        [ids.legacy],
      )
    ).rows[0].role,
  ).toBe("viewer");
  await as("superadmin", async () => {
    expect((await db.query("select * from staff_accounts")).rows).toHaveLength(
      5,
    );
  });
});
for (const { table, key } of Object.values(definitions)
  .map((d) => ({ ...d, key: d.table === "news" ? "slug" : d.key }))
  .filter((d) => d.table !== "department_contacts"))
  test(`${table}: office-scoped editor, multi-office admin, viewer and superadmin`, async () => {
    await as("editor", async () => {
      expect(
        (await db.query(`select * from ${table} where ${key}='office-mpdc'`))
          .rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query(
            `update ${table} set sort_order=7 where ${key}='office-mpdc' returning *`,
          )
        ).rows,
      ).toHaveLength(1);
      for (const slug of [
        "mayors-office",
        "municipal-assessor",
        "vice-mayor",
      ]) {
        expect(
          (
            await db.query(`select * from ${table} where ${key}=$1`, [
              "office-" + slug,
            ])
          ).rows,
        ).toHaveLength(0);
        expect(
          (
            await db.query(
              `update ${table} set sort_order=9 where ${key}=$1 returning *`,
              ["office-" + slug],
            )
          ).rows,
        ).toHaveLength(0);
      }
      expect(
        (
          await db.query(
            `delete from ${table} where ${key}='office-mpdc' returning *`,
          )
        ).rows,
      ).toHaveLength(0);
      await expect(
        db.query(
          `update ${table} set office_id=$1 where ${key}='office-mpdc'`,
          [offices["mayors-office"]],
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        db.query(
          `insert into ${table} select(jsonb_populate_record(null::${table},to_jsonb(t)||jsonb_build_object('${key}','forged-office','office_id',$1::text))).* from ${table} t where ${key}='office-mpdc'`,
          [offices["mayors-office"]],
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await db.query(
        `insert into ${table} select(jsonb_populate_record(null::${table},to_jsonb(t)||jsonb_build_object('${key}','editor-created','created_by',$1::text))).* from ${table} t where ${key}='office-mpdc'`,
        [ids.superadmin],
      );
      expect(
        (
          await db.query<{ created_by: string }>(
            `select created_by from ${table} where ${key}='editor-created'`,
          )
        ).rows[0].created_by,
      ).toBe(ids.editor);
    });
    await as("admin", async () => {
      for (const slug of ["mpdc", "municipal-assessor"])
        expect(
          (
            await db.query(
              `update ${table} set sort_order=8 where ${key}=$1 returning *`,
              ["office-" + slug],
            )
          ).rows,
        ).toHaveLength(1);
      expect(
        (
          await db.query(
            `update ${table} set sort_order=8 where ${key}='office-mayors-office' returning *`,
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            `delete from ${table} where ${key}='editor-created' returning *`,
          )
        ).rows,
      ).toHaveLength(1);
    });
    await as("viewer", async () => {
      expect(
        (
          await db.query(
            `select * from ${table} where ${key}='office-sangguniang-bayan'`,
          )
        ).rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query(
            `update ${table} set sort_order=9 where ${key}='office-sangguniang-bayan' returning *`,
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            `delete from ${table} where ${key}='office-sangguniang-bayan' returning *`,
          )
        ).rows,
      ).toHaveLength(0);
      await expect(
        db.exec(
          `insert into ${table} select(jsonb_populate_record(null::${table},to_jsonb(t)||jsonb_build_object('${key}','viewer-created'))).* from ${table} t where ${key}='office-sangguniang-bayan'`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });
    await as("superadmin", async () => {
      expect(
        (
          await db.query(
            `update ${table} set sort_order=10 where ${key} like 'office-%' returning *`,
          )
        ).rows,
      ).toHaveLength(5);
    });
  });
test("direct role escalation, office assignment and audit manipulation are rejected", async () => {
  await as("editor", async () => {
    await expect(
      db.exec("update staff_accounts set role='superadmin'"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query(
        "select manage_staff($1,'superadmin',true,'Forged','[]',false)",
        [ids.editor],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query("insert into user_office_access values($1,$2,'manager',now())", [
        ids.editor,
        offices["mayors-office"],
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.exec(
        "insert into offices(name,slug,department) values('Forged','forged','executive')",
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(db.exec("delete from audit_logs")).rejects.toMatchObject({
      code: "42501",
    });
    expect((await db.query("select * from audit_logs")).rows).toHaveLength(0);
  });
  await as("superadmin", async () => {
    await expect(
      db.query("select manage_staff($1,'viewer',true,'Self','[]',false)", [
        ids.superadmin,
      ]),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(
      db.query("select manage_staff($1,'superadmin',false,'Self','[]',true)", [
        ids.superadmin,
      ]),
    ).rejects.toMatchObject({ code: "22023" });
    expect(
      (
        await db.query(
          "select * from audit_logs where action='update' and entity_type='departments'",
        )
      ).rows.length,
    ).toBeGreaterThan(0);
  });
});
test("office deactivation, membership removal and user soft deletion immediately revoke access", async () => {
  await as("superadmin", async () => {
    await db.query("update offices set active=false where id=$1", [
      offices.mpdc,
    ]);
  });
  await as("editor", async () => {
    expect(
      (
        await db.query(
          "update departments set name='Forbidden' where id='office-mpdc' returning *",
        )
      ).rows,
    ).toHaveLength(0);
  });
  await as("superadmin", async () => {
    await db.query("update offices set active=true where id=$1", [
      offices.mpdc,
    ]);
    await db.query(
      "select manage_staff($1,'editor',true,'Editor','[]',false)",
      [ids.editor],
    );
  });
  await as("editor", async () => {
    expect(
      (await db.query("select * from departments where id='office-mpdc'")).rows,
    ).toHaveLength(0);
  });
  await as("superadmin", async () => {
    await db.query("select manage_staff($1,'admin',true,'Deleted','[]',true)", [
      ids.admin,
    ]);
  });
  await as("admin", async () => {
    expect((await db.query("select * from offices")).rows).toHaveLength(0);
  });
  expect(
    (await db.query("select * from auth.users where id=$1", [ids.admin])).rows,
  ).toHaveLength(1);
});
test("unsafe office deletion is blocked; new offices need no frontend changes", async () => {
  await as("superadmin", async () => {
    await expect(
      db.query("delete from offices where id=$1", [offices.mpdc]),
    ).rejects.toMatchObject({ code: expect.stringMatching(/^(23503|23001)$/) });
    await db.exec(
      "insert into offices(name,slug,department) values('Tourism','tourism','executive')",
    );
    expect(
      (await db.query("select * from offices where slug='tourism'")).rows,
    ).toHaveLength(1);
    await db.exec("delete from offices where slug='tourism'");
  });
});
test("published content stays public while office and account tables remain private", async () => {
  await db.exec("set role anon");
  try {
    expect(
      (await db.query("select * from departments")).rows.length,
    ).toBeGreaterThan(0);
    expect(
      (await db.query("select * from departments where id='office-mpdc'")).rows,
    ).toHaveLength(0);
    await expect(db.exec("select * from offices")).rejects.toMatchObject({
      code: "42501",
    });
  } finally {
    await db.exec("reset role");
  }
});
test("role and office permission must both allow an operation", () => {
  expect(permits("viewer", "manager", "write")).toBe(false);
  expect(permits("editor", "viewer", "write")).toBe(false);
  expect(permits("editor", "manager", "delete")).toBe(false);
  expect(permits("admin", "editor", "delete")).toBe(false);
  expect(permits("admin", "manager", "delete")).toBe(true);
  expect(permits("superadmin", undefined, "delete")).toBe(true);
});
