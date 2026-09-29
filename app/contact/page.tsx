import type { Metadata } from "next";
import { MapPin, Phone, Mail, Clock3, Globe } from "lucide-react";
import { PageHero, PreviewNote } from "@/components/shared/ui";
export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Contact information for the Municipality of Pinamungajan, Cebu, Philippines.",
};
export default function Page() {
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
    </>
  );
}
