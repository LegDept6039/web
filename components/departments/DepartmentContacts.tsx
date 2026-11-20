import { Phone, Mail, MapPin, Globe } from "lucide-react";
import type { DepartmentContact } from "@/types";
import {
  departmentContactTypes,
  isSocialContactUrl,
} from "@/lib/content/department-contact";

function contactLabel(label: string | undefined, departmentName?: string) {
  const value = label?.trim() || "";
  const name = departmentName?.trim();
  if (!name) return value;
  const prefix = name
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/['‘’]/g, "['‘’]")
    .replace(/\s+/g, "\\s+");
  return value.replace(
    new RegExp(`^${prefix}(?=$|[\\s:–—-])\\s*[:–—-]?\\s*`, "i"),
    "",
  );
}

export function DepartmentContacts({
  contacts,
  compact = false,
  departmentName,
}: {
  contacts: DepartmentContact[];
  compact?: boolean;
  departmentName?: string;
}) {
  if (!contacts.length) return null;
  const ContactHeading = compact ? "h4" : "h3";
  return (
    <section
      className={`department-contacts${compact ? " department-contacts--compact" : ""}`}
      aria-label={compact ? "Contact information" : undefined}
    >
      {!compact && <h2 className="mb-4">Contact Information</h2>}
      <div className="department-contact-grid">
        {Object.entries(departmentContactTypes).map(([type, label]) => {
          const records = contacts.filter((c) => c.type === type);
          if (!records.length) return null;
          return (
            <section className="department-contact-group" key={type}>
              <ContactHeading title={compact ? label : undefined}>
                {type === "EMAIL" ? (
                  <Mail size={16} aria-hidden="true" />
                ) : type === "SOCIAL" ? (
                  <Globe size={16} aria-hidden="true" />
                ) : type === "LOCATION" ? (
                  <MapPin size={16} aria-hidden="true" />
                ) : (
                  <Phone size={16} aria-hidden="true" />
                )}
                <span className={compact ? "sr-only" : undefined}>{label}</span>
              </ContactHeading>
              <ul>
                {records.map((c) => {
                  if (type === "SOCIAL")
                    return isSocialContactUrl(c.value) && c.label?.trim() ? (
                      <li key={c.id}>
                        <a
                          href={c.value}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {c.label}
                        </a>
                      </li>
                    ) : null;
                  const displayLabel =
                    contactLabel(c.label, departmentName) ||
                    (compact ? label : "");
                  return (
                    <li key={c.id}>
                      {displayLabel && <strong>{displayLabel}: </strong>}
                      {type === "EMAIL" ? (
                        <a href={`mailto:${encodeURIComponent(c.value)}`}>
                          {c.value}
                        </a>
                      ) : type === "PHONE" || type === "LANDLINE" ? (
                        <a href={`tel:${c.value.replace(/[^+0-9]/g, "")}`}>
                          {c.value}
                        </a>
                      ) : (
                        c.value
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}
