import Link from "next/link";
import { notFound } from "next/navigation";
import {
  requireTransparency,
  transparencyRows,
} from "@/lib/transparency/server";
import { TransparencyForm } from "@/app/superadmin/transparency/TransparencyForm";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireTransparency(false, true);
  const { id } = await params;
  const modules = await transparencyRows(client, "document_categories");
  let row;
  if (id !== "new") {
    const { data, error } = await client
      .from("municipal_documents")
      .select("*")
      .eq("id", id)
      .eq("content_scope", "transparency")
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error("Unable to load report.");
    if (!data) notFound();
    row = data;
  }
  return (
    <div className="transparency-workspace">
      <Link href="/admin/transparency">Reports & documents</Link>
      <h1>{id === "new" ? "Add document" : "Edit report"}</h1>
      <TransparencyForm
        kind="documents"
        row={row}
        categories={modules.map((m) => ({
          id: String(m.id),
          name: String(m.name),
          published: !!m.published,
        }))}
        currentYear={new Date().getUTCFullYear()}
      />
    </div>
  );
}
