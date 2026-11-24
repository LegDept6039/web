import { requireStaff } from "@/lib/auth/server";
import { departmentParentOptions } from "@/lib/offices/branch-parents";
import { OfficeForm } from "../../departments/OfficeForm";

export default async function NewBranch() {
  const { client } = await requireStaff(true);
  const parents = await departmentParentOptions(client);
  return (
    <>
      <h1>Add branch</h1>
      <OfficeForm parents={parents} branchMode />
    </>
  );
}
