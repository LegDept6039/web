"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";
export function OfficesNav({
  offices,
  label = "Offices",
}: {
  label?: string;
  offices: {
    id: string;
    name: string;
    routePrefix?: string;
    modules: { key: string; label: string; href: string; section?: string }[];
  }[];
}) {
  const pathname = usePathname(),
    params = useSearchParams();
  const selected =
    offices.find(
      (office) =>
        office.routePrefix &&
        (pathname === office.routePrefix ||
          pathname.startsWith(office.routePrefix + "/")),
    )?.id ||
    params.get("office") ||
    "";
  const route = `${pathname}:${selected}`;
  const [last, setLast] = useState(route),
    [open, setOpen] = useState(selected);
  if (last !== route) {
    setLast(route);
    setOpen(selected);
  }
  if (!offices.length) return null;
  return (
    <div className="offices-nav">
      {label && <span className="admin-nav-label">{label}</span>}
      <div className="offices-scroll">
        {offices.map((o) => (
          <div key={o.id} className="office-nav-item">
            <button
              type="button"
              aria-expanded={open === o.id}
              aria-controls={`office-${o.id}`}
              className={
                selected === o.id ? "office-toggle is-active" : "office-toggle"
              }
              onClick={() => setOpen(open === o.id ? "" : o.id)}
            >
              <span>{o.name}</span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            {open === o.id && (
              <div className="admin-module-links" id={`office-${o.id}`}>
                {o.modules.map((m, i) => (
                  <Fragment key={m.key}>
                    {m.section && m.section !== o.modules[i - 1]?.section && (
                      <span className="office-section-label">{m.section}</span>
                    )}
                    <Link
                      key={m.key}
                      href={m.href}
                      aria-current={
                        selected === o.id &&
                        !o.modules.some(
                          (other) =>
                            other.href.split("?")[0].length >
                              m.href.split("?")[0].length &&
                            (pathname === other.href.split("?")[0] ||
                              pathname.startsWith(
                                other.href.split("?")[0] + "/",
                              )),
                        ) &&
                        (pathname === m.href.split("?")[0] ||
                          (m.key !== "overview" &&
                            pathname.startsWith(m.href.split("?")[0] + "/"))) &&
                        (new URLSearchParams(m.href.split("?")[1]).get(
                          "type",
                        ) || "") === (params.get("type") || "")
                          ? "page"
                          : undefined
                      }
                    >
                      {m.label}
                    </Link>
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
