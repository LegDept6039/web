import { requireStaff } from "@/lib/auth/server";
import { BarangayForm } from "../BarangayForm";
export default async function NewBarangay() {
  await requireStaff(true);
  return (
    <>
      <h1>Add barangay</h1>
      <BarangayForm />
    </>
  );
}
