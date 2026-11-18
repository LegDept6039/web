import { test, expect } from "@playwright/test";
import {
  pageDetails,
  pageNumber,
  paginationHref,
  loadAdminPage,
} from "../../lib/admin/pagination";

test("admin page bounds handle empty, last, invalid and deleted pages", () => {
  for (const value of [
    undefined,
    null,
    "0",
    "-1",
    "2.5",
    "2abc",
    [],
    "Infinity",
  ]) {
    expect(pageNumber(value)).toBe(1);
  }
  expect(pageDetails(0, "9")).toMatchObject({
    page: 1,
    pageCount: 1,
    start: 0,
    end: 0,
  });
  expect(pageDetails(51, "2")).toMatchObject({
    page: 2,
    pageCount: 3,
    from: 25,
    to: 49,
    start: 26,
    end: 50,
  });
  expect(pageDetails(50, "3")).toMatchObject({ page: 2, start: 26, end: 50 });
  expect(pageDetails(51, "2", 50)).toMatchObject({
    page: 2,
    pageCount: 2,
    start: 51,
    end: 51,
  });
});

test("pagination links retain encoded filters and separate table pages", () => {
  const url = new URL(
    paginationHref(
      {
        office: "office-id",
        term: "term-id",
        q: "Budget & Roads",
        type: "resolution",
        sort: "date",
        module: "module-id",
        year: "2026",
        page: "2",
        historicalPage: "3",
        saved: "1",
      },
      4,
    ),
    "https://example.test/admin/content/documents",
  );
  expect(Object.fromEntries(url.searchParams)).toEqual({
    office: "office-id",
    term: "term-id",
    q: "Budget & Roads",
    type: "resolution",
    sort: "date",
    module: "module-id",
    year: "2026",
    page: "4",
    historicalPage: "3",
  });
  expect(
    new URLSearchParams(
      paginationHref({ page: "2", historicalPage: "3" }, 4, "historicalPage"),
    ).get("page"),
  ).toBe("2");
});

test("out-of-range database responses recover using the same scoped query", async () => {
  const ranges: number[][] = [];
  const query = {
    async range(from: number, to: number) {
      ranges.push([from, to]);
      if (from > 30)
        return { data: null, error: { code: "PGRST103" }, count: null };
      return {
        data: Array.from({ length: Math.min(to, 30) - from + 1 }, (_, n) => ({
          id: n + from,
        })),
        error: null,
        count: 31,
      };
    },
  };
  const result = await loadAdminPage(query, "9");
  expect(ranges).toEqual([
    [200, 224],
    [0, 0],
    [25, 49],
  ]);
  expect(result.pagination).toMatchObject({
    page: 2,
    start: 26,
    end: 31,
    total: 31,
  });
  expect(result.data?.map((row) => row.id)).toEqual([25, 26, 27, 28, 29, 30]);
});

test("pagination preserves query errors and does not retry access failures", async () => {
  let requests = 0;
  const result = await loadAdminPage(
    {
      async range() {
        requests++;
        return { data: null, error: { code: "42501" }, count: null };
      },
    },
    "2",
  );
  expect(result.error?.code).toBe("42501");
  expect(result.data).toBeNull();
  expect(requests).toBe(1);
});

test("database row caps fill the requested page without skipping records", async () => {
  const ranges: number[][] = [];
  const result = await loadAdminPage(
    {
      async range(from: number, to: number) {
        ranges.push([from, to]);
        return {
          data: Array.from(
            { length: Math.min(10, to - from + 1, 60 - from) },
            (_, n) => ({ id: from + n }),
          ),
          error: null,
          count: 60,
        };
      },
    },
    "2",
  );
  expect(ranges).toEqual([
    [25, 49],
    [35, 49],
    [45, 49],
  ]);
  expect(result.data?.map((row) => row.id)).toEqual(
    Array.from({ length: 25 }, (_, n) => n + 25),
  );
  expect(result.pagination).toMatchObject({
    page: 2,
    start: 26,
    end: 50,
    total: 60,
  });
});

test("short-page fill respects a shrinking total and stops on empty responses", async () => {
  for (const empty of [false, true]) {
    let requests = 0;
    const result = await loadAdminPage(
      {
        async range(from: number, to: number) {
          requests++;
          const count = requests === 1 || empty ? 60 : 38;
          return {
            data:
              empty && requests > 1
                ? []
                : Array.from(
                    { length: Math.min(10, to - from + 1, count - from) },
                    (_, n) => ({ id: from + n }),
                  ),
            error: null,
            count,
          };
        },
      },
      "2",
    );
    expect(requests).toBe(2);
    expect(result.data).toHaveLength(empty ? 10 : 13);
    expect(result.pagination.total).toBe(empty ? 60 : 38);
  }
});

test("errors during short-page fill are returned without retrying or showing partial rows", async () => {
  for (const code of ["42501", "NETWORK_ERROR"]) {
    let requests = 0;
    const result = await loadAdminPage(
      {
        async range() {
          requests++;
          return requests === 1
            ? { data: [{ id: 25 }], error: null, count: 60 }
            : { data: null, error: { code }, count: null };
        },
      },
      "2",
    );
    expect(requests).toBe(2);
    expect(result.error?.code).toBe(code);
    expect(result.data).toBeNull();
  }
});
