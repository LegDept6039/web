import Link from "next/link";
import { requireStaff } from "@/lib/auth/server";
import type { MunicipalContactSettings } from "@/lib/municipal-contact/validation";
import { ContactForm } from "./ContactForm";

export default async function ContactSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { client } = await requireStaff(true);
  const [{ data, error }, params] = await Promise.all([
    client
      .from("municipal_contact_settings")
      .select(
        "id,municipality_name,address,telephone,email,office_hours,social_label,social_url,map_embed_url,updated_at",
      )
      .eq("id", "municipal")
      .maybeSingle(),
    searchParams,
  ]);
  const missingSetup =
    error?.code === "42P01" || error?.code === "PGRST205" || (!error && !data);

  return (
    <>
      <h1>Municipal Contact</h1>
      <p className="staff-note">
        Manage the municipal contact details and location map shown on the
        public Contact page. Department contacts are managed in each
        department&apos;s workspace.
      </p>
      <p>
        <Link href="/contact">View Contact Page</Link>
      </p>
      {missingSetup ? (
        <div className="staff-card" role="status">
          <h2>Contact Settings Need Setup</h2>
          <p>
            Apply migration 023 after migration 022, then reload this page to
            edit municipal contact details.
          </p>
        </div>
      ) : error || !data ? (
        <p role="alert">
          Unable to load municipal contact details. Please reload this page and
          try again.
        </p>
      ) : (
        <>
          {params.saved === "1" && (
            <p role="status">Municipal contact details saved.</p>
          )}
          <ContactForm
            key={data.updated_at}
            settings={data as MunicipalContactSettings}
          />
        </>
      )}
    </>
  );
}
