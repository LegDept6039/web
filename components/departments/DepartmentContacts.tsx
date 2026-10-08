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
    <section className="mt-16">
      <h2 className="mb-6">Contact Information</h2>
      <div className="content-grid">
        {Object.entries(types).map(([type, label]) => {
          const records = contacts.filter((c) => c.type === type);
          if (!records.length) return null;
          return (
            <section className="info-card" key={type}>
              <h3>{label}</h3>
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
