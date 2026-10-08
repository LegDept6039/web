import { notFound, redirect } from "next/navigation";
import { officeContext, available } from "@/lib/offices/server";
import { collectionName } from "@/lib/admin/content";
export default async function ModuleShortcut({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const collection = collectionName(
    module === "committeeHearings" ? "hearings" : module,
  );
  const context = await officeContext();
  if (!collection || !available(context, collection)) notFound();
  redirect(`/admin/content/${collection}`);
}
