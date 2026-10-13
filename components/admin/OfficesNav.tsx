"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
export function OfficesNav({
  offices,
}: {
  offices: {
    id: string;
    name: string;
    modules: { key: string; label: string; href: string }[];
  }[];
}) {
  const pathname = usePathname(),
    params = useSearchParams();
  const selected = params.get("office") || "";
  const route = `${pathname}:${selected}`;
  const [last, setLast] = useState(route),
    [open, setOpen] = useState(selected);
  if (last !== route) {
    setLast(route);
    setOpen(selected);
  }
  return (
    <div className="offices-nav">
      <span className="admin-nav-label">Offices</span>
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
                {o.modules.map((m) => (
                  <Link
                    key={m.key}
                    href={m.href}
                    aria-current={
                      selected === o.id &&
                      pathname.startsWith(`/admin/content/${m.key}`)
                        ? "page"
                        : undefined
                    }
                  >
                    {m.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
