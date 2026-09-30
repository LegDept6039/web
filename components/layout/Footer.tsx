import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, MapPin, Landmark } from "lucide-react";
export function Footer() {
  return (
    <footer>
      <div className="container footer-grid">
        <div className="footer-brand">
          <div className="brand">
            <Image
              src="/images/logos/seal.png"
              width={60}
              height={60}
              alt="Municipal identity placeholder"
            />
            <span>
              <span className="brand-eyebrow">MUNICIPALITY OF</span>
              <span className="brand-name">PINAMUNGAJAN</span>
              <span className="brand-tagline">
                Province of Cebu, Philippines
              </span>
            </span>
          </div>
          <p>
            A community rooted in heritage.
            <br />A government committed to service.
          </p>
          <p className="flex items-center gap-2">
            <MapPin size={15} /> Municipal Hall, Pinamungajan, Cebu
          </p>
        </div>
        <div>
          <h3>Explore the municipality</h3>
          {[
            ["Executive", "/executive"],
            ["Legislative", "/legislative"],
            ["News & updates", "/news"],
            ["Public services", "/services"],
          ].map(([n, h]) => (
            <Link href={h} key={h}>
              {n}
            </Link>
          ))}
        </div>
        <div>
          <h3>Public information</h3>
          {[
            ["Transparency", "/transparency"],
            ["Ordinances", "/legislative/ordinances"],
            ["Resolutions", "/legislative/resolutions"],
            ["Contact us", "/contact"],
          ].map(([n, h]) => (
            <Link href={h} key={h}>
              {n}
            </Link>
          ))}
        </div>
        <div>
          <h3>Government links</h3>
          {[
            ["Republic of the Philippines", "https://www.gov.ph/"],
            ["Official Gazette", "https://www.officialgazette.gov.ph/"],
            ["DILG", "https://www.dilg.gov.ph/"],
            ["Province of Cebu", "https://www.cebu.gov.ph/"],
          ].map(([n, h]) => (
            <a href={h} target="_blank" rel="noreferrer" key={h}>
              {n}
              <ArrowUpRight size={13} />
            </a>
          ))}
          <span className="social-placeholder">
            Official social channels coming soon
          </span>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} Municipality of Pinamungajan. All rights
          reserved.
        </span>
        <span className="flex items-center gap-2">
          <Landmark size={14} /> Municipal Government Website · Development
          preview
        </span>
      </div>
    </footer>
  );
}
