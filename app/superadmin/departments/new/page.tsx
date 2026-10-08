import { requireStaff } from "@/lib/auth/server";
import { OfficeForm } from "../OfficeForm";
export default async function NewOffice() {
  await requireStaff(true);
  return (
    <>
      <h1>Add department</h1>
      <OfficeForm />
    </>
  );
}
