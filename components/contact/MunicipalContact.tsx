import { MapPin, Phone, Mail, Clock3, Globe } from "lucide-react";
import type { MunicipalContactSettings } from "@/lib/municipal-contact/validation";

export function MunicipalContact({
  contact,
}: {
  contact: MunicipalContactSettings;
}) {
  const telephoneLink = contact.telephone?.replace(/[^\d+*#,;]/g, "");
  return (
    <section
      className="container section municipal-contact-info"
      aria-labelledby="municipal-contact-title"
    >
      <div className={contact.map_embed_url ? "contact-grid" : undefined}>
        <div>
          <h2 id="municipal-contact-title">{contact.municipality_name}</h2>
          <div className="contact-details">
            <div className="contact-item">
              <MapPin size={22} aria-hidden="true" />
              <div>
                <h3>Visit the Municipal Hall</h3>
                <p>{contact.address}</p>
              </div>
            </div>
            {contact.telephone && (
              <div className="contact-item">
                <Phone size={22} aria-hidden="true" />
                <div>
                  <h3>Telephone</h3>
                  <p>
                    {telephoneLink ? (
                      <a href={`tel:${telephoneLink}`}>{contact.telephone}</a>
                    ) : (
                      contact.telephone
                    )}
                  </p>
                </div>
              </div>
            )}
            {contact.email && (
              <div className="contact-item">
                <Mail size={22} aria-hidden="true" />
                <div>
                  <h3>Email</h3>
                  <p>
                    <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  </p>
                </div>
              </div>
            )}
            {contact.office_hours && (
              <div className="contact-item">
                <Clock3 size={22} aria-hidden="true" />
                <div>
                  <h3>Office Hours</h3>
                  <p>{contact.office_hours}</p>
                </div>
              </div>
            )}
            {contact.social_url && (
              <div className="contact-item">
                <Globe size={22} aria-hidden="true" />
                <div>
                  <h3>Social Media</h3>
                  <p>
                    <a
                      href={contact.social_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {contact.social_label || "Visit our social page"}
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        {contact.map_embed_url && (
          <div className="municipal-contact-map-panel">
            <iframe
              className="municipal-contact-map"
              title={`${contact.municipality_name} Location Map`}
              src={contact.map_embed_url}
              width="600"
              height="450"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        )}
      </div>
    </section>
  );
}
