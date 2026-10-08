import { requireStaff } from "@/lib/auth/server";
import { officeContext } from "@/lib/offices/server";
import { UserForm } from "../UserForm";
export default async function NewUser() {
  await requireStaff(true);
  const { offices } = await officeContext();
  return (
    <>
      <h1>Add user</h1>
      <UserForm offices={offices} />
    </>
  );
}
