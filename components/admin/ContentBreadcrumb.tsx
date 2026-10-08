import Link from "next/link";
import type { OfficeContext } from "@/lib/offices/server";
import { workflow } from "@/lib/offices/server";
import { label } from "@/lib/admin/content";
export function ContentBreadcrumb({
  context,
  office,
  collection,
}: {
  context: OfficeContext;
  office?: string;
  collection?: string;
}) {
  const scope = workflow(context, office);
  const selected =
    context.offices.find((o) => o.id === office) ||
    context.offices.find(
      (o) =>
        o.active &&
        o.department === scope &&
        context.access.some((a) => a.office_id === o.id),
    );
  return (
    <nav aria-label="Breadcrumb" className="admin-breadcrumb">
      <Link href="/admin">Admin</Link>
      <span>/</span>
      <span>{label(scope)}</span>
      {selected && (
        <>
          <span>/</span>
          <Link href={`/admin/content?office=${selected.id}`}>
            {selected.short_name}
          </Link>
        </>
      )}
      {collection && (
        <>
          <span>/</span>
          <span>{label(collection)}</span>
        </>
      )}
    </nav>
  );
}
