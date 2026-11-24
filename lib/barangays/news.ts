import type { SupabaseConfig } from "@/lib/content/config";
import {
  readSupabaseCollection,
  type ContentFetch,
} from "@/lib/content/supabase";

export interface BarangayNewsOption {
  id: string;
  name: string;
  published: boolean;
}

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

/** The owning office decides whether an article may link to a barangay. */
export async function validateNewsBarangay(
  input: FormDataEntryValue | null,
  barangayAffairs: boolean,
  find: (id: string) => Promise<{ id: string } | null>,
): Promise<string | null> {
  const id = typeof input === "string" ? input.trim() : "";
  if (!barangayAffairs) {
    if (id) throw new Error("Barangay news must belong to Barangay Affairs.");
    return null;
  }
  if (!uuid.test(id))
    throw new Error("Choose a barangay for this news article.");
  const barangay = await find(id);
  if (!barangay || barangay.id !== id)
    throw new Error("Choose an existing barangay for this news article.");
  return id;
}

/** Read only published news for this published barangay, retaining its source. */
export async function readBarangayNews(
  config: SupabaseConfig,
  barangayId: string,
  request: ContentFetch = fetch,
) {
  if (!uuid.test(barangayId)) throw new Error("Invalid barangay.");
  const checkedRequest: ContentFetch = async (url, init) => {
    const query = new URL(url);
    query.searchParams.set(
      "select",
      `${query.searchParams.get("select")},published`,
    );
    const response = await request(query.toString(), init);
    if (response.ok) {
      const rows: unknown = await response.clone().json();
      if (
        !Array.isArray(rows) ||
        rows.some(
          (row) =>
            !row ||
            row.barangay_id !== barangayId ||
            row.content_scope !== "executive" ||
            row.published !== true,
        )
      )
        throw new Error("Invalid barangay news response.");
    }
    return response;
  };
  return readSupabaseCollection("news", config, checkedRequest, {
    barangay_id: barangayId,
    content_scope: "executive",
  });
}
