import type { OfficeContext } from "@/lib/offices/server";
import { barangayAffairsAllowed } from "./access";

export function barangayAffairsNavigation(
  context: OfficeContext,
  office: string,
) {
  const superadmin = context.profile.role === "superadmin";
  const base = superadmin ? "/superadmin/barangays" : "/admin/barangays";
  if (!barangayAffairsAllowed(context)) return [];
  return [
    {
      key: "overview",
      label: "Overview",
      href: `/admin/content?office=${office}`,
    },
    { key: "barangays", label: "Barangays", href: base },
    ...(superadmin
      ? [
          {
            key: "sk",
            label: "Sangguniang Kabataan (SK)",
            href: "/superadmin/barangays/sk",
          },
        ]
      : []),
    {
      key: "news",
      label: "News",
      href: `/admin/content/news?office=${office}`,
    },
  ];
}
