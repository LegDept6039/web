import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { gallerySelection } from "../../lib/content/gallery";
import { decodeRecord } from "../../lib/content/schema";

test("gallery saves preserve references and accept only retained originals plus staged uploads", () => {
  const form = new FormData();
  expect(gallerySelection(form, ["/one.png", "/two.png"])).toEqual({
    retained: ["/one.png", "/two.png"],
    staged: [],
  });
  form.set("gallery_keep", JSON.stringify(["/two.png"]));
  form.set(
    "gallery_upload_paths",
    JSON.stringify(["news/office/user/photo.png"]),
  );
  expect(gallerySelection(form, ["/one.png", "/two.png"]).retained).toEqual([
    "/two.png",
  ]);
  form.set("gallery_keep", JSON.stringify(["/forged.png"]));
  expect(() => gallerySelection(form, ["/one.png"])).toThrow(/unavailable/);
  for (const value of ["not-json", "{}", '["/one.png","/one.png"]', "[null]"]) {
    form.set("gallery_keep", value);
    expect(() => gallerySelection(form, ["/one.png"])).toThrow();
  }
  form.set("gallery_keep", JSON.stringify([]));
  form.set(
    "gallery_upload_paths",
    JSON.stringify(Array.from({ length: 13 }, (_, i) => `photo-${i}`)),
  );
  expect(() => gallerySelection(form, [])).toThrow(/12/);
});

test("gallery decoding retains image order, rejects unsafe URLs and accepts legacy records", () => {
  const news = {
    slug: "gallery",
    title: "Gallery",
    category: "Office",
    date: "2026-11-27",
    excerpt: "Excerpt",
    image: "/cover.png",
    content: ["Body"],
    is_sample: false,
  };
  expect(decodeRecord("news", news).galleryImages).toBeUndefined();
  expect(
    decodeRecord("news", {
      ...news,
      gallery_images: ["/first.png", "https://example.test/second.png"],
    }).galleryImages,
  ).toEqual(["/first.png", "https://example.test/second.png"]);
  for (const gallery_images of [
    ["javascript:alert(1)"],
    ["//evil.test/photo.png"],
    ["/back\\slash.png"],
    [12],
    Array(13).fill("/photo.png"),
  ])
    expect(() => decodeRecord("news", { ...news, gallery_images })).toThrow();
});

