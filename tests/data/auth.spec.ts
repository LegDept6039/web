import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { definitions } from "../../lib/content/schema";
import { collectionName, parseContent } from "../../lib/admin/content";
let db: PGlite;
const admin = "00000000-0000-4000-8000-000000000001";
const member = "00000000-0000-4000-8000-000000000002";
const disabled = "00000000-0000-4000-8000-000000000003";
async function asUser(id: string, run: () => Promise<void>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
  try {
    await run();
  } finally {
    await db.exec("reset role");
  }
}
test.beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create schema auth; grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
    $$;`);
  await db.exec(
    readFileSync("supabase/migrations/202609300001_content.sql", "utf8"),
  );
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(
    readFileSync("supabase/migrations/202609300003_auth.sql", "utf8"),
  );
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3),($4,$5,$3),($6,$7,$3)",
    [
      admin,
      "admin@example.test",
      JSON.stringify({ role: "superadmin", active: true }),
      member,
      "user@example.test",
      disabled,
      "disabled@example.test",
    ],
  );
  await db.query(
    "update public.staff_accounts set role='superadmin',active=true where user_id=$1",
    [admin],
  );
  await db.query(
    "update public.staff_accounts set active=true where user_id=$1",
    [member],
  );
  await db.exec(
    "insert into public.municipal_documents(id,category_id,title,description,date,file_url) values('auth-doc','full-disclosure','Document','Description','2026-09-30','/document.pdf')",
  );
  for (const { table, key } of Object.values(definitions)) {
    await db.exec(
      `insert into public.${table} select (jsonb_populate_record(null::public.${table},to_jsonb(t)||jsonb_build_object('${key}','auth-draft','published',false))).* from public.${table} t limit 1`,
    );
  }
});
test.afterAll(async () => {
  await db?.close();
});
test("account metadata cannot self-assign roles; new accounts are disabled", async () => {
  const { rows } = await db.query<{ role: string; active: boolean }>(
    "select role,active from public.staff_accounts where user_id=$1",
    [disabled],
  );
  expect(rows[0]).toEqual({ role: "user", active: false });
});
test("ordinary staff can see only their own profile and cannot change roles", async () => {
  await asUser(member, async () => {
    const { rows } = await db.query<{ user_id: string }>(
      "select user_id from public.staff_accounts",
    );
    expect(rows).toEqual([{ user_id: member }]);
    await expect(
      db.exec("update public.staff_accounts set role='superadmin'"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query(
        "select public.set_staff_access($1,'superadmin',true,'Escalated')",
        [member],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
for (const { table, key } of Object.values(definitions)) {
  test(`${table}: only active superadmins can read drafts and edit`, async () => {
    for (const id of [member, disabled]) {
      await asUser(id, async () => {
        expect(
          (
            await db.query(
              `select * from public.${table} where ${key}='auth-draft'`,
            )
          ).rows,
        ).toHaveLength(0);
        expect(
          (
            await db.query(
              `update public.${table} set published=true where ${key}='auth-draft' returning *`,
            )
          ).rows,
        ).toHaveLength(0);
        expect(
          (
            await db.query(
              `delete from public.${table} where ${key}='auth-draft' returning *`,
            )
          ).rows,
        ).toHaveLength(0);
        await expect(
          db.exec(`insert into public.${table} default values`),
        ).rejects.toMatchObject({ code: "42501" });
      });
    }
    await asUser(admin, async () => {
      expect(
        (
          await db.query(
            `select * from public.${table} where ${key}='auth-draft'`,
          )
        ).rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query(
            `update public.${table} set sort_order=10 where ${key}='auth-draft' returning *`,
          )
        ).rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query(
            `insert into public.${table} select (jsonb_populate_record(null::public.${table},to_jsonb(t)||jsonb_build_object('${key}','admin-new'))).* from public.${table} t where ${key}='auth-draft' returning *`,
          )
        ).rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query(
            `delete from public.${table} where ${key}='admin-new' returning *`,
          )
        ).rows,
      ).toHaveLength(1);
    });
  });
}
test("superadmin can approve staff but cannot disable or demote themselves", async () => {
  await asUser(admin, async () => {
    await expect(
      db.query("select public.set_staff_access($1,'user',true,'Name')", [
        admin,
      ]),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(
      db.query("select public.set_staff_access($1,'superadmin',false,'Name')", [
        admin,
      ]),
    ).rejects.toMatchObject({ code: "22023" });
    await db.query(
      "select public.set_staff_access($1,'superadmin',true,'Approved')",
      [disabled],
    );
  });
  await asUser(disabled, async () => {
    expect(
      (
        await db.query<{ is_superadmin: boolean }>(
          "select public.is_superadmin()",
        )
      ).rows[0].is_superadmin,
    ).toBe(true);
  });
  await asUser(admin, async () => {
    await db.query(
      "select public.set_staff_access($1,'superadmin',false,'Approved')",
      [disabled],
    );
  });
  await asUser(disabled, async () => {
    expect(
      (
        await db.query<{ is_superadmin: boolean }>(
          "select public.is_superadmin()",
        )
      ).rows[0].is_superadmin,
    ).toBe(false);
    expect(
      (
        await db.query(
          "update public.departments set name='Unauthorized' returning *",
        )
      ).rows,
    ).toHaveLength(0);
  });
});
test("anonymous visitors cannot read staff or call role-management functions", async () => {
  await db.exec("set role anon");
  try {
    await expect(
      db.exec("select * from public.staff_accounts"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.exec("select public.is_superadmin()"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query("select public.set_staff_access($1,'superadmin',true,'Name')", [
        member,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    expect(
      (await db.query("select * from public.departments where id='auth-draft'"))
        .rows,
    ).toHaveLength(0);
  } finally {
    await db.exec("reset role");
  }
});
test("content form rejects unknown collections, unsafe URLs and invalid dates", () => {
  expect(collectionName("__proto__")).toBeNull();
  expect(collectionName("staff_accounts")).toBeNull();
  const form = new FormData();
  Object.entries({
    id: "valid-id",
    name: "Office",
    description: "Description",
  }).forEach(([k, v]) => form.set(k, v));
  expect(parseContent("departments", form)).toMatchObject({
    published: false,
    is_sample: false,
  });
  form.set("id", "../escape");
  expect(() => parseContent("departments", form)).toThrow();
  const doc = new FormData();
  Object.entries({
    id: "document",
    category_id: "category",
    title: "Title",
    description: "Description",
    date: "2026-09-30",
    file_url: "javascript:alert(1)",
  }).forEach(([k, v]) => doc.set(k, v));
  expect(() => parseContent("documents", doc)).toThrow();
  doc.set("file_url", "/document.pdf");
  doc.set("date", "2026-02-31");
  expect(() => parseContent("documents", doc)).toThrow();
});
