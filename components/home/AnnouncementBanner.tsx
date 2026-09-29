import Link from "next/link";
import { Megaphone, ArrowRight } from "lucide-react";
export function AnnouncementBanner() {
  return (
    <>
      <div className="announcement-strip">
        <div className="container">
          <span className="announcement-label">
            <Megaphone size={17} /> BULLETIN
          </span>
          <p>
            Welcome to your municipal information portal.{" "}
            <span className="hidden sm:inline">
              Discover services, public records, and community updates.
            </span>
          </p>
          <Link href="/news">
            Stay informed
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </>
  );
}
