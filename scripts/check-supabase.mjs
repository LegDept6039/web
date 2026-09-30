// Read-only setup check; Node's --env-file flag loads .env.local before this script.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (
  process.env.CONTENT_SOURCE !== "supabase" ||
  !url ||
  !key?.startsWith("sb_publishable_")
) {
  console.error(
    "Set CONTENT_SOURCE=supabase, SUPABASE_URL, and a publishable key in .env.local. See docs/SUPABASE.md.",
  );
  process.exitCode = 1;
} else {
  const tables = [
    "officials",
    "news",
    "ordinances",
    "resolutions",
    "sessions",
    "hearings",
    "services",
    "departments",
    "programs",
    "committees",
    "document_categories",
    "municipal_documents",
  ];
  for (const table of tables) {
    try {
      const result = await fetch(
        `${url.replace(/\/$/, "")}/rest/v1/${table}?select=${table === "news" ? "slug" : "id"}&published=eq.true&limit=1`,
        {
          headers: { apikey: key, Accept: "application/json" },
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!result.ok) throw new Error(`HTTP ${result.status}`);
      const rows = await result.json();
      if (!Array.isArray(rows)) throw new Error("Unexpected response");
      console.log(
        `${table}: OK (${rows.length ? "published content available" : "no published content yet"})`,
      );
    } catch (error) {
      console.error(
        `${table}: ${error instanceof Error && /^HTTP \d+$/.test(error.message) ? error.message : "Connection or response check failed"}. Check project configuration, migrations, and policies.`,
      );
      process.exitCode = 1;
    }
  }
}
