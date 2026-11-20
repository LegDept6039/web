"use client";

import { useState } from "react";
import { departmentContactTypes } from "@/lib/content/department-contact";

export function DepartmentContactFields({
  row,
}: {
  row: Record<string, unknown>;
}) {
  const [type, setType] = useState(String(row.type || ""));
  const [value, setValue] = useState(String(row.value || ""));
  const [label, setLabel] = useState(String(row.label || ""));
  const social = type === "SOCIAL";
  return (
    <>
      <label>
        Type
        <select
          name="type"
          required
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="">Select...</option>
          {Object.entries(departmentContactTypes).map(([key, caption]) => (
            <option key={key} value={key}>
              {caption}
            </option>
          ))}
        </select>
      </label>
      <label>
        {social ? "Social Link Label" : "Label (optional)"}
        <input
          name="label"
          required={social}
          maxLength={social ? 100 : undefined}
          placeholder={social ? "Official Facebook Page" : undefined}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <label>
        {social ? "Social Link URL" : "Value"}
        <input
          name="value"
          required
          maxLength={1000}
          type={social ? "url" : type === "EMAIL" ? "email" : "text"}
          placeholder={
            social ? "https://www.facebook.com/your-department" : undefined
          }
          aria-describedby={social ? "department-social-link-help" : undefined}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      {social && (
        <p className="staff-note" id="department-social-link-help">
          The label is the clickable text shown on your department page and in
          the Contact directory. Use a full HTTPS link.
        </p>
      )}
    </>
  );
}
