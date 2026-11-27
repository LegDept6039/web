"use client";

import { useId, useState } from "react";
import {
  contactNumberInput,
  departmentContactTypes,
  editableContactNumber,
} from "@/lib/content/department-contact";
import styles from "./DepartmentContactFields.module.css";

export function DepartmentContactFields({
  row,
}: {
  row: Record<string, unknown>;
}) {
  const [type, setType] = useState(String(row.type || ""));
  const [value, setValue] = useState(
    editableContactNumber(String(row.type || ""), String(row.value || "")),
  );
  const [label, setLabel] = useState(String(row.label || ""));
  const social = type === "SOCIAL";
  const phone = type === "PHONE";
  const landline = type === "LANDLINE";
  const helpId = useId();
  return (
    <>
      <label>
        Type
        <select
          name="type"
          required
          value={type}
          onChange={(event) => {
            const nextType = event.target.value;
            setType(nextType);
            // Do not carry an email, address or another kind of number into a
            // newly selected contact type.
            if (nextType !== type) setValue("");
          }}
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
        <span className={phone ? styles.phone : undefined}>
          {phone && (
            <span className={styles.prefix} aria-hidden="true">
              (+63)
            </span>
          )}
          <input
            name="value"
            aria-label={social ? "Social Link URL" : "Value"}
            required
            maxLength={phone ? 32 : landline ? 100 : 1000}
            minLength={phone ? 10 : undefined}
            pattern={phone ? "[0-9]{10}" : landline ? "[0-9]+" : undefined}
            inputMode={phone || landline ? "numeric" : undefined}
            title={
              phone
                ? "Enter exactly 10 digits after +63."
                : landline
                  ? "Enter digits only."
                  : undefined
            }
            type={
              social
                ? "url"
                : type === "EMAIL"
                  ? "email"
                  : phone || landline
                    ? "tel"
                    : "text"
            }
            placeholder={
              social
                ? "https://www.facebook.com/your-department"
                : phone
                  ? "9171234567"
                  : undefined
            }
            aria-describedby={social || phone || landline ? helpId : undefined}
            value={value}
            onChange={(event) =>
              setValue(
                phone || landline
                  ? contactNumberInput(
                      type as "PHONE" | "LANDLINE",
                      event.target.value,
                    )
                  : event.target.value,
              )
            }
          />
        </span>
      </label>
      {(phone || landline) && (
        <p className="staff-note" id={helpId}>
          {phone
            ? "Enter 10 digits after the fixed +63 country code. You can paste a Philippine phone number beginning +63 or 0."
            : "Enter the area code and landline number using digits only."}
        </p>
      )}
      {social && (
        <p className="staff-note" id={helpId}>
          The label is the clickable text shown on your department page and in
          the Contact directory. Use a full HTTPS link.
        </p>
      )}
    </>
  );
}
