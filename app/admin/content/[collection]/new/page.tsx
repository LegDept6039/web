import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/server";
import { collectionName, label } from "@/lib/admin/content";
import { ContentForm } from "../../ContentForm";
export default async function NewContent({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  await requireStaff(true);
  const collection = collectionName((await params).collection);
  if (!collection) notFound();
  return (
    <>
      <h1>Add {label(collection).toLowerCase()} record</h1>
      <p>Save as a draft or check Published to make this record visible.</p>
      <ContentForm collection={collection} />
    </>
  );
}
