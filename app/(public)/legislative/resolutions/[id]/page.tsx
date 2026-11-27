import { notFound } from "next/navigation";
import { getResolution } from "@/lib/legislative/resolution-archive-server";
import { parseResolutionReturnTo } from "@/lib/legislative/resolution-archive";
import { DocumentDetail } from "@/components/legislative/DocumentDetail";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getResolution(id);
  return { title: doc?.title ?? "Record not found" };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { id } = await params;
  const [doc, query] = await Promise.all([getResolution(id), searchParams]);
  if (!doc) notFound();
  return (
    <DocumentDetail
      document={doc}
      kind="resolutions"
      backHref={parseResolutionReturnTo(
        typeof query.returnTo === "string" ? query.returnTo : undefined,
      )}
    />
  );
}
