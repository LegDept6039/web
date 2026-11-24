import { notFound } from "next/navigation";
import {
  requireBarangayAffairs,
  barangayAffairsAllowed,
} from "@/lib/barangays/access";
import type { Barangay } from "@/lib/barangays/validation";
import { BarangayForm } from "@/app/superadmin/barangays/BarangayForm";

export default async function BarangayDetails({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireBarangayAffairs();
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    notFound();
  const { data, error } = await context.client
    .from("barangays")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error)
    return (
      <p role="alert">Unable to load this barangay. Reload and try again.</p>
    );
  if (!data) notFound();
  const canWrite = barangayAffairsAllowed(context, "write");
  return (
    <>
      <h1>{canWrite ? "Edit barangay" : "View barangay"}</h1>
      {!canWrite && (
        <p className="staff-note">Your Barangay Affairs access is read-only.</p>
      )}
      <BarangayForm
        key={data.updated_at}
        barangay={data as Barangay}
        canWrite={canWrite}
        basePath="/admin/barangays"
      />
    </>
  );
}
