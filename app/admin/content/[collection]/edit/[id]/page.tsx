import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/server";
import { collectionName } from "@/lib/admin/content";
import { definitions } from "@/lib/content/schema";
import { ContentForm } from "../../../ContentForm";
export default async function EditContent({
  params,
}: {
  params: Promise<{ collection: string; id: string }>;
}) {
  const { client } = await requireStaff(true);
  const { collection: name, id } = await params;
  const collection = collectionName(name);
  if (!collection) notFound();
  const definition = definitions[collection];
  const { data, error } = await client
    .from(definition.table)
    .select("*")
    .eq(definition.key, id)
    .maybeSingle();
  if (error)
    return <p role="alert">Unable to load this record. Please try again.</p>;
  if (!data) notFound();
  return (
    <>
      <h1>Edit record</h1>
      <ContentForm collection={collection} row={data} />
    </>
  );
}
