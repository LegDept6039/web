import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/server";
import type { Barangay } from "@/lib/barangays/validation";
import { BarangayForm } from "../BarangayForm";
export default async function EditBarangay({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireStaff(true);
  const id = (await params).id;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    notFound();
  const { data, error } = await client
    .from("barangays")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error)
    return (
      <p role="alert">
        Unable to load this barangay. Please reload and try again.
      </p>
    );
  if (!data) notFound();
  return (
    <>
      <h1>Edit barangay</h1>
      <BarangayForm key={data.updated_at} barangay={data as Barangay} />
    </>
  );
}
