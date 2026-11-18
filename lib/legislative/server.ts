import { getTerms } from "./terms-server";
import { getCommitteeMasters } from "./committee-master";
import { philippineDate } from "./terms";
import "server-only";
import type { OfficeContext } from "@/lib/offices/server";
import { allowed } from "@/lib/offices/server";
import type { LegislativeOptions } from "./config";
export async function legislativeOptions(
  context: OfficeContext,
  office?: string,
  includeMasters = false,
): Promise<LegislativeOptions> {
  const id =
    office ||
    context.offices.find(
      (o) =>
        o.active &&
        o.department === "legislative" &&
        allowed(context, o.id, "read"),
    )?.id;
  if (!id || !allowed(context, id, "read"))
    throw new Error("No Legislative office access.");
  const results = await Promise.all(
    ["officials", "committees", "sessions"].map(async (table) => {
      const data: Record<string, unknown>[] = [];
      for (let offset = 0; ;) {
        const result = await context.client
          .from(table)
          .select("*", { count: "exact" })
          .eq("content_scope", "legislative")
          .eq("office_id", id)
          .order(table === "sessions" ? "date" : "id", {
            ascending: table !== "sessions",
          })
          .order("id")
          .range(offset, offset + 499);
        if (result.error)
          throw new Error("Unable to load Legislative selections.");
        data.push(...(result.data || []));
        if (!result.data?.length || data.length >= (result.count ?? Infinity))
          break;
        offset += result.data.length;
      }
      return { data };
    }),
  );
  const selections = Object.fromEntries(
    ["officials", "committees", "sessions"].map((key, i) => [
      key,
      (results[i].data || []).map((r) => ({
        id: String(r.id),
        termId: r.term_id ? String(r.term_id) : undefined,
        legislativeRole: r.legislative_role
          ? String(r.legislative_role)
          : undefined,
        date: r.date ? String(r.date) : undefined,
        name: String(r.name || r.number || r.id),
      })),
    ]),
  ) as unknown as LegislativeOptions;
  return {
    ...selections,
    masters: includeMasters
      ? await getCommitteeMasters(context.client)
      : undefined,
    terms: await getTerms(context.client),
    today: philippineDate(),
  };
}
