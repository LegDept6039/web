import { legislativeOptions } from "@/lib/legislative/server";
import {
  usesLegislativeFields,
  isDocumentCollection,
} from "@/lib/legislative/config";
import { ContentBreadcrumb } from "@/components/admin/ContentBreadcrumb";
import { notFound, redirect } from "next/navigation";
import { officeContext, contentAllowed } from "@/lib/offices/server";
import { collectionName } from "@/lib/admin/content";
import { definitions } from "@/lib/content/schema";
import { authDiagnostic, errorCode } from "@/lib/auth/diagnostics";
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
  if (error) {
    authDiagnostic(`content_edit:${collection}`, {
      outcome: "query_error",
      code: errorCode(error),
    });
    return <p role="alert">Unable to load record.</p>;
  }
  if (!data || !contentAllowed(context, collection, data, "read")) {
    // Distinguish a hidden/missing row from an application access denial without
    // exposing records, account details or credentials in the browser or logs.
    authDiagnostic(`content_edit:${collection}`, {
      outcome: data ? "access_denied" : "missing_or_not_visible",
      role: context.profile.role,
      membershipCount: context.access.length,
    });
    notFound();
  }
  if (data.content_scope === "transparency")
    redirect(
      `/superadmin/transparency/${collection === "documentCategories" ? "categories" : "documents"}/${id}`,
    );
  const requestedOffice = (await searchParams).office;
  // The record ID is stable across renames. Office is navigation context;
  // authorize the stored owner above before correcting a stale bookmark.
  if (legacyNewsSlug || (requestedOffice || null) !== (data.office_id || null))
    redirect(
      `/admin/content/${collection}/edit/${encodeURIComponent(String(data[definition.key]))}${data.office_id ? `?office=${encodeURIComponent(data.office_id)}` : ""}`,
    );
  if (
    data.content_scope === "legislative" &&
    isDocumentCollection(collection) &&
    !data.published
  )
    return (
      <p role="status">
        This unpublished document is preserved outside the published-document
        workspace.
      </p>
    );
  const options =
    data.content_scope === "legislative" &&
    (usesLegislativeFields(collection) || collection === "officials")
      ? await legislativeOptions(
          context,
          data.office_id,
          collection === "committees",
        )
      : undefined;
  return (
    <>
      <ContentBreadcrumb
        context={context}
        office={(await searchParams).office}
        collection={collection}
      />
      <h1>
        {contentAllowed(context, collection, data, "write") ? "Edit" : "View"}{" "}
        {collection === "departments" ? "department page" : "record"}
      </h1>
      <ContentForm
        key={`${collection}:${data[definition.key]}`}
        collection={collection}
        scope={
          data.content_scope === "legislative" ? "legislative" : "executive"
        }
        row={data}
        legislativeOptions={options}
        offices={context.offices}
        canWrite={contentAllowed(context, collection, data, "write")}
        canDelete={contentAllowed(context, collection, data, "delete")}
        superadmin={context.profile.role === "superadmin"}
      />
    </>
  );
}
