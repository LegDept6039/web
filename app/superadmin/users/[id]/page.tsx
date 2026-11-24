import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/server";
import { officeContext, readOfficeAccess } from "@/lib/offices/server";
import { UserForm } from "../UserForm";
import { PasswordResetForm } from "../PasswordResetForm";
export default async function EditUser({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile } = await requireStaff(true);
  const { client, offices } = await officeContext();
  const { id } = await params;
  const { data: account, error } = await client
    .from("staff_accounts")
    .select(
      "user_id,display_name,username,role,active,deleted_at,created_at,updated_at,transparency_access",
    )
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
      {!account.deleted_at && (
        <PasswordResetForm account={account} isSelf={profile.user_id === id} />
      )}
    </>
  );
}
