import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/shared/ui";
import { BarangayImage } from "@/components/barangays/BarangayImage";
import { RichText } from "@/components/shared/RichText";
import { getSKProfiles } from "@/lib/sk/server";
import { barangayExcerpt } from "@/lib/barangays/validation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const profile = (await getSKProfiles((await params).slug))?.[0];
  return {
    title: profile ? `SK ${profile.barangay.name}` : "SK profile not found",
    description: profile?.body.trim()
      ? barangayExcerpt(profile.body)
      : undefined,
  };
}

export default async function SKProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const profile = (await getSKProfiles((await params).slug))?.[0];
  if (!profile) notFound();
  return (
    <>
      <PageHero
        title={`SK ${profile.barangay.name}`}
        eyebrow="SANGGUNIANG KABATAAN"
        description={`Youth leadership in Barangay ${profile.barangay.name}, Pinamungajan.`}
      />
      <section className="container section barangay-content">
        <nav
          className="flex flex-wrap gap-x-8 gap-y-3"
          aria-label="SK profile navigation"
        >
          <Link className="text-link" href="/sk">
            All SK profiles
          </Link>
          <Link
            className="text-link"
            href={`/barangays/${profile.barangay.slug}`}
          >
            View Barangay {profile.barangay.name}
          </Link>
        </nav>
        <div className="barangay-detail">
          <div>
            <BarangayImage
              src={profile.image_url}
              name={`SK ${profile.barangay.name}`}
              profileLabel="SK profile"
            />
            {profile.chairperson_name.trim() && (
              <div className="barangay-leadership">
                <p className="eyebrow">SK CHAIRPERSON</p>
                <h2>{profile.chairperson_name}</h2>
              </div>
            )}
          </div>
          {profile.body.trim() ? (
            <div className="barangay-body">
              <RichText
                document={profile.rich_body || undefined}
                legacy={profile.body}
              />
            </div>
          ) : (
            <p className="barangay-empty">
              More information will be added soon.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
