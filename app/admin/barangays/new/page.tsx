import { requireBarangayAffairs } from "@/lib/barangays/access";
import { BarangayForm } from "@/app/superadmin/barangays/BarangayForm";

export default async function NewBarangay() {
  await requireBarangayAffairs(true);
  return (
    <>
      <h1>Add barangay</h1>
      <BarangayForm basePath="/admin/barangays" />
    </>
  );
}
