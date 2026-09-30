import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { definitions } from "../../lib/content/schema";
let db: PGlite;
const seed = readFileSync("supabase/seed.sql", "utf8");
test.beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; grant usage on schema public to anon, authenticated;",
  );
  await db.exec(
    readFileSync("supabase/migrations/202609300001_content.sql", "utf8"),
  );
  await db.exec(seed);
  await db.exec(
    "insert into public.municipal_documents (id,category_id,title,description,date,file_url,published) values ('sample-file','full-disclosure','File','Sample file','2026-09-30','/documents/sample-legislative-document.pdf',true)",
  );
  for (const { table, key } of Object.values(definitions)) {
    await db.exec(
      `insert into public.${table} select (jsonb_populate_record(null::public.${table},to_jsonb(t)||jsonb_build_object('${key}','policy-test-draft','published',false))).* from public.${table} t limit 1`,
    );
  }
});
test.afterAll(async () => {
  await db?.close();
});

test("schema and optional seed execute; seeding again preserves edits", async () => {
  await db.exec(
    "update public.departments set name='Edited name' where id='administration'",
  );
  await db.exec(seed);
  const { rows } = await db.query<{ name: string }>(
    "select name from public.departments where id='administration'",
  );
  expect(rows[0].name).toBe("Edited name");
});
for (const { table, key } of Object.values(definitions)) {
  test(`${table}: drafts hidden and public writes denied for both client roles`, async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      try {
        const { rows } = await db.query<{ published: boolean }>(
          `select * from public.${table}`,
        );
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((r) => r.published)).toBe(true);
        const hidden = await db.query(
          `select * from public.${table} where ${key}='policy-test-draft'`,
        );
        expect(hidden.rows).toHaveLength(0);
        for (const sql of [
          `insert into public.${table} default values`,
          `update public.${table} set published=true`,
          `delete from public.${table}`,
        ]) {
          await expect(db.exec(sql)).rejects.toMatchObject({ code: "42501" });
        }
      } finally {
        await db.exec("reset role");
      }
    }
  });
}
test("document category references prevent orphaned documents", async () => {
  await expect(
    db.exec(
      "insert into public.municipal_documents (id,category_id,title,description,date,file_url) values ('orphan','missing','File','Desc','2026-09-30','/file.pdf')",
    ),
  ).rejects.toMatchObject({ code: "23503" });
});
