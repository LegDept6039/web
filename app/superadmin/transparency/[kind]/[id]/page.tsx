import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/server";
export default async function Page({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  await requireStaff(true);
  const { kind, id } = await params;
  if (kind !== "categories" && kind !== "documents") notFound();
  redirect(
    (kind === "categories"
      ? "/superadmin/transparency/modules/"
      : "/admin/transparency/reports/") + encodeURIComponent(id),
  );
}
