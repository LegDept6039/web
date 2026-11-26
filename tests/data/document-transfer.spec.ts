import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { definitions } from "../../lib/content/schema";
import * as config from "../../lib/legislative/config";
import {
  DOCUMENT_CSV_MAX_ROWS,
  parseDocumentCsv,
  serializeDocumentCsv,
  type DocumentCsvRow,
} from "../../lib/legislative/document-csv";
import { parseLegislative } from "../../lib/legislative/validation";
import type { OfficeContext } from "../../lib/offices/server";
import type * as DocumentTransfer from "../../lib/legislative/document-transfer";

const officeId = "legislative-office";
const termId = "current-term";
type RecordRow = Record<string, unknown>;

function transferHarness(documents: RecordRow[] = []) {
  const requests: { table: string; columns: string }[] = [];
  const records: Record<string, RecordRow[]> = {
    ordinances: documents,
    resolutions: documents,
    legislative_documents: [],
    sessions: [
      {
        id: "date-session",
        office_id: officeId,
        content_scope: "legislative",
        term_id: termId,
      },
    ],
    officials: [
      {
        id: "sb-author",
        office_id: officeId,
        content_scope: "legislative",
        term_id: termId,
        legislative_role: "SANGGUNIANG_BAYAN",
      },
    ],
    committees: [
      {
        id: "term-committee",
        office_id: officeId,
        content_scope: "legislative",
        term_id: termId,
      },
    ],
  };
  const client = {
    from(table: string) {
      const filters = new Map<string, unknown>();
      let start = 0;
      let end = Infinity;
      const result = () => {
        const matches = (records[table] || []).filter((row) =>
          [...filters].every(([key, value]) => row[key] === value),
        );
        return {
          data: matches.slice(start, end + 1),
          error: null,
          count: matches.length,
        };
      };
      const query = {
        select(columns: string) {
          requests.push({ table, columns });
          return query;
        },
        eq(key: string, value: unknown) {
          filters.set(key, value);
          return query;
        },
        is(key: string, value: unknown) {
          filters.set(key, value);
          return query;
        },
        in() {
          return query;
        },
        order() {
          return query;
        },
        range(first: number, last: number) {
          start = first;
          end = last;
          return query;
        },
        async maybeSingle() {
          return { data: result().data[0] || null, error: null };
        },
        then(resolve: (value: ReturnType<typeof result>) => unknown) {
          return Promise.resolve(result()).then(resolve);
        },
      };
      return query;
    },
  };
  const dependencies: Record<string, unknown> = {
    "server-only": {},
    "@/lib/content/schema": { definitions },
    "@/lib/offices/server": { contentAllowed: () => true },
    "./config": config,
    "./document-csv": { DOCUMENT_CSV_MAX_ROWS },
    "./validation": { parseLegislative },
    "./term-assignment": {
      async assignRecordTerm(
        _client: unknown,
        _collection: unknown,
        row: RecordRow,
      ) {
        row.term_id = termId;
        if (row.document_type !== "executive-order")
          row.session_id = "date-session";
      },
    },
    "./terms-server": { getTerms: async () => [] },
  };
  const exports = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync("lib/legislative/document-transfer.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      Error,
      FormData,
      TextEncoder,
      require(name: string) {
        if (!(name in dependencies))
          throw new Error(`Unexpected import: ${name}`);
        return dependencies[name];
      },
    },
  );
  return {
    transfer: exports as typeof DocumentTransfer,
    context: {
      client,
      offices: [
        {
          id: officeId,
          active: true,
          archived_at: null,
          department: "legislative",
        },
      ],
    } as unknown as OfficeContext,
    requests,
  };
}

function source(overrides: Partial<DocumentCsvRow> = {}) {
  return parseDocumentCsv(
    serializeDocumentCsv([
      {
        title: "Council document",
        number: "2026-101",
        date: "2026-11-18",
        description: "Approved by the council.",
        committee_id: "term-committee",
        approval_mode: "mass_motion",
        ...overrides,
      },
    ]),
  );
}

