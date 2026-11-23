import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/server";
import { loadSKBarangays } from "@/lib/sk/admin";
import type { SKProfile } from "@/lib/sk/validation";
import { SKProfileForm } from "../SKProfileForm";

export default async function EditSKProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireStaff(true);
  const id = (await params).id;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    notFound();
  const { data, error } = await client
    .from("sk_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error)
    return (
      <p role="alert">
        Unable to load this SK profile. Please reload and try again.
      </p>
    );
  if (!data) notFound();
  let barangays;
  try {
    barangays = await loadSKBarangays(client);
  } catch {
    return (
      <p role="alert">Unable to load barangays. Please reload and try again.</p>
    );
  }
  return (
    <>
      <h1>Edit SK profile</h1>
      <SKProfileForm
        key={data.updated_at}
        profile={data as SKProfile}
        barangays={barangays}
      />
    </>
  );
}
