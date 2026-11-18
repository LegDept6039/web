import { legislativeOptions } from "@/lib/legislative/server";
import {
  usesLegislativeFields,
  isDocumentType,
  isDocumentCollection,
} from "@/lib/legislative/config";
import { DocumentTypeSelector } from "@/components/admin/DocumentTypeSelector";
import { DocumentTransferControls } from "@/components/admin/DocumentTransferControls";
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
  searchParams: Promise<{
    office?: string;
    type?: string;
    master?: string;
    term?: string;
  }>;
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
  const transferControls =
    scope === "legislative" && isDocumentCollection(collection) ? (
      <DocumentTransferControls
        office={office}
        type={
          collection === "ordinances"
            ? "ordinance"
            : collection === "resolutions"
              ? "resolution"
              : type && isDocumentType(type)
                ? type
                : undefined
        }
        offices={context.offices
          .filter(
            (o) =>
              o.active &&
              o.department === "legislative" &&
              allowed(context, o.id, "read"),
          )
          .map((o) => ({
            id: o.id,
            name: o.name,
            writable: allowed(context, o.id, "write"),
          }))}
      />
    ) : null;
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
        <div className="admin-toolbar">
          <h1>Add Document</h1>
          {transferControls}
        </div>
        <DocumentTypeSelector office={office} />
      </>
    );
  const options =
    scope === "legislative" &&
    (usesLegislativeFields(collection) || collection === "officials")
      ? await legislativeOptions(context, office, collection === "committees")
      : undefined;
  const { master, term } = await searchParams;
  if (
    collection === "committees" &&
    master &&
    !options?.masters?.some((m) => m.id === master)
  )
    notFound();
  if (
    collection === "committees" &&
    term &&
    !options?.terms?.some((t) => t.id === term)
  )
    notFound();
  return (
    <>
      <ContentBreadcrumb
        context={context}
        office={office}
        collection={collection}
      />
      {transferControls ? (
        <div className="admin-toolbar">
          <h1>Add {label(collection).toLowerCase()} record</h1>
          {transferControls}
        </div>
      ) : (
        <h1>Add {label(collection).toLowerCase()} record</h1>
      )}
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
          ...(collection === "committees"
            ? { master_id: master || "", term_id: term || "" }
            : {}),
        }}
      />
    </>
  );
}
