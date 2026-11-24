import { redirect } from "next/navigation";
import { authenticatedStaffState } from "@/lib/auth/server";
import {
  hasResetProof,
  resetIsExpired,
  RESET_EXPIRED_MESSAGE,
} from "@/lib/auth/password-reset";
import { logout } from "@/app/login/actions";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function Page() {
  const staff = await authenticatedStaffState();
  if (!staff) redirect("/login");
  const { passwordStatus: status, user, client } = staff;
  if (!status.required) redirect("/login");
  const { data: profile } = await client
    .from("staff_accounts")
    .select("active,deleted_at,username")
    .eq("user_id", user.id)
    .maybeSingle();
  const expired = resetIsExpired(status.expires_at);
  const enabled = profile?.active && !profile.deleted_at;
  const allowed =
    enabled &&
    !expired &&
    status.state === "pending" &&
    (await hasResetProof(user.id, status));
  return (
    <section className="section container">
      <div className="staff-login staff-card">
        <p className="eyebrow">Municipality of Pinamungajan</p>
        <h1>Create a new password</h1>
        {allowed ? (
          <ChangePasswordForm
            username={profile.username}
            expiresAt={status.expires_at || undefined}
          />
        ) : (
          <>
            <p role="alert">
              {!enabled
                ? "Your staff account is inactive or removed. Contact the Superadmin."
                : expired
                  ? RESET_EXPIRED_MESSAGE
                  : status.state === "pending"
                    ? "Sign out and sign in using the latest temporary password provided by the Superadmin."
                    : "This password operation could not be completed. Contact the Superadmin for assistance."}
            </p>
            <form action={logout}>
              <button className="button button-blue" type="submit">
                Sign out
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