async function importError(promise: Promise<unknown>) {
  try {
    await promise;
    throw new Error("Expected the import to be rejected.");
  } catch (error) {
    const failed = error as InstanceType<
      typeof DocumentTransfer.DocumentTransferError
    >;
    return { status: failed.status, errors: Array.from(failed.errors || []) };
  }
}

test("Mass motion imports preserve the mode, resolve the committee/session and carry no officials", async () => {
  for (const type of ["ordinance", "resolution"] as const) {
    const { transfer, context, requests } = transferHarness();
    const rows = await transfer
      .prepareDocumentImport(context, officeId, type, source())
      .catch((error) => {
        throw new Error(`${error.message}: ${JSON.stringify(error.errors)}`);
      });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      approval_mode: "mass_motion",
      author_id: null,
      co_author_id: null,
      committee_id: "term-committee",
      session_id: "date-session",
      term_id: termId,
      published: true,
    });
    expect(requests.some((request) => request.table === "committees")).toBe(
      true,
    );
    expect(requests.some((request) => request.table === "officials")).toBe(
      false,
    );
  }
});

test("older CSV imports default to authored approval and still require an author", async () => {
  const { transfer, context } = transferHarness();
  const old = parseDocumentCsv(
    "title,number,date,description,author_id,committee_id\nOlder ordinance,2026-102,2026-11-18,Body,sb-author,term-committee\n",
  );
  const rows = await transfer
    .prepareDocumentImport(context, officeId, "ordinance", old)
    .catch((error) => {
      throw new Error(`${error.message}: ${JSON.stringify(error.errors)}`);
    });
  expect(rows[0]).toMatchObject({
    approval_mode: "authored",
    author_id: "sb-author",
  });
  expect(
    await importError(
      transfer.prepareDocumentImport(
        context,
        officeId,
        "ordinance",
        source({ approval_mode: "" }),
      ),
    ),
  ).toMatchObject({
    status: 400,
    errors: [expect.stringMatching(/author/i)],
  });
});

test("a conflicting author/co-author or unknown approval rejects the whole import", async () => {
  for (const overrides of [
    { author_id: "sb-author" },
    { co_author_id: "sb-author" },
    { approval_mode: "unknown" },
  ]) {
    const { transfer, context } = transferHarness();
    const invalid = [...source({ number: "2026-100" }), ...source(overrides)];
    expect(
      await importError(
        transfer.prepareDocumentImport(
          context,
          officeId,
          "resolution",
          invalid,
        ),
      ),
    ).toMatchObject({
      status: 400,
      errors: [
        expect.stringMatching(
          /^Record 2: .*author|^Record 2: .*approval|^Record 2: .*motion/i,
        ),
      ],
    });
  }
});

test("approval mode cannot be supplied for agendas, minutes or executive orders", async () => {
  for (const type of ["agenda", "minutes", "executive-order"] as const) {
    const { transfer, context } = transferHarness();
    expect(
      await importError(
        transfer.prepareDocumentImport(
          context,
          officeId,
          type,
          source({
            number: "",
            committee_id: "",
            approval_mode: "mass_motion",
          }),
        ),
      ),
    ).toMatchObject({
      errors: [
        expect.stringContaining("apply only to ordinances and resolutions"),
      ],
    });
  }
});

test("exports request and retain approval mode with empty Mass motion attribution", async () => {
  const { transfer, context, requests } = transferHarness([
    {
      id: "mass-motion-document",
      title: "Council resolution",
      number: "2026-101",
      date_approved: "2026-11-18",
      summary: "Approved by Mass motion.",
      approval_mode: "mass_motion",
      author_id: null,
      co_author_id: null,
      committee_id: "term-committee",
      session_id: "date-session",
      office_id: officeId,
      content_scope: "legislative",
      published: true,
    },
  ]);
  for (const type of ["ordinance", "resolution"] as const) {
    const rows = await transfer.readDocumentExport(context, officeId, type);
    expect(parseDocumentCsv(serializeDocumentCsv(rows))[0]).toMatchObject({
      approval_mode: "mass_motion",
      author_id: "",
      co_author_id: "",
      committee_id: "term-committee",
    });
  }
  expect(
    requests.every((request) => request.columns.includes("approval_mode")),
  ).toBe(true);
});
