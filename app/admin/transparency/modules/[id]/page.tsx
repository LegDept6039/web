import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTransparency } from "@/lib/transparency/server";
import { TransparencyForm } from "@/app/superadmin/transparency/TransparencyForm";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireTransparency(false, true);
  const { id } = await params;
  let row;
  if (id !== "new") {
    const { data, error } = await client
      .from("document_categories")
      .select("*")
      .eq("id", id)
      .eq("content_scope", "transparency")
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error("Unable to load module.");
    if (!data) notFound();
    row = data;
  }
  return (
    <div className="transparency-workspace">
      <Link href="/admin/transparency/modules">Modules</Link>
      <h1>{id === "new" ? "Add module" : "Edit module"}</h1>
      <TransparencyForm
        kind="categories"
        row={row}
        categories={[]}
        currentYear={new Date().getUTCFullYear()}
      />
    </div>
  );
}
