"use client";

import { useActionState, useState } from "react";
import type { MunicipalContactSettings } from "@/lib/municipal-contact/validation";
import { saveMunicipalContact } from "./actions";
import {
  contactNumberInput,
  editableContactNumber,
} from "@/lib/content/department-contact";

export function ContactForm({
  settings,
}: {
  settings: MunicipalContactSettings;
}) {
  const [message, action, pending] = useActionState(saveMunicipalContact, "");
  const [values, setValues] = useState({
    municipality_name: settings.municipality_name,
    address: settings.address,
    telephone: editableContactNumber("LANDLINE", settings.telephone || ""),
    email: settings.email || "",
    office_hours: settings.office_hours || "",
    social_label: settings.social_label || "",
    social_url: settings.social_url || "",
    map_embed_url: settings.map_embed_url || "",
  });
  function update(field: keyof typeof values, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  return (
    <form action={action} className="staff-form staff-card">
      <input type="hidden" name="updated_at" value={settings.updated_at} />
      <fieldset disabled={pending}>
        <legend>Municipal Hall</legend>
        <label>
          Municipality Name
          <input
            name="municipality_name"
            required
            maxLength={160}
            value={values.municipality_name}
            onChange={(event) =>
              update("municipality_name", event.target.value)
            }
          />
        </label>
        <label>
          Address
          <textarea
            name="address"
            required
            rows={3}
            maxLength={1000}
            value={values.address}
            onChange={(event) => update("address", event.target.value)}
          />
        </label>
      </fieldset>
      <fieldset disabled={pending}>
        <legend>Contact Details</legend>
        <p className="staff-note">
          Leave optional details blank to hide them from the public Contact
          page.
        </p>
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <label>
            Telephone
            <input
              name="telephone"
              type="tel"
              maxLength={100}
              inputMode="numeric"
              pattern="[0-9]+"
              title="Enter the area code and landline number using digits only."
              value={values.telephone}
              onChange={(event) =>
                update(
                  "telephone",
                  contactNumberInput("LANDLINE", event.target.value),
                )
              }
            />
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              maxLength={254}
              value={values.email}
              onChange={(event) => update("email", event.target.value)}
            />
          </label>
        </div>
        <label>
          Office Hours
          <textarea
            name="office_hours"
            rows={3}
            maxLength={1000}
            value={values.office_hours}
            onChange={(event) => update("office_hours", event.target.value)}
          />
        </label>
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <label>
            Social Link Label
            <input
              name="social_label"
              maxLength={100}
              placeholder="Official Facebook Page"
              value={values.social_label}
              onChange={(event) => update("social_label", event.target.value)}
            />
          </label>
          <label>
            Social Link URL
            <input
              name="social_url"
              type="url"
              maxLength={2048}
              placeholder="https://"
              value={values.social_url}
              onChange={(event) => update("social_url", event.target.value)}
            />
          </label>
        </div>
      </fieldset>
      <fieldset disabled={pending}>
        <legend>Location Map</legend>
        <label>
          Google Maps Embed URL
          <input
            name="map_embed_url"
            type="url"
            maxLength={4096}
            aria-describedby="contact-map-help"
            value={values.map_embed_url}
            onChange={(event) => update("map_embed_url", event.target.value)}
          />
        </label>
        <p id="contact-map-help" className="staff-note">
          In Google Maps, choose Share, then Embed a map. Paste only the URL
          from the iframe&apos;s src value. Leave blank to hide the map.
        </p>
      </fieldset>
      {message && <p role="alert">{message}</p>}
      <button className="button button-blue" disabled={pending}>
        {pending ? "Saving..." : "Save contact details"}
      </button>
    </form>
  );
}
