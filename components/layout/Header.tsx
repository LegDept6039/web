"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Menu,
  X,
  Search,
  Landmark,
} from "lucide-react";
const branches = {
  Executive: [
    ["Overview", "/executive"],
    ["Municipal Mayor", "/executive/mayor"],
    ["Departments", "/executive/departments"],
    ["Programs & projects", "/executive/programs"],
    ["Activities", "/executive/activities"],
  ],
  Legislative: [
    ["Overview", "/legislative"],
    ["Council members", "/legislative/members"],
    ["Sessions", "/legislative/sessions"],
    ["Ordinances", "/legislative/ordinances"],
    ["Resolutions", "/legislative/resolutions"],
    ["Committees", "/legislative/committees"],
    ["Public hearings", "/legislative/public-hearings"],
  ],
};
export function Header() {
  const pathname = usePathname();
  const [mobile, setMobile] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [date, setDate] = useState("Philippine Standard Time");
  useEffect(() => {
    const refresh = () =>
      setDate(
        new Intl.DateTimeFormat("en-PH", {
          month: "long",
          day: "numeric",
          year: "numeric",
          weekday: "long",
          timeZone: "Asia/Manila",
        }).format(new Date()),
      );
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, []);
  const close = () => {
    setMobile(false);
    setOpen(null);
  };
  return (
    <header
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <div className="government-bar">
        <div className="container flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <Landmark size={13} /> Republic of the Philippines{" "}
            <span className="top-separator">|</span>
            <span className="hidden sm:inline">Province of Cebu</span>
          </span>
          <span>{date}</span>
        </div>
      </div>
      <div className="masthead">
        <div className="container masthead-inner">
          <Link href="/" className="brand" onClick={close}>
            <Image
              src="/images/logos/seal.svg"
              width={65}
              height={65}
              alt="Pinamungajan municipal identity placeholder"
              priority
            />
            <span>
              <span className="brand-eyebrow">MUNICIPALITY OF</span>
              <span className="brand-name">PINAMUNGAJAN</span>
              <span className="brand-tagline">
                Together for a progressive community
              </span>
            </span>
          </Link>
          <div className="masthead-right">
            <span className="small-caps">PUBLIC SERVICE. PUBLIC TRUST.</span>
            <Link href="/contact">
              Get in touch <ArrowUpRight size={15} />
            </Link>
          </div>
          <button
            className="mobile-toggle"
            aria-expanded={mobile}
            aria-controls="main-navigation"
            aria-label={mobile ? "Close navigation" : "Open navigation"}
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      <div className="navigation-shell">
        <nav
          id="main-navigation"
          aria-label="Main navigation"
          className={`container navigation ${mobile ? "is-open" : ""}`}
        >
          <Link
            className={pathname === "/" ? "nav-link active" : "nav-link"}
            href="/"
            onClick={close}
          >
            Home
          </Link>
          {Object.entries(branches).map(([label, links]) => (
            <div className="nav-dropdown" key={label}>
              <button
                className={`nav-link ${pathname.startsWith("/" + label.toLowerCase()) ? "active" : ""}`}
                aria-expanded={open === label}
                aria-controls={`menu-${label}`}
                onClick={() => setOpen(open === label ? null : label)}
              >
                {label}
                <ChevronDown size={14} />
              </button>
              {open === label && (
                <div className="dropdown-menu" id={`menu-${label}`}>
                  {links.map(([name, href]) => (
                    <Link key={href} href={href} onClick={close}>
                      {name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          {[
            ["News & updates", "/news"],
            ["Public services", "/services"],
            ["Transparency", "/transparency"],
            ["Contact", "/contact"],
          ].map(([label, href]) => (
            <Link
              key={href}
              className={`nav-link ${pathname.startsWith(href) ? "active" : ""}`}
              href={href}
              onClick={close}
            >
              {label}
            </Link>
          ))}
          <Link
            className="nav-search"
            href="/search"
            aria-label="Search the website"
            onClick={close}
          >
            <Search size={19} />
            <span className="sm:hidden">Search</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
