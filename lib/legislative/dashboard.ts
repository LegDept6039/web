import type { SupabaseClient } from "@supabase/supabase-js";

export interface DashboardAuthorship {
  authored: number;
  coauthored: number;
}

export interface DashboardOfficial {
  id: string;
  name: string;
  ordinances: DashboardAuthorship;
  resolutions: DashboardAuthorship;
}

export interface LegislativeDashboard {
  counts: {
    officials: number | null;
    ordinances: number | null;
    resolutions: number | null;
    sessions: number | null;
    documents: number | null;
  };
  officials: DashboardOfficial[];
  officialsAvailable: boolean;
  authorshipAvailable: { ordinances: boolean; resolutions: boolean };
}

type Table =
  | "officials"
  | "ordinances"
  | "resolutions"
  | "sessions"
  | "municipal_documents";
type Row = Record<string, unknown>;
const PAGE_SIZE = 500;
const NO_TERM = "00000000-0000-0000-0000-000000000000";

function scopedQuery(
  client: SupabaseClient,
  table: Table,
  columns: string,
  officeId: string,
  selected: string,
  head = false,
) {
  let query = client
    .from(table)
    .select(columns, { count: "exact", head })
    .eq("office_id", officeId)
    .eq("content_scope", "legislative");
  query =
    selected === "unassigned"
      ? query.is("term_id", null)
      : query.eq("term_id", selected === "none" ? NO_TERM : selected);
  if (["ordinances", "resolutions", "municipal_documents"].includes(table))
    query = query.eq("published", true);
  if (table === "municipal_documents") query = query.is("deleted_at", null);
  return query;
}

async function readRows(
  client: SupabaseClient,
  table: "officials" | "ordinances" | "resolutions",
  columns: string,
  officeId: string,
  selected: string,
): Promise<{ rows: Row[] | null; count: number | null }> {
  const rows: Row[] = [];
  let count: number | null = null;
  try {
    for (;;) {
      const result = await scopedQuery(
        client,
        table,
        columns,
        officeId,
        selected,
      )
        .order("id")
        .range(rows.length, rows.length + PAGE_SIZE - 1)
        .overrideTypes<Row[], { merge: false }>();
      if (result.error || !Array.isArray(result.data))
        return { rows: null, count };
      count = result.count ?? count;
      if (!result.data.length) {
        // An unexpectedly empty page must not silently truncate the table.
        return count !== null && rows.length < count
          ? { rows: null, count }
          : { rows, count: count ?? rows.length };
      }
      rows.push(...result.data);
      if (count !== null && rows.length >= count) return { rows, count };
      // Continue from the actual response length, including lower server caps.
    }
  } catch {
    return { rows: null, count };
  }
}

async function readCount(
  client: SupabaseClient,
  table: "sessions" | "municipal_documents",
  officeId: string,
  selected: string,
): Promise<number | null> {
  try {
    const { count, error } = await scopedQuery(
      client,
      table,
      "id",
      officeId,
      selected,
      true,
    );
    return error ? null : count;
  } catch {
    return null;
  }
}

function aggregateOfficials(
  officials: Row[],
  ordinances: Row[],
  resolutions: Row[],
): DashboardOfficial[] {
  const result = [...officials]
    .filter((official) => official.legislative_role !== "MUNICIPAL_VICE_MAYOR")
    .sort(
      (a, b) =>
        Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) ||
        String(a.id).localeCompare(String(b.id)),
    )
    .map((official) => ({
      id: String(official.id),
      name: String(official.name),
      ordinances: { authored: 0, coauthored: 0 },
      resolutions: { authored: 0, coauthored: 0 },
    }));
  const byId = new Map(result.map((official) => [official.id, official]));
  for (const [type, documents] of [
    ["ordinances", ordinances],
    ["resolutions", resolutions],
  ] as const) {
    for (const document of documents) {
      const author =
        typeof document.author_id === "string"
          ? byId.get(document.author_id)
          : undefined;
      const coauthor =
        typeof document.co_author_id === "string"
          ? byId.get(document.co_author_id)
          : undefined;
      if (author) author[type].authored++;
      if (coauthor) coauthor[type].coauthored++;
    }
  }
  return result;
}

/** Internal loader: callers must authorize the office with the session context. */
export async function loadLegislativeDashboard(
  client: SupabaseClient,
  officeId: string,
  selected: string,
): Promise<LegislativeDashboard> {
  const [officials, ordinances, resolutions, sessions, documents] =
    await Promise.all([
      readRows(
        client,
        "officials",
        "id,name,sort_order,legislative_role",
        officeId,
        selected,
      ),
      readRows(
        client,
        "ordinances",
        "id,author_id,co_author_id",
        officeId,
        selected,
      ),
      readRows(
        client,
        "resolutions",
        "id,author_id,co_author_id",
        officeId,
        selected,
      ),
      readCount(client, "sessions", officeId, selected),
      readCount(client, "municipal_documents", officeId, selected),
    ]);
  return {
    counts: {
      officials: officials.count,
      ordinances: ordinances.count,
      resolutions: resolutions.count,
      sessions,
      documents,
    },
    officials: aggregateOfficials(
      officials.rows ?? [],
      ordinances.rows ?? [],
      resolutions.rows ?? [],
    ),
    officialsAvailable: officials.rows !== null,
    authorshipAvailable: {
      ordinances: officials.rows !== null && ordinances.rows !== null,
      resolutions: officials.rows !== null && resolutions.rows !== null,
    },
  };
}
