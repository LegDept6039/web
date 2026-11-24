import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/server";
import { OfficeForm } from "../OfficeForm";
import { departmentParentOptions } from "@/lib/offices/branch-parents";
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
  if (data.parent_department_id) redirect(`/superadmin/branches/${id}`);
  const parents = await departmentParentOptions(
    client,
    id,
    data.parent_department_id,
  );
  return (
    <>
      <h1>Edit department</h1>
      <OfficeForm
        key={`${id}:${data.updated_at}`}
        office={data}
        parents={parents}
      />
    </>
  );
}
