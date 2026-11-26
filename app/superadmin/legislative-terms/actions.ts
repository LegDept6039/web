"use server";
import { requireStaff } from "@/lib/auth/server";
import { validateTerm } from "@/lib/legislative/terms";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
export async function saveTerm(
  _state: string,
  form: FormData,
): Promise<string> {
  const { client } = await requireStaff(true, true);
  const id = String(form.get("id") || "");
  const row = {
    name: String(form.get("name") || "").trim(),
    start_date: String(form.get("start_date") || ""),
    end_date: String(form.get("end_date") || ""),
  };
  try {
    validateTerm(row.name, row.start_date, row.end_date);
  } catch (e) {
    return (e as Error).message;
  }
  const result = id
    ? await client
        .from("legislative_terms")
        .update(row)
        .eq("id", id)
        .eq("updated_at", String(form.get("updated_at")))
        .select("id")
    : await client.from("legislative_terms").insert(row).select("id");
  if (result.error)
    return result.error.code === "23P01"
      ? "Term dates overlap an existing term. Choose a non-overlapping date range."
      : result.error.code === "23514"
        ? id
          ? "These dates are invalid or exclude linked records. Keep dates covering the assigned records."
          : "Unable to create the term and its committees. Check the dates, Master Committee catalog and Legislative Access office."
        : "Unable to save the term. Check your access and try again.";
  if (!result.data?.length) return "This term changed. Reload before saving.";
  revalidatePath("/", "layout");
  redirect("/superadmin/legislative-terms?saved=1");
}
