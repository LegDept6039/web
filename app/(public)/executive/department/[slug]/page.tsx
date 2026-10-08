import { permanentRedirect } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  permanentRedirect(`/departments/${(await params).slug}`);
}
