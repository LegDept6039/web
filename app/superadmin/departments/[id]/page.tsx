import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/server";
import { OfficeForm } from "../OfficeForm";
export default async function EditOffice({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireStaff(true);
  const { id } = await params;
  const { data, error } = await client
    .from("departments")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error("Unable to load office");
  if (!data) notFound();
  return (
    <>
      <h1>Edit department</h1>
      <OfficeForm key={data.updated_at} office={data} />
    </>
  );
}
