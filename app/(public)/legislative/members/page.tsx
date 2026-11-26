import { publicTerm } from "@/lib/legislative/terms-server";
import { inTerm, philippineDate, termStatus } from "@/lib/legislative/terms";
import { TermSelector } from "@/components/legislative/TermSelector";
import { isLegislativeRole, legislativeRoles } from "@/lib/officials/roles";
import type { Metadata } from "next";
import { getOfficials } from "@/lib/api";
import { PageHero } from "@/components/shared/ui";
import { OfficialGrid } from "@/components/officials/OfficialGrid";
export const metadata: Metadata = { title: "Sangguniang Bayan members" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const [{ terms, selected }, allOfficials] = await Promise.all([
    publicTerm((await searchParams).term),
    getOfficials(),
  ]);
  const officials = allOfficials.filter(
    (o) => isLegislativeRole(o.legislativeRole) && inTerm(o, selected),
  );
  const today = philippineDate();
  const selectedTerm = terms.find((term) => term.id === selected);
  const isCurrentTerm =
    selectedTerm && termStatus(selectedTerm, today) === "Current";
  return (
    <div className="council-page">
      <PageHero
        title="Your Municipal Council"
        eyebrow="SANGGUNIANG BAYAN"
        description="The Municipal Vice-Mayor, council members, and Secretary to the Sangguniang Bayan serving our community."
      />
      <section
        className="container council-content"
        aria-labelledby="council-directory-title"
      >
        <div className="council-toolbar">
          <div className="council-directory-heading">
            <h2 id="council-directory-title">Council directory</h2>
            <p>
              {officials.length}{" "}
              {officials.length === 1 ? "official" : "officials"} in this
              selection
            </p>
          </div>
          <TermSelector
            terms={terms}
            selected={selected}
            today={today}
            compact
          />
        </div>
        {officials.length ? (
          isCurrentTerm ? (
            <OfficialGrid officials={officials} directory />
          ) : (
            <div className="council-roster">
              <table
                className="council-roster-table"
                aria-labelledby="council-directory-title"
              >
                <thead>
                  <tr>
                    <th scope="col">Official</th>
                    <th scope="col">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {officials.map((official) => (
                    <tr key={official.id}>
                      <th scope="row">
                        <span>{official.name}</span>
                        {official.description && <p>{official.description}</p>}
                      </th>
                      <td>
                        {official.legislativeRole
                          ? legislativeRoles[official.legislativeRole]
                          : official.role}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <p className="council-empty">
            No officials are published for this selection. Choose another
            Legislative Term to browse its roster.
          </p>
        )}
      </section>
    </div>
  );
}
