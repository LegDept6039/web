import { getCollection } from "@/lib/content/repository";
import { OfficialPhoto } from "@/components/officials/OfficialPhoto";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/shared/ui";
export const metadata: Metadata = { title: "Office of the Municipal Mayor" };
export default async function Page() {
  const [mayor] = await getCollection(
    "officials",
    { branch: "executive", role: "Office of the Municipal Mayor" },
    1,
  );
  return (
    <>
      <PageHero
        title="Office of the Municipal Mayor"
        description="Leadership committed to responsive service and shared progress."
      />
      <section className="container section">
        <article className="mayor-profile" aria-labelledby="mayor-name">
          <div className="official-portrait mayor-profile-photo">
            <OfficialPhoto
              src={mayor?.photoUrl}
              name={mayor?.name || "Municipal Mayor"}
            />
          </div>
          <div className="mayor-profile-information">
            <h2 id="mayor-name">
              {mayor?.name || "Office of the Municipal Mayor"}
            </h2>
            <p className="eyebrow mayor-profile-title">Municipal Mayor</p>
            <p className="mayor-profile-description">
              {mayor?.description ||
                "The mayor?s profile will be published once the official information is available."}
            </p>
            {mayor?.isSample && (
              <p className="meta">Name and portrait to be confirmed.</p>
            )}
            <nav
              className="mayor-profile-links"
              aria-label="Explore Executive services"
            >
              <Link href="/departments" className="text-link">
                View Executive Departments{" "}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/executive/programs" className="text-link">
                Explore programs &amp; projects{" "}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </nav>
          </div>
        </article>
      </section>
    </>
  );
}
