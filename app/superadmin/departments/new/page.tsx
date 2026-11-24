import { requireStaff } from "@/lib/auth/server";
import { OfficeForm } from "../OfficeForm";
import { departmentParentOptions } from "@/lib/offices/branch-parents";
export default async function NewOffice() {
  const { client } = await requireStaff(true);
  const parents = await departmentParentOptions(client);
  return (
    <>
      <h1>Add department</h1>
      <OfficeForm parents={parents} />
    </>
  );
}
