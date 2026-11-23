"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { officeContext, contentAllowed } from "@/lib/offices/server";
import { getTerms } from "@/lib/legislative/terms-server";
import {
  BulkSessionError,
  parseBulkSessions,
  sessionIdentity,
  type BulkSessionResult,
} from "@/lib/legislative/session-bulk";

export async function addBulkSessions(
  _state: BulkSessionResult,
  form: FormData,
): Promise<BulkSessionResult> {
  const context = await officeContext(true);
  const officeId = String(form.get("office_id") || "");
  const termId = String(form.get("term_id") || "");
  let count: number;
  try {
    const office = context.offices.find((o) => o.id === officeId);
    if (
      !office?.active ||
      office.archived_at ||
      office.department !== "legislative" ||
      !contentAllowed(
        context,
        "sessions",
        {
          office_id: officeId,
          content_scope: "legislative",
        },
        "write",
      )
    )
      throw new BulkSessionError(
        "You do not have editing access to this Legislative office.",
      );
    const terms = await getTerms(context.client);
    const term = terms.find((t) => t.id === termId);
    if (!term)
      throw new BulkSessionError("Choose an existing Legislative Term.");
    const raw = String(form.get("sessions") || "");
    if (!raw || raw.length > 200000)
      throw new BulkSessionError(
        "The batch is empty or too large. Use a smaller batch.",
      );
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      throw new BulkSessionError("Check the session rows and try again.");
    }
    const rows: Record<string, unknown>[] = parseBulkSessions(
      input,
      term,
      form.get("published") === "on",
    ).map((row) => ({
      ...row,
      office_id: officeId,
      content_scope: "legislative",
    }));
    const existing = new Set<string>();
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await context.client
        .from("sessions")
        .select("id,number,date,type")
        .eq("office_id", officeId)
        .eq("content_scope", "legislative")
        .eq("term_id", termId)
        .in("date", [...new Set(rows.map((row) => String(row.date)))])
        .order("id")
        .range(offset, offset + 499);
      if (error)
        throw new BulkSessionError(
          "Unable to check existing sessions. No sessions were added.",
        );
      for (const row of data || []) existing.add(sessionIdentity(row));
      if (!data || data.length < 500) break;
    }
    const duplicates = rows.flatMap((row, index) =>
      existing.has(sessionIdentity(row))
        ? [
            {
              row: index + 1,
              message:
                "A session with this number, date and type already exists in this term.",
            },
          ]
        : [],
    );
    if (duplicates.length)
      throw new BulkSessionError(
        "Check the sessions below. No sessions were added.",
        duplicates,
      );
    // One statement keeps validation, RLS and trigger failures atomic.
    const { error } = await context.client.from("sessions").insert(rows);
    if (error) {
      if (error.code === "42501")
        throw new BulkSessionError(
          "Your editing access changed. No sessions were added. Reload and try again.",
        );
      if (["23503", "23505", "23514", "40001", "40P01"].includes(error.code))
        throw new BulkSessionError(
          "The sessions or terms changed. No sessions were added. Reload and check the batch.",
        );
      throw new BulkSessionError(
        "Could not confirm the save. Check the session list before retrying to avoid duplicates.",
      );
    }
    count = rows.length;
  } catch (error) {
    if (error instanceof BulkSessionError)
      return {
        message: error.message,
        ...(error.errors ? { errors: error.errors } : {}),
      };
    return {
      message:
        "Could not confirm the save. Check the session list before retrying to avoid duplicates.",
    };
  }
  revalidatePath("/", "layout");
  redirect(
    `/admin/content/sessions?${new URLSearchParams({ office: officeId, term: termId, created: String(count) })}`,
  );
}
