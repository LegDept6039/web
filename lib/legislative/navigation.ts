import type { OfficeContext } from "@/lib/offices/server";
import { available } from "@/lib/offices/server";
import type { Collection } from "@/lib/content/schema";
export function legislativeNavigation(context: OfficeContext, office: string) {
  const link = (
    key: string,
    label: string,
    collection: Collection,
    section: string,
    type?: string,
  ) => ({
    key,
    label,
    section,
    href: `/admin/content/${collection}?office=${office}${type ? `&type=${type}` : ""}`,
    collection,
  });
  return [
    link("officials", "Officials", "officials", "OFFICE OVERVIEW"),
    link("committees", "Committees", "committees", "OFFICE OVERVIEW"),
    link("sessions", "Sessions", "sessions", "OFFICE OVERVIEW"),
    link("documents", "Add Document", "documents", "DOCUMENTS"),
    link("ordinances", "Ordinances", "ordinances", "DOCUMENTS"),
    link("resolutions", "Resolutions", "resolutions", "DOCUMENTS"),
    link("minutes", "Minutes", "documents", "DOCUMENTS", "minutes"),
    link("agenda", "Agenda", "documents", "DOCUMENTS", "agenda"),
    link(
      "executive-order",
      "Executive Orders",
      "documents",
      "DOCUMENTS",
      "executive-order",
    ),
  ].filter((m) => available(context, m.collection, office));
}
