import { ContentBreadcrumb } from "@/components/admin/ContentBreadcrumb";
import { notFound, redirect } from "next/navigation";
import { officeContext, contentAllowed } from "@/lib/offices/server";
import { collectionName } from "@/lib/admin/content";
import { definitions } from "@/lib/content/schema";
import { ContentForm } from "../../../ContentForm";
export default async function EditContent({
  params,
  searchParams,
}: {
  searchParams: Promise<{ office?: string }>;
  params: Promise<{ collection: string; id: string }>;
}) {
  const context = await officeContext();
  const { collection: name, id } = await params;
  const collection = collectionName(name);
  if (!collection) notFound();
  const definition = definitions[collection];
  const legacyNewsSlug =
    collection === "news" &&
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
  const { data, error } = await context.client
    .from(definition.table)
    .select("*")
    .eq(
      collection === "departments" && !/^[0-9a-f-]{36}$/i.test(id)
        ? "legacy_profile_id"
        : legacyNewsSlug
          ? "slug"
          : definition.key,
      id,
    )
    .maybeSingle();
  if (error) return <p role="alert">Unable to load record.</p>;
  if (!data || !contentAllowed(context, collection, data, "read")) notFound();
  if (legacyNewsSlug) redirect(`/admin/content/news/edit/${data.id}`);
  return (
    <>
      <ContentBreadcrumb
        context={context}
        office={(await searchParams).office}
        collection={collection}
      />
      <h1>
        {contentAllowed(context, collection, data, "write") ? "Edit" : "View"}{" "}
        record
      </h1>
      <ContentForm
        collection={collection}
        scope={
          data.content_scope === "legislative" ? "legislative" : "executive"
        }
        row={data}
        offices={context.offices}
        canWrite={contentAllowed(context, collection, data, "write")}
        canDelete={contentAllowed(context, collection, data, "delete")}
        superadmin={context.profile.role === "superadmin"}
      />
    </>
  );
}
