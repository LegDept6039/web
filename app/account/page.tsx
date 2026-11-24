import { officeContext } from "@/lib/offices/server";
import { PasswordForm } from "./PasswordForm";
export const metadata = {
  title: "Staff profile",
  robots: { index: false, follow: false },
};
export default async function Account() {
  const context = await officeContext();
  const { profile, offices, access } = context;
  return (
    <div className="staff-card">
      <h1>Your profile</h1>
      <p>{profile.display_name}</p>
      <p>Username: {profile.username}</p>
      <p>
        Role: <strong>{profile.role}</strong>
      </p>
      <h2>Office access</h2>
      {profile.role === "superadmin" ? (
        <p>All offices and all content.</p>
      ) : (
        <ul>
          {offices.map((o) => (
            <li key={o.id}>
              {o.name}:{" "}
              {access.find((a) => a.office_id === o.id)?.permission_level}
            </li>
          ))}
        </ul>
      )}
      <PasswordForm />
    </div>
  );
}
