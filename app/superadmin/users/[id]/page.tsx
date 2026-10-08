import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/server";
import { officeContext, readOfficeAccess } from "@/lib/offices/server";
import { UserForm, PasswordResetForm } from "../UserForm";
export default async function EditUser({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff(true);
  const { client, offices } = await officeContext();
  const { id } = await params;
  const { data: account, error } = await client
    .from("staff_accounts")
    .select("*")
    .eq("user_id", id)
    .maybeSingle();
  if (error) throw new Error("Unable to load account");
  if (!account) notFound();
  const access = await readOfficeAccess(client, id);
  return (
    <>
      <h1>Manage account</h1>
      <p>{account.user_id}</p>
      <UserForm
        key={account.updated_at}
        account={account}
        offices={offices}
        access={access || []}
      />
      {!account.deleted_at && <PasswordResetForm id={id} />}
    </>
  );
}
