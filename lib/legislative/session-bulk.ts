import type { LegislativeTerm } from "./terms";
import { parseLegislative } from "./validation";

export const BULK_SESSION_MAX_ROWS = 50;
export interface BulkSessionInput {
  name: string;
  number: string;
  date: string;
  type: string;
}
export interface BulkSessionResult {
  message: string;
  errors?: { row: number; message: string }[];
}
export class BulkSessionError extends Error {
  constructor(
    message: string,
    public errors?: BulkSessionResult["errors"],
  ) {
    super(message);
  }
}

export function sessionIdentity(row: Record<string, unknown>) {
  return JSON.stringify([
    String(row.number).trim().replace(/\s+/g, " ").toLowerCase(),
    row.date,
    row.type,
  ]);
}

/** Reuse single-session validation; every row must belong to the chosen term. */
export function parseBulkSessions(
  input: unknown,
  term: LegislativeTerm,
  published: boolean,
): Record<string, unknown>[] {
  if (
    !Array.isArray(input) ||
    !input.length ||
    input.length > BULK_SESSION_MAX_ROWS
  )
    throw new BulkSessionError(
      `Enter between 1 and ${BULK_SESSION_MAX_ROWS} sessions.`,
    );
  const errors: NonNullable<BulkSessionResult["errors"]> = [];
  const identities = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  input.forEach((item: unknown, index) => {
    try {
      if (!item || typeof item !== "object" || Array.isArray(item))
        throw new Error("Check the session fields.");
      const fields = item as Record<string, unknown>;
      const form = new FormData();
      for (const key of ["date", "name", "number", "type"]) {
        if (typeof fields[key] !== "string")
          throw new Error(`${key} is required.`);
        form.set(key, fields[key]);
      }
      form.set("published", published ? "on" : "");
      form.set("sort_order", published ? "1" : "0");
      const row = parseLegislative("sessions", form, null);
      if (
        String(row.date) < term.start_date ||
        String(row.date) > term.end_date
      )
        throw new Error(
          `Date must be within the selected term (${term.start_date} to ${term.end_date}).`,
        );
      const identity = sessionIdentity(row);
      if (identities.has(identity))
        throw new Error(
          "This session number, date and type repeat another row.",
        );
      identities.add(identity);
      rows.push({ ...row, term_id: term.id });
    } catch (error) {
      errors.push({
        row: index + 1,
        message:
          error instanceof Error ? error.message : "Check the session fields.",
      });
    }
  });
  if (errors.length)
    throw new BulkSessionError(
      "Check the sessions below. No sessions were added.",
      errors,
    );
  return rows;
}
