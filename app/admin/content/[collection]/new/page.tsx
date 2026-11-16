import { legislativeOptions } from "@/lib/legislative/server";
import {
  usesLegislativeFields,
  isDocumentType,
} from "@/lib/legislative/config";
import { DocumentTypeSelector } from "@/components/admin/DocumentTypeSelector";
import { ContentBreadcrumb } from "@/components/admin/ContentBreadcrumb";
import { notFound } from "next/navigation";
import {
  officeContext,
  allowed,
  available,
  workflow,
} from "@/lib/offices/server";
import { collectionName, label } from "@/lib/admin/content";
import { ContentForm } from "../../ContentForm";
export default async function NewContent({
  params,
  searchParams,
}: {
  params: Promise<{ collection: string }>;
  searchParams: Promise<{ office?: string; type?: string }>;
}) {
  const context = await officeContext();
  const collection = collectionName((await params).collection);
  if (!collection || collection === "departments") notFound();
  const office = (await searchParams).office;
  const scope = workflow(context, office);
  if (!available(context, collection, office, "write")) notFound();
  const offices = context.offices.filter(
    (o) => o.department === scope && allowed(context, o.id, "write"),
  );
  const superadmin = context.profile.role === "superadmin";
  if (!superadmin && scope === "executive" && !offices.length)
    return <p role="alert">You do not have content editing permissions.</p>;
  if (office && !available(context, collection, office, "write"))
    return <p role="alert">You cannot create content in this office.</p>;
  const type = (await searchParams).type;
  if (
    scope === "legislative" &&
    collection === "documents" &&
    (!type ||
      !isDocumentType(type) ||
      ["ordinance", "resolution"].includes(type))
  )
    return (
      <>
        <ContentBreadcrumb
          context={context}
          office={office}
          collection={collection}
        />
        <h1>Add Document</h1>
        <DocumentTypeSelector office={office} />
      </>
    );
  const options =
    scope === "legislative" && usesLegislativeFields(collection)
      ? await legislativeOptions(context, office)
      : undefined;
  return (
    <>
      <ContentBreadcrumb
        context={context}
        office={office}
        collection={collection}
      />
      <h1>Add {label(collection).toLowerCase()} record</h1>
      <ContentForm
        key={`${collection}:${office || scope}`}
        collection={collection}
        scope={scope}
        offices={offices}
        legislativeOptions={options}
        superadmin={superadmin}
        row={{
          office_id: office || "",
          document_type: type || "",
          published: collection === "contacts",
        }}
      />
    </>
  );
}
