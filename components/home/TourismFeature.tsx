import Image from "next/image";
import { Compass, ArrowUpRight } from "lucide-react";
export function TourismFeature() {
  return (
    <>
      <section className="container tourism-section">
        <a
          href="https://tourism.cebu.gov.ph/explore/pinamungajan/"
          target="_blank"
          rel="noreferrer"
          className="tourism-banner"
        >
          <div className="tourism-art">
            <Image
              src="/images/municipality/pinamungajan.jpg"
              fill
              sizes="400px"
              alt="A glimpse of Pinamungajan"
            />
          </div>
          <div className="tourism-copy">
            <span className="eyebrow">
              A PLACE TO EXPLORE. A PLACE TO BELONG.
            </span>
            <h2>Experience Pinamungajan</h2>
            <p>
              Discover our natural beauty, local culture, and warm hospitality.
            </p>
          </div>
          <span className="tourism-cta">
            Explore tourism
            <ArrowUpRight size={20} />
          </span>
          <Compass className="tourism-compass" size={130} strokeWidth={0.6} />
        </a>
      </section>
    </>
  );
}
