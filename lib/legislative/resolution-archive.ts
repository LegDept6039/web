import type { SupabaseConfig } from "@/lib/content/config";
import { decodeRecord } from "@/lib/content/schema";
import type { ContentFetch } from "@/lib/content/supabase";
import type { LegislativeDocument } from "@/types";

export type ResolutionListItem = Pick<
  LegislativeDocument,
  | "id"
  | "number"
  | "title"
  | "dateApproved"
  | "year"
  | "author"
  | "coAuthor"
  | "status"
  | "approvalMode"
>;
export interface ResolutionArchiveInput {
  term: string;
  year?: string;
  q?: string;
  page?: string;
}
export interface ResolutionArchiveResult {
  documents: ResolutionListItem[];
  total: number;
  page: number;
  pageSize: 25;
  years: number[];
  query: string;
  year: string;
}
export const RESOLUTION_PAGE_SIZE = 25;
const ARCHIVE_PATH = "/legislative/resolutions";
const validId = (value: string) =>
  /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/.test(value);

export function normalizeResolutionArchive(input: ResolutionArchiveInput) {
  const requestedPage = /^\d+$/.test(input.page || "") ? Number(input.page) : 1;
  return {
    term: validId(input.term) ? input.term : "none",
    year:
      /^\d{4}$/.test(input.year || "") && Number(input.year) > 0
        ? input.year!
        : "all",
    query: (input.q || "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .trim()
      .slice(0, 200),
    page:
      Number.isSafeInteger(requestedPage) &&
      requestedPage > 0 &&
      requestedPage <=
        Math.floor(Number.MAX_SAFE_INTEGER / RESOLUTION_PAGE_SIZE)
        ? requestedPage
        : 1,
  };
}

/** Only these public archive parameters can travel to a detail page and back. */
export function resolutionArchiveHref(input: ResolutionArchiveInput) {
  const state = normalizeResolutionArchive(input);
  const params = new URLSearchParams({ term: state.term });
  if (state.year !== "all") params.set("year", state.year);
  if (state.query) params.set("q", state.query);
  if (state.page > 1) params.set("page", String(state.page));
  return `${ARCHIVE_PATH}?${params}`;
}

export function parseResolutionReturnTo(value?: string) {
  if (!value || !value.startsWith(`${ARCHIVE_PATH}?`)) return ARCHIVE_PATH;
  let parsed: URL;
  try {
    parsed = new URL(value, "https://archive.invalid");
  } catch {
    return ARCHIVE_PATH;
  }
  if (
    parsed.origin !== "https://archive.invalid" ||
    parsed.pathname !== ARCHIVE_PATH ||
    parsed.hash
  )
    return ARCHIVE_PATH;
  const params = parsed.searchParams;
  if (
    [...params.keys()].some(
      (key) => !["term", "year", "q", "page"].includes(key),
    )
  )
    return ARCHIVE_PATH;
  const term = params.get("term");
  if (!term || !validId(term)) return ARCHIVE_PATH;
  return resolutionArchiveHref({
    term,
    year: params.get("year") || undefined,
    q: params.get("q") || undefined,
    page: params.get("page") || undefined,
  });
}

function listItem(document: LegislativeDocument): ResolutionListItem {
  return {
    id: document.id,
    number: document.number,
    title: document.title,
    dateApproved: document.dateApproved,
    year: document.year,
    author: document.author,
    ...(document.coAuthor ? { coAuthor: document.coAuthor } : {}),
    status: document.status,
    ...(document.approvalMode ? { approvalMode: document.approvalMode } : {}),
  };
}

// Regex matching avoids LIKE's wildcard aliases: %, _, and * remain literal input.
// Quote the complete PostgREST value as well, so punctuation cannot add predicates.
function literalSearch(query: string) {
  const regex = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return {
    regex,
    quoted: `"${regex.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
  };
}

function scopeParams(term: string) {
  return new URLSearchParams({
    published: "eq.true",
    content_scope: "eq.legislative",
    term_id: term === "unassigned" ? "is.null" : `eq.${term}`,
  });
}

function pageParams(
  state: ReturnType<typeof normalizeResolutionArchive>,
  offset: number,
  limit: number,
) {
  const params = scopeParams(state.term);
  let select =
    "id,number,title,date_approved,year,author,co_author,status,approval_mode,author_id,co_author_id,author_record:officials!author_id(name),co_author_record:officials!co_author_id(name)";
  if (state.year !== "all") params.set("year", `eq.${state.year}`);
  if (state.query) {
    const { regex, quoted: pattern } = literalSearch(state.query);
    select +=
      ",author_match:officials!author_id(),coauthor_match:officials!co_author_id()";
    // An isolated column filter does not use OR's quoted-value grammar.
    params.set("author_match.name", `imatch.${regex}`);
    params.set("coauthor_match.name", `imatch.${regex}`);
    const authored = `and(or(approval_mode.is.null,approval_mode.neq.mass_motion),or(author_match.not.is.null,coauthor_match.not.is.null,and(author_id.is.null,author.imatch.${pattern}),and(author_id.is.null,co_author_id.is.null,co_author.imatch.${pattern})))`;
    const massMotion = "mass motion".includes(state.query.toLowerCase())
      ? ",approval_mode.eq.mass_motion"
      : "";
    params.set(
      "or",
      `(number.imatch.${pattern},title.imatch.${pattern},${authored}${massMotion})`,
    );
  }
  params.set("select", select);
  params.set("order", "date_approved.desc,id.asc");
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return params;
}

async function requestRows(
  config: SupabaseConfig,
  request: ContentFetch,
  params: URLSearchParams,
) {
  let response: Response;
  try {
    response = await request(`${config.url}/rest/v1/resolutions?${params}`, {
      headers: {
        apikey: config.key,
        Accept: "application/json",
        Prefer: "count=exact",
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Could not reach the resolutions archive.");
  }
  if (!response.ok && response.status !== 416)
    throw new Error(`Could not load resolutions (HTTP ${response.status}).`);
  const count = response.headers.get("content-range")?.split("/")[1];
  if (!count || !/^\d+$/.test(count) || !Number.isSafeInteger(Number(count)))
    throw new Error(
      "The resolutions archive did not return an accurate result count.",
    );
  const total = Number(count);
  if (response.status === 416) return { rows: [], total, outOfRange: true };
  const rows: unknown = await response.json();
  if (!Array.isArray(rows))
    throw new Error("Invalid resolutions archive response.");
  return { rows, total, outOfRange: false };
}

async function readYears(
  term: string,
  config: SupabaseConfig,
  request: ContentFetch,
) {
  const years = new Set<number>();
  let offset = 0;
  for (let attempt = 0; attempt < 200; attempt++) {
    const params = scopeParams(term);
    params.set("select", "year");
    params.set("order", "year.desc,id.asc");
    params.set("limit", "500");
    params.set("offset", String(offset));
    const result = await requestRows(config, request, params);
    for (const row of result.rows) {
      const year = (row as { year?: unknown }).year;
      if (typeof year !== "number" || !Number.isSafeInteger(year))
        throw new Error("Invalid resolution year.");
      years.add(year);
    }
    offset += result.rows.length;
    if (offset >= result.total) return [...years].sort((a, b) => b - a);
    if (!result.rows.length)
      throw new Error("Incomplete resolutions archive years.");
  }
  throw new Error("Too many resolution years to load.");
}

async function readPage(
  state: ReturnType<typeof normalizeResolutionArchive>,
  config: SupabaseConfig,
  request: ContentFetch,
) {
  let page = state.page;
  let documents: ResolutionListItem[] = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    const offset = (page - 1) * RESOLUTION_PAGE_SIZE;
    const result = await requestRows(
      config,
      request,
      pageParams(
        state,
        offset + documents.length,
        RESOLUTION_PAGE_SIZE - documents.length,
      ),
    );
    const lastPage = Math.max(
      1,
      Math.ceil(result.total / RESOLUTION_PAGE_SIZE),
    );
    if (page > lastPage) {
      page = lastPage;
      documents = [];
      continue;
    }
    if (result.outOfRange && result.total !== 0)
      throw new Error("Invalid resolutions archive page.");
    documents.push(
      ...result.rows.map((row) =>
        listItem(
          decodeRecord("resolutions", {
            summary: "",
            is_sample: false,
            ...(row as Record<string, unknown>),
          }),
        ),
      ),
    );
    if (
      documents.length >= RESOLUTION_PAGE_SIZE ||
      offset + documents.length >= result.total
    )
      return {
        documents: documents.slice(0, RESOLUTION_PAGE_SIZE),
        total: result.total,
        page,
      };
    if (!result.rows.length)
      throw new Error("Incomplete resolutions archive page.");
  }
  throw new Error("Unable to finish loading the resolutions archive page.");
}

export async function readResolutionArchive(
  input: ResolutionArchiveInput,
  config: SupabaseConfig,
  request: ContentFetch = fetch,
): Promise<ResolutionArchiveResult> {
  const state = normalizeResolutionArchive(input);
  const empty = {
    documents: [],
    total: 0,
    page: 1,
    pageSize: RESOLUTION_PAGE_SIZE,
    years: [],
    query: state.query,
    year: state.year,
  } satisfies ResolutionArchiveResult;
  if (state.term === "none") return empty;
  const [result, years] = await Promise.all([
    readPage(state, config, request),
    readYears(state.term, config, request),
  ]);
  return {
    ...result,
    pageSize: RESOLUTION_PAGE_SIZE,
    years,
    query: state.query,
    year: state.year,
  };
}

export function readMockResolutionArchive(
  input: ResolutionArchiveInput,
  documents: LegislativeDocument[],
): ResolutionArchiveResult {
  const state = normalizeResolutionArchive(input);
  const scoped =
    state.term === "none"
      ? []
      : documents.filter(
          (d) =>
            d.contentScope !== "executive" &&
            (state.term === "unassigned" ? !d.termId : d.termId === state.term),
        );
  const years = [...new Set(scoped.map((d) => d.year))].sort((a, b) => b - a);
  const matching = scoped
    .filter(
      (d) =>
        (state.year === "all" || String(d.year) === state.year) &&
        [
          d.number,
          d.title,
          ...(d.approvalMode === "mass_motion"
            ? ["Mass motion"]
            : [d.author, d.coAuthor || ""]),
        ].some((value) =>
          value.toLowerCase().includes(state.query.toLowerCase()),
        ),
    )
    .sort(
      (a, b) =>
        b.dateApproved.localeCompare(a.dateApproved) ||
        a.id.localeCompare(b.id),
    );
  const page = Math.min(
    state.page,
    Math.max(1, Math.ceil(matching.length / RESOLUTION_PAGE_SIZE)),
  );
  return {
    documents: matching
      .slice((page - 1) * RESOLUTION_PAGE_SIZE, page * RESOLUTION_PAGE_SIZE)
      .map(listItem),
    total: matching.length,
    page,
    pageSize: RESOLUTION_PAGE_SIZE,
    years,
    query: state.query,
    year: state.year,
  };
}
