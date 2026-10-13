import { Phone, Mail, MapPin } from "lucide-react";
import type { DepartmentContact } from "@/types";
const types = {
  PHONE: "Phone",
  LANDLINE: "Landline",
  EMAIL: "Email",
  LOCATION: "Location",
} as const;
export function DepartmentContacts({
  contacts,
}: {
  contacts: DepartmentContact[];
}) {
  if (!contacts.length) return null;
  return (
    <section className="department-contacts">
      <h2 className="mb-4">Contact Information</h2>
      <div className="department-contact-grid">
        {Object.entries(types).map(([type, label]) => {
          const records = contacts.filter((c) => c.type === type);
          if (!records.length) return null;
          return (
            <section className="department-contact-group" key={type}>
              <h3>
                {type === "EMAIL" ? (
                  <Mail size={16} />
                ) : type === "LOCATION" ? (
                  <MapPin size={16} />
                ) : (
                  <Phone size={16} />
                )}{" "}
                {label}
              </h3>
              <ul>
                {records.map((c) => (
                  <li key={c.id}>
                    {c.label && <strong>{c.label}: </strong>}
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
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}
