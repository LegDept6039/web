import Link from "next/link";
import { Eye, Flag, ArrowRight } from "lucide-react";
export function MunicipalIntroduction() {
  return (
    <>
      <section id="our-municipality" className="container section introduction">
        <div className="intro-heading">
          <span className="eyebrow">ONE MUNICIPALITY. ONE COMMUNITY.</span>
          <h2>
            Rooted in our heritage.
            <br />
            Committed to our future.
          </h2>
        </div>
        <div className="intro-copy">
          <p>
            Welcome to Pinamungajan, a coastal community on the western side of
            Cebu. This is your connection to our local government, the people
            who serve, and the work that moves our municipality forward.
          </p>
          <Link className="text-link" href="/services">
            Here to serve you
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="vision-grid">
          <article className="vision-card">
            <div className="vision-icon">
              <Eye size={26} strokeWidth={1.5} />
            </div>
            <div>
              <span className="eyebrow">OUR SHARED DIRECTION</span>
              <h3>A vision for tomorrow</h3>
              <p>
                A progressive, resilient, and inclusive Pinamungajan where every
                community has the opportunity to thrive.
              </p>
              <small>Proposed vision · for municipal review</small>
            </div>
            <span className="card-number">01</span>
          </article>
          <article className="vision-card">
            <div className="vision-icon">
              <Flag size={26} strokeWidth={1.5} />
            </div>
            <div>
              <span className="eyebrow">OUR COMMITMENT</span>
              <h3>A mission to serve</h3>
              <p>
                To deliver responsive public service, uphold transparent
                governance, and work together for sustainable development.
              </p>
              <small>Proposed mission · for municipal review</small>
            </div>
            <span className="card-number">02</span>
          </article>
        </div>
      </section>
    </>
  );
}
