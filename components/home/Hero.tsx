import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin } from "lucide-react";
export function Hero() {
  return (
    <>
      <div className="hero-wrap">
        <section className="hero">
          <Image
            src="/images/municipality/pinamungajan.jpg"
            alt="Pinamungajan landscape, featured by Cebu Provincial Tourism"
            fill
            priority
            sizes="100vw"
            className="hero-image"
          />
          <div className="hero-shade" />
          <div className="container hero-content">
            <span className="hero-location">
              <span /> WESTERN CEBU, PHILIPPINES
            </span>
            <h1>
              <em>Pinamungajan asdasdas asd </em>
              <br />
              Our Pride.
              <br />
              Your Destination
            </h1>
            <p>
              Transparent governance. Responsive leadership.
              <br className="hidden sm:block" /> A progressive community,
              together.
            </p>
            <div className="hero-actions">
              <Link href="#our-municipality" className="button button-gold">
                Explore our municipality
                <ArrowRight size={17} />
              </Link>
              <Link href="/legislative" className="hero-secondary">
                Legislative updates
                <ArrowUpRight size={17} />
              </Link>
            </div>
          </div>
          <div className="hero-caption">
            <MapPin size={14} /> Discover the beauty of Pinamungajan
            <span>Photo: Cebu Provincial Tourism</span>
          </div>
          <div className="hero-side-label">HERITAGE · COMMUNITY · PROGRESS</div>
        </section>
      </div>
    </>
  );
}
