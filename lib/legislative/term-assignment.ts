import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Collection } from "@/lib/content/schema";
import { getTerms } from "./terms-server";
import { termForDate } from "./terms";
export async function assignRecordTerm(
  client: SupabaseClient,
  collection: Collection,
  row: Record<string, unknown>,
  form: FormData,
) {
  const terms = await getTerms(client);
  let id: string | undefined;
  if (["officials", "committees"].includes(collection)) {
    id = String(form.get("term_id") || "");
    if (!terms.some((t) => t.id === id))
      throw new Error("Choose a Legislative Term.");
  } else
    id = termForDate(terms, String(row.date_approved || row.date || ""))?.id;
  if (!id)
    throw new Error(
      "No Legislative Term covers this date. Ask Superadmin to create the term first.",
    );
  row.term_id = id;
  if (
    ["ordinances", "resolutions"].includes(collection) ||
    (collection === "documents" &&
      ["agenda", "minutes"].includes(String(row.document_type)))
  ) {
    let query = client
      .from("sessions")
      .select("id")
      .eq("office_id", row.office_id)
      .eq("content_scope", "legislative")
      .eq("term_id", id)
      .eq("date", row.date_approved || row.date);
    if (row.session_id) query = query.eq("id", row.session_id);
    const { data, error } = await query.order("id").limit(2);
    if (error)
      throw new Error("Unable to match the session. Please try again.");
    if (!data?.length)
      throw new Error(
        "No matching session. Choose or create a session held on this document date in the same Legislative office and term.",
      );
    if (data.length > 1)
      throw new Error(
        "Multiple sessions were held on this date. Choose the correct session.",
      );
    row.session_id = data[0].id;
  }
}
