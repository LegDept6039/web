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
  searchParams: Promise<{ office?: string }>;
}) {
  const context = await officeContext();
  const collection = collectionName((await params).collection);
  if (!collection || collection === "departments") notFound();
  const office = (await searchParams).office;
  const scope = workflow(context, office);
  if (!available(context, collection, office, "write")) notFound();
  const offices = context.offices.filter(
    (o) => o.department === "executive" && allowed(context, o.id, "write"),
  );
  const superadmin = context.profile.role === "superadmin";
  if (!superadmin && scope === "executive" && !offices.length)
    return <p role="alert">You do not have content editing permissions.</p>;
  if (office && !available(context, collection, office, "write"))
    return <p role="alert">You cannot create content in this office.</p>;
  return (
    <>
      <ContentBreadcrumb
        context={context}
        office={office}
        collection={collection}
      />
      <h1>Add {label(collection).toLowerCase()} record</h1>
      <ContentForm
        collection={collection}
        scope={scope}
        offices={offices}
        superadmin={superadmin}
        row={{ office_id: office || "", published: collection === "contacts" }}
      />
    </>
  );
}
