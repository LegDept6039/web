import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHero } from "@/components/shared/ui";
import { BarangayImage } from "@/components/barangays/BarangayImage";
import { getSKProfiles } from "@/lib/sk/server";
import { barangayExcerpt } from "@/lib/barangays/validation";

export const metadata = {
  title: "Sangguniang Kabataan",
  description:
    "Meet the Sangguniang Kabataan chairpersons and learn about youth leadership in Pinamungajan's barangays.",
};

export default async function SKDirectoryPage() {
  let profiles: Awaited<ReturnType<typeof getSKProfiles>> = null;
  let failed = false;
  try {
    profiles = await getSKProfiles();
  } catch {
    failed = true;
  }
  return (
    <>
      <PageHero
        title="Sangguniang Kabataan"
        eyebrow="YOUTH LEADERSHIP IN PINAMUNGAJAN"
        description="Meet our SK chairpersons and learn about the youth councils serving our barangays."
      />
      <section
        className="container section barangay-content"
        aria-label="SK directory"
      >
        <p className="mb-6">
          <Link className="text-link" href="/barangays">
            View barangay directory{" "}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </p>
        {failed ? (
          <p role="alert">
            Unable to load SK information. Please try again later.
          </p>
        ) : profiles?.length ? (
          <div className="barangay-grid">
            {profiles.map((profile) => (
              <article className="barangay-card" key={profile.id}>
                <div className="barangay-card-image">
                  <BarangayImage
                    src={profile.image_url}
                    name={`SK ${profile.barangay.name}`}
                    profileLabel="SK profile"
                  />
                </div>
                <div className="barangay-card-body">
                  <h2>
                    <Link href={`/sk/${profile.slug}`}>
                      SK {profile.barangay.name}
                    </Link>
                  </h2>
                  {profile.chairperson_name.trim() && (
                    <p className="barangay-captain">
                      <span>SK Chairperson</span>
                      {profile.chairperson_name}
                    </p>
                  )}
                  {profile.body.trim() && (
                    <p className="barangay-excerpt">
                      {barangayExcerpt(profile.body)}
                    </p>
                  )}
                  <Link className="text-link" href={`/sk/${profile.slug}`}>
                    View SK profile{" "}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="barangay-empty">
            SK profiles will appear here once they are published.
          </p>
        )}
      </section>
    </>
  );
}
