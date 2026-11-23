import Link from "next/link";
import { requireStaff } from "@/lib/auth/server";
import { loadSKBarangays } from "@/lib/sk/admin";
import { SKProfileForm } from "../SKProfileForm";

export default async function NewSKProfile() {
  const { client } = await requireStaff(true);
  let barangays;
  try {
    barangays = await loadSKBarangays(client);
  } catch {
    return (
      <p role="alert">
        Unable to load barangays. Make sure migration 028 is applied, then
        reload and try again.
      </p>
    );
  }
  return (
    <>
      <h1>Add SK profile</h1>
      {barangays.length ? (
        <SKProfileForm barangays={barangays} />
      ) : (
        <div className="staff-card">
          <p>Add a barangay before creating its SK profile.</p>
          <Link className="button button-blue" href="/superadmin/barangays/new">
            Add barangay
          </Link>
        </div>
      )}
    </>
  );
}
