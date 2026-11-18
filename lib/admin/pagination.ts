export const ADMIN_PAGE_SIZE = 25;
export type PaginationParams = Record<string, string | string[] | undefined>;

export function pageNumber(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return 1;
  if (!/^\d+$/.test(String(value))) return 1;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0
    ? Math.min(number, 100000)
    : 1;
}

export function pageDetails(
  total: number,
  value: unknown,
  pageSize = ADMIN_PAGE_SIZE,
) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pageNumber(value), pageCount);
  const from = (page - 1) * pageSize;
  return {
    page,
    pageCount,
    pageSize,
    total,
    from,
    to: from + pageSize - 1,
    start: total ? from + 1 : 0,
    end: Math.min(from + pageSize, total),
  };
}

export function paginationHref(
  params: PaginationParams,
  page: number,
  pageKey = "page",
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === pageKey || key === "saved" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value])
      query.append(key, item);
  }
  query.set(pageKey, String(page));
  return `?${query}`;
}

/** Pass an already authorized, filtered, ordered count-exact query. */
export async function loadAdminPage<T, E extends { code?: string }>(
  query: {
    range: (
      from: number,
      to: number,
    ) => PromiseLike<{
      data: T[] | null;
      error: E | null;
      count: number | null;
    }>;
  },
  value: unknown,
  pageSize = ADMIN_PAGE_SIZE,
) {
  const requested = pageNumber(value);
  let from = (requested - 1) * pageSize;
  let result = await query.range(from, from + pageSize - 1);
  // PostgREST may return 416 without a parsed count for an offset past the end.
  // Reuse the same filtered query; never fall back to an unscoped count.
  if (result.error?.code === "PGRST103" && result.count === null) {
    result = await query.range(0, 0);
    if (!result.error) {
      const last = pageDetails(result.count ?? 0, requested, pageSize);
      from = last.from;
      result = await query.range(last.from, last.to);
    }
  } else if (
    result.count !== null &&
    (!result.error || result.error.code === "PGRST103")
  ) {
    const last = pageDetails(result.count, requested, pageSize);
    if (last.page !== requested) {
      from = last.from;
      result = await query.range(last.from, last.to);
    }
  }
  // A custom PostgREST row cap may be lower than our page size. Fill this
  // same authorized range rather than skipping its remaining rows on Next.
  if (!result.error && result.data?.length && result.count !== null) {
    const data = [...result.data];
    let count = result.count;
    let expected = Math.min(pageSize, Math.max(0, count - from));
    for (let reads = 0; reads < pageSize && data.length < expected; reads++) {
      const next = await query.range(from + data.length, from + pageSize - 1);
      if (next.error) {
        result = next;
        break;
      }
      count = next.count ?? count;
      expected = Math.min(pageSize, Math.max(0, count - from));
      if (!next.data?.length) break;
      data.push(...next.data);
    }
    if (!result.error)
      result = { ...result, data: data.slice(0, expected), count };
  }
  return {
    ...result,
    pagination: pageDetails(result.count ?? 0, requested, pageSize),
  };
}
