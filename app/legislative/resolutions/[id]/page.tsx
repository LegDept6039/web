import { readContentConfig } from "@/lib/content/config";
export const dynamicParams = true;
import { notFound } from "next/navigation";
import { getResolutions } from "@/lib/api";
import { DocumentDetail } from "@/components/legislative/DocumentDetail";
export async function generateStaticParams() {
  if (readContentConfig(process.env).source === "supabase") return [];
  return (await getResolutions()).map((d) => ({ id: d.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = (await getResolutions()).find((d) => d.id === id);
  return { title: doc?.title ?? "Record not found" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = (await getResolutions()).find((d) => d.id === id);
  if (!doc) notFound();
  return <DocumentDetail document={doc} kind="resolutions" />;
}
