import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/shared/ui";
import { DepartmentContacts } from "@/components/departments/DepartmentContacts";
import { getDepartmentContactDirectory } from "@/lib/api";
import { MunicipalContact } from "@/components/contact/MunicipalContact";
import { getMunicipalContact } from "@/lib/municipal-contact/server";
export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Contact information for the Municipality of Pinamungajan, Cebu, Philippines.",
};
export default async function Page() {
  const [contact, directory] = await Promise.all([
    getMunicipalContact(),
    getDepartmentContactDirectory(),
  ]);
  return (
    <>
      <PageHero
        title="Let’s connect"
        eyebrow="CONTACT YOUR MUNICIPALITY"
        description="We are here to help you find the right office and information."
      />
      {contact ? (
        <MunicipalContact contact={contact} />
      ) : (
        <section className="container section">
          <p>Municipal contact information will be available soon.</p>
        </section>
      )}
      {directory.length > 0 && (
        <section
          className="container department-contact-directory"
          aria-labelledby="department-contact-directory-title"
        >
          <div className="section-heading">
            <div>
              <h2 id="department-contact-directory-title">
                Department Contacts
              </h2>
              <p>Contact the office responsible for the service you need.</p>
            </div>
          </div>
          <div className="department-contact-directory-grid">
            {directory.map(({ department, contacts }) => (
              <article
                className="department-contact-card"
                key={department.id}
                aria-labelledby={`contact-department-${department.id}`}
              >
                {department.acronym && (
                  <span className="eyebrow">{department.acronym}</span>
                )}
                <h3 id={`contact-department-${department.id}`}>
                  <Link
                    href={`/departments/${department.slug || department.id}`}
                  >
                    {department.name}
                  </Link>
                </h3>
                <DepartmentContacts
                  contacts={contacts}
                  departmentName={department.name}
                  compact
                />
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
