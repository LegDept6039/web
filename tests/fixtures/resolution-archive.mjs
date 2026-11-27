// Opt-in Node transport fixture. Never imported by application code.
import "./supabase.mjs";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

if (process.env.PORTAL_RESOLUTION_ARCHIVE_TEST_FIXTURE === "1") {
  const previousFetch = globalThis.fetch;
  if (process.env.RESOLUTION_ARCHIVE_FIXTURE_LOG)
    mkdirSync(dirname(process.env.RESOLUTION_ARCHIVE_FIXTURE_LOG), {
      recursive: true,
    });
  const currentTerm = "20000000-0000-4000-8000-000000000001";
  const previousTerm = "20000000-0000-4000-8000-000000000002";
  const officeId = "10000000-0000-4000-8000-000000000004";
  const people = [
    { id: "archive-author", name: "Hon. Richard M. Canillo" },
    { id: "archive-coauthor", name: "Hon. Annette J. Navarro" },
    { id: "archive-late-coauthor", name: "Hon. Marmie Jeanne B. Albillar" },
  ];
  const baseRows = Array.from({ length: 142 }, (_, index) => {
    const sequence = index + 1;
    const year = sequence <= 40 ? 2025 : 2026;
    const number =
      sequence === 118
        ? "232-2026"
        : `${String(sequence).padStart(3, "0")}-${year}`;
    return {
      id: `archive-resolution-${sequence}`,
      number,
      title:
        sequence === 118
          ? "A RESOLUTION ADOPTING AND APPROVING THE FY 2026 SUPPLEMENTAL INVESTMENT PLAN NO. 4 OF THE MUNICIPALITY OF PINAMUNGAJAN"
          : `A RESOLUTION APPROVING MUNICIPAL COMMUNITY DEVELOPMENT PROJECT ${sequence} AND PROVIDING CONTINUING SUPPORT TO THE BARANGAYS OF PINAMUNGAJAN`,
      date_approved:
        sequence === 118
          ? "2026-01-01"
          : `${year}-11-${String((sequence % 25) + 1).padStart(2, "0")}`,
      year,
      author: "",
      co_author: null,
      author_id: sequence === 140 ? null : "archive-author",
      co_author_id:
        sequence === 140
          ? null
          : sequence === 118
            ? "archive-late-coauthor"
            : "archive-coauthor",
      committee_id: "archive-committee",
      session_id: null,
      approval_mode: sequence === 140 ? "mass_motion" : "authored",
      status: "Approved",
      summary:
        `Full verified text for Resolution No. ${number}. ` +
        "The municipality shall implement the approved community program with the stated funding and reporting requirements. ".repeat(
          35,
        ),
      pdf_url: `https://records.example.test/resolution-${number}.pdf`,
      published: true,
      is_sample: false,
      sort_order: sequence,
      office_id: officeId,
      content_scope: "legislative",
      term_id: currentTerm,
      updated_at: "2026-11-27T00:00:00Z",
    };
  });
  baseRows.push(
    {
      ...baseRows[0],
      id: "archive-draft",
      title: "PRIVATE DRAFT RESOLUTION",
      published: false,
    },
    {
      ...baseRows[0],
      id: "archive-previous",
      number: "232-2024",
      year: 2024,
      date_approved: "2024-11-09",
      title: "Previous council water program",
      term_id: previousTerm,
    },
    {
      ...baseRows[0],
      id: "archive-unassigned",
      number: "001-1980",
      year: 1980,
      date_approved: "1980-01-01",
      title: "Unassigned historical resolution",
      term_id: null,
    },
    {
      ...baseRows[0],
      id: "archive-foreign",
      title: "EXECUTIVE ONLY RESOLUTION",
      content_scope: "executive",
    },
  );

  function state() {
    const path = process.env.RESOLUTION_ARCHIVE_FIXTURE_STATE;
    return path && existsSync(path)
      ? JSON.parse(readFileSync(path, "utf8"))
      : {};
  }

  function splitTopLevel(value) {
    const parts = [];
    let depth = 0,
      quoted = false,
      start = 0;
    for (let i = 0; i < value.length; i++) {
      if (value[i] === '"' && value[i - 1] !== "\\") quoted = !quoted;
      if (quoted) continue;
      if (value[i] === "(") depth++;
      if (value[i] === ")") depth--;
      if (value[i] === "," && depth === 0) {
        parts.push(value.slice(start, i));
        start = i + 1;
      }
    }
    return [...parts, value.slice(start)].filter(Boolean);
  }

  function scalar(value) {
    if (value.startsWith('"') && value.endsWith('"'))
      return value.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\\\", "\\");
    return value;
  }

  function matches(value, expression) {
    if (expression.startsWith("eq."))
      return String(value) === scalar(expression.slice(3));
    if (expression.startsWith("neq."))
      return String(value) !== scalar(expression.slice(4));
    if (expression === "is.null") return value == null;
    if (expression === "not.is.null") return value != null;
    if (expression.startsWith("in.("))
      return splitTopLevel(expression.slice(4, -1))
        .map(scalar)
        .includes(String(value));
    if (expression.startsWith("imatch."))
      return new RegExp(scalar(expression.slice(7)), "iu").test(
        String(value ?? ""),
      );
    if (expression.startsWith("ilike.")) {
      const pattern = scalar(expression.slice(6));
      let regex = "";
      for (let i = 0; i < pattern.length; i++) {
        const char = pattern[i];
        if (char === "\\" && i + 1 < pattern.length)
          regex += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        else if (char === "%" || char === "*") regex += ".*";
        else if (char === "_") regex += ".";
        else regex += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
      return new RegExp(`^${regex}$`, "iu").test(String(value ?? ""));
    }
    throw new Error(`Unsupported fixture filter: ${expression}`);
  }

  function getValue(row, key) {
    return key.split(".").reduce((value, part) => value?.[part], row);
  }

  function clause(row, expression) {
    for (const kind of ["or", "and"]) {
      if (expression.startsWith(`${kind}(`) && expression.endsWith(")")) {
        const checks = splitTopLevel(expression.slice(kind.length + 1, -1)).map(
          (part) => clause(row, part),
        );
        return kind === "or" ? checks.some(Boolean) : checks.every(Boolean);
      }
    }
    const operator = expression.match(/\.(eq|neq|ilike|imatch|in|is|not)\./);
    if (!operator) throw new Error(`Unsupported fixture clause: ${expression}`);
    const key = expression.slice(0, operator.index);
    return matches(getValue(row, key), expression.slice(operator.index + 1));
  }

  function embed(row) {
    return {
      ...row,
      author_record:
        people.find((person) => person.id === row.author_id) || null,
      co_author_record:
        people.find((person) => person.id === row.co_author_id) || null,
      author_match:
        people.find((person) => person.id === row.author_id) || null,
      coauthor_match:
        people.find((person) => person.id === row.co_author_id) || null,
      committee_record: row.committee_id
        ? { name: "Committee on Finance, Budget and Appropriation" }
        : null,
      session_record: null,
    };
  }

  function project(row, select) {
    if (!select || select === "*") return row;
    const result = {};
    for (const field of splitTopLevel(select)) {
      if (field === "*") Object.assign(result, row);
      else if (field.includes("(")) {
        const alias = field.split(":")[0];
        const relation = row[alias];
        const selected = field.slice(field.indexOf("(") + 1, -1);
        result[alias] = relation == null ? null : project(relation, selected);
      } else result[field] = row[field];
    }
    return result;
  }

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(
      typeof input === "string" ? input : input.url || String(input),
    );
    if (
      url.hostname !== "fixture.supabase.test" ||
      ![
        "/rest/v1/resolutions",
        "/rest/v1/officials",
        "/rest/v1/committees",
      ].includes(url.pathname)
    )
      return previousFetch(input, init);
    const method = init.method || "GET";
    if (method !== "GET" && method !== "HEAD")
      throw new Error("Resolution archive fixture is read only");
    const snapshot = state();
    const table = url.pathname.split("/").at(-1);
    let rows =
      table === "resolutions"
        ? baseRows
            .map((row) =>
              embed({ ...row, ...(snapshot.records?.[row.id] || {}) }),
            )
            .filter((row) => row.published)
        : table === "officials"
          ? people.map((person) => ({
              ...person,
              office_id: officeId,
              content_scope: "legislative",
              term_id: currentTerm,
              published: true,
              legislative_role: "SANGGUNIANG_BAYAN",
            }))
          : [
              {
                id: "archive-committee",
                name: "Committee on Finance, Budget and Appropriation",
                published: true,
                office_id: officeId,
                content_scope: "legislative",
                term_id: currentTerm,
              },
            ];
    const embeddedFilters = new Map();
    for (const [key, value] of url.searchParams) {
      if (["select", "order", "limit", "offset"].includes(key)) continue;
      if (key === "or" || key === "and") continue;
      if (key.endsWith(".or") || key.endsWith(".and")) {
        const separator = key.lastIndexOf(".");
        const relation = key.slice(0, separator),
          kind = key.slice(separator + 1);
        embeddedFilters.set(relation, (row) => clause(row, `${kind}${value}`));
      } else if (key.includes(".") && !key.endsWith(".not")) {
        const separator = key.indexOf(".");
        const relation = key.slice(0, separator),
          column = key.slice(separator + 1);
        embeddedFilters.set(relation, (row) => matches(row?.[column], value));
      } else rows = rows.filter((row) => matches(getValue(row, key), value));
    }
    // PostgREST embedded filters restrict the embed, while top-level not.is.null
    // predicates decide whether its parent participates in a search OR.
    for (const [relation, filter] of embeddedFilters)
      rows = rows.map((row) => ({
        ...row,
        [relation]:
          row[relation] && filter(row[relation]) ? row[relation] : null,
      }));
    for (const [key, value] of url.searchParams)
      if (key === "or" || key === "and")
        rows = rows.filter((row) => clause(row, `${key}${value}`));
    const order = splitTopLevel(url.searchParams.get("order") || "");
    rows.sort((a, b) => {
      for (const field of order) {
        const [key, direction] = field.split(".");
        const comparison = a[key] === b[key] ? 0 : a[key] < b[key] ? -1 : 1;
        if (comparison) return direction === "desc" ? -comparison : comparison;
      }
      return 0;
    });
    const count = rows.length;
    const offset = Number(url.searchParams.get("offset") || 0);
    const limit = Number(url.searchParams.get("limit") || 1000);
    rows = rows
      .slice(offset, offset + limit)
      .map((row) => project(row, url.searchParams.get("select")));
    if (process.env.RESOLUTION_ARCHIVE_FIXTURE_LOG)
      appendFileSync(
        process.env.RESOLUTION_ARCHIVE_FIXTURE_LOG,
        JSON.stringify({
          table,
          url: url.href,
          count,
          returned: rows.length,
          method,
          cache: init.cache,
        }) + "\n",
      );
    return new Response(method === "HEAD" ? null : JSON.stringify(rows), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-range": rows.length
          ? `${offset}-${offset + rows.length - 1}/${count}`
          : `*/${count}`,
      },
    });
  };
}