test.describe("gallery migration and real SQL policies", () => {
  let db: PGlite;
  let office: string;
  let other: string;
  const editor = "00000000-0000-4000-8000-000000000002";
  const viewer = "00000000-0000-4000-8000-000000000003";
  const superadmin = "00000000-0000-4000-8000-000000000001";
  async function as<T>(user: string | null, run: () => Promise<T>) {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      user || "",
    ]);
    await db.exec(`set role ${user ? "authenticated" : "anon"}`);
    try {
      return await run();
    } finally {
      await db.exec(
        "reset role;select set_config('request.jwt.claim.sub','',false)",
      );
    }
  }
  test.beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;grant usage on schema auth to anon,authenticated,service_role;
      create table auth.users(id uuid primary key,email text);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),created_at timestamptz not null);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      create schema storage;grant usage on schema storage to anon,authenticated;
      create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
      grant select,insert,delete on storage.objects to authenticated;grant select on storage.objects to anon;
      create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create policy public_media_read on storage.objects for select to anon,authenticated using(bucket_id='municipal-media');`);
    for (const file of readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql") && f < "202611270039")
      .sort()) {
      if (file === "202609300002_media.sql") continue;
      await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
      if (file === "202610010005_legislative_modules.sql")
        await db.exec(readFileSync("supabase/seed.sql", "utf8"));
    }
    for (const [index, id] of [superadmin, editor, viewer].entries()) {
      await db.query("insert into auth.users values($1,$2)", [
        id,
        `gallery-${index}@test.local`,
      ]);
      await db.query(
        "update staff_accounts set role=$1,active=true where user_id=$2",
        [index === 0 ? "superadmin" : index === 1 ? "editor" : "viewer", id],
      );
    }
    office = (
      await db.query<{ id: string }>(
        "select id from departments where department='executive' and active and published and archived_at is null and parent_department_id is null and not public.is_barangay_affairs_office(id) order by id limit 1",
      )
    ).rows[0].id;
    other = (
      await db.query<{ id: string }>(
        "select id from departments where slug='legislative-access'",
      )
    ).rows[0].id;
    await as(superadmin, async () => {
      for (const [id, role, level] of [
        [editor, "editor", "editor"],
        [viewer, "viewer", "viewer"],
      ])
        await db.query(
          "select manage_staff($1,$2,true,'Gallery staff',$3::jsonb,false)",
          [
            id,
            role,
            JSON.stringify([{ office_id: office, permission_level: level }]),
          ],
        );
      await db.query(
        "insert into news(slug,title,category,date,excerpt,image,content,office_id,content_scope,published,sort_order) values('migration-gallery','Preserved news','Health','2026-11-27','Excerpt','/cover.png',array['Body'],$1,'executive',false,0)",
        [office],
      );
    });
    const before = (
      await db.query("select to_jsonb(n) value from news n order by slug")
    ).rows;
    await db.exec(
      readFileSync(
        "supabase/migrations/202611270039_content_photo_galleries.sql",
        "utf8",
      ),
    );
    expect(
      (
        await db.query(
          "select to_jsonb(n)-'gallery_images' value from news n order by slug",
        )
      ).rows,
    ).toEqual(before);
  });
  test.afterAll(async () => {
    await db?.close();
  });

  test("existing content survives and galleries are bounded without exposing drafts", async () => {
    await as(editor, async () => {
      await db.exec(
        "update news set gallery_images=array['/first.png','/second.png'] where slug='migration-gallery'",
      );
      await expect(
        db.exec(
          "update news set gallery_images=array['javascript:alert(1)'] where slug='migration-gallery'",
        ),
      ).rejects.toThrow();
      await expect(
        db.exec(
          "update news set gallery_images=array_fill('/photo.png'::text,array[13]) where slug='migration-gallery'",
        ),
      ).rejects.toThrow();
      await expect(
        db.exec(
          "update news set gallery_images=array[['/one.png','/two.png']] where slug='migration-gallery'",
        ),
      ).rejects.toThrow();
    });
    await as(null, async () =>
      expect(
        (
          await db.query(
            "select * from published_news where slug='migration-gallery'",
          )
        ).rows,
      ).toHaveLength(0),
    );
    await as(editor, async () => {
      const position = (
        await db.query<{ n: number }>(
          "select count(*)::integer+1 n from news where office_id=$1 and content_scope='executive' and published",
          [office],
        )
      ).rows[0].n;
      await db.query(
        "update news set published=true,sort_order=$1 where slug='migration-gallery'",
        [position],
      );
    });
    await as(null, async () =>
      expect(
        (
          await db.query<{ gallery_images: string[] }>(
            "select gallery_images from published_news where slug='migration-gallery'",
          )
        ).rows[0].gallery_images,
      ).toEqual(["/first.png", "/second.png"]),
    );
  });

  test("program uploads use existing office rights and reject cross-office and viewer writes", async () => {
    const path = `programs/${office}/${editor}/00000000-0000-4000-8000-000000000099.png`;
    await as(editor, async () => {
      await db.query(
        "insert into storage.objects values('municipal-news-staging',$1)",
        [path],
      );
      await expect(
        db.query(
          "insert into storage.objects values('municipal-news-staging',$1)",
          [path.replace(office, other)],
        ),
      ).rejects.toThrow();
    });
    await as(
      viewer,
      async () =>
        await expect(
          db.query(
            "insert into storage.objects values('municipal-news-staging',$1)",
            [path.replace(editor, viewer)],
          ),
        ).rejects.toThrow(),
    );
  });

  test("draft gallery references protect shared media from cleanup", async () => {
    const path = `news/${office}/${editor}/preserved.png`;
    await as(editor, async () => {
      await db.query(
        "insert into storage.objects values('municipal-media',$1)",
        [path],
      );
      await db.query(
        "update news set published=false,sort_order=0,gallery_images=array[$1] where slug='migration-gallery'",
        [
          `https://example.test/storage/v1/object/public/municipal-media/${path}`,
        ],
      );
      expect(
        (
          await db.query<{ v: boolean }>(
            "select news_media_unreferenced($1) v",
            [path],
          )
        ).rows[0].v,
      ).toBe(false);
      expect(
        (
          await db.query(
            "delete from storage.objects where name=$1 returning name",
            [path],
          )
        ).rows,
      ).toHaveLength(0);
    });
  });
});
