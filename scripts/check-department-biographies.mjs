// Read-only audit: prints identity and length, never biography text or credentials.
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Set SUPABASE_URL and the server-only SUPABASE_SERVICE_ROLE_KEY to audit all departments.",
  );
  process.exitCode = 1;
} else {
  try {
    let offset = 0,
      total = 0,
      flagged = 0;
    while (true) {
      const endpoint = new URL("/rest/v1/departments", url);
      endpoint.search = new URLSearchParams({
        select: "id,name,head_description",
        order: "id.asc",
        offset: String(offset),
        limit: "500",
      }).toString();
      const response = await fetch(endpoint, {
        headers: {
          apikey: key,
          ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
        },
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error("Invalid response");
      if (!rows.length) break;
      for (const r of rows) {
        total++;
        const length = String(r.head_description || "").replace(
          /\r\n?/g,
          "\n",
        ).length;
        if (length > 800) {
          flagged++;
          console.log(
            JSON.stringify({ id: r.id, name: r.name, characters: length }),
          );
        }
      }
      offset += rows.length;
    }
    console.log(
      `Checked ${total} departments; ${flagged} biographies exceed 800 characters. No data changed.`,
    );
  } catch (error) {
    console.error(
      error instanceof Error && /^HTTP [0-9]+$/.test(error.message)
        ? error.message
        : "Read-only audit could not reach the configured database.",
    );
    process.exitCode = 1;
  }
}
