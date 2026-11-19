import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Phone, Mail, Clock3, Globe } from "lucide-react";
import { PageHero, PreviewNote } from "@/components/shared/ui";
import { DepartmentContacts } from "@/components/departments/DepartmentContacts";
import { getDepartmentContactDirectory } from "@/lib/api";
export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Contact information for the Municipality of Pinamungajan, Cebu, Philippines.",
};
export default async function Page() {
  const directory = await getDepartmentContactDirectory();
  return (
    <>
      <PageHero
        title="Let’s connect"
        eyebrow="CONTACT YOUR MUNICIPALITY"
        description="We are here to help you find the right office and information."
      />
      <section className="container section">
        <PreviewNote>
          Verified telephone numbers, email addresses, office hours, and social
          channels will be added before public launch.
        </PreviewNote>
        <div className="contact-grid">
          <div>
            <h2>Municipality of Pinamungajan</h2>
            <div className="contact-details">
              <div className="contact-item">
                <MapPin size={22} />
                <div>
                  <h3>Visit the Municipal Hall</h3>
                  <p>
                    Municipal Hall
                    <br />
                    Pinamungajan, Cebu
                    <br />
                    Philippines
                  </p>
                </div>
              </div>
              <div className="contact-item">
                <Phone size={22} />
                <div>
                  <h3>Telephone</h3>
                  <p>Official number to be confirmed</p>
                </div>
              </div>
              <div className="contact-item">
                <Mail size={22} />
                <div>
                  <h3>Email</h3>
                  <p>Official email to be confirmed</p>
                </div>
              </div>
              <div className="contact-item">
                <Clock3 size={22} />
                <div>
                  <h3>Office hours</h3>
                  <p>Schedule to be confirmed with the municipality</p>
                </div>
              </div>
              <div className="contact-item">
                <Globe size={22} />
                <div>
                  <h3>Social media</h3>
                  <p>Verified municipal channels coming soon</p>
                </div>
              </div>
            </div>
          </div>
          <div className="map-placeholder">
            <div>
              <MapPin size={38} />
              <h3>Municipal Hall</h3>
              <p>Pinamungajan, Cebu, Philippines</p>
              <small>
                Location map placeholder
                <br />
                Verified map information coming soon
              </small>
            </div>
          </div>
        </div>
      </section>
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
