import { normalizeContactNumber } from "@/lib/content/department-contact";

export interface MunicipalContactSettings {
  id: "municipal";
  municipality_name: string;
  address: string;
  telephone: string | null;
  email: string | null;
  office_hours: string | null;
  social_label: string | null;
  social_url: string | null;
  map_embed_url: string | null;
  updated_at: string;
}

export type ContactSettingsInput = Omit<
  MunicipalContactSettings,
  "id" | "updated_at"
>;

function text(
  input: Record<string, unknown>,
  key: string,
  label: string,
  max: number,
  required = false,
) {
  const raw = input[key];
  if (raw != null && typeof raw !== "string")
    throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  const value = String(raw ?? "").trim();
  if (required && !value) throw new Error(`${label} is required.`);
  if (value.length > max)
    throw new Error(`${label} must be ${max} characters or fewer.`);
  return value || null;
}

function httpsUrl(value: string, label: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Enter a valid HTTPS ${label}.`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    /[\s<>"'\\]/.test(value)
  )
    throw new Error(`Enter a valid HTTPS ${label}.`);
  return url;
}

export function validateContactSettings(
  input: Record<string, unknown>,
): ContactSettingsInput {
  const municipality_name = text(
    input,
    "municipality_name",
    "Municipality name",
    160,
    true,
  )!;
  const address = text(input, "address", "Address", 1000, true)!;
  const telephone = text(input, "telephone", "Telephone", 100);
  const email = text(input, "email", "Email", 254);
  const office_hours = text(input, "office_hours", "Office hours", 1000);
  const social_label = text(input, "social_label", "Social link label", 100);
  const social_url = text(input, "social_url", "Social link", 2048);
  const map_embed_url = text(
    input,
    "map_embed_url",
    "Google Maps embed URL",
    4096,
  );
  if (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))
    throw new Error("Enter a valid email address.");
  if (social_url) httpsUrl(social_url, "social link");
  if (map_embed_url) {
    const url = httpsUrl(map_embed_url, "Google Maps embed URL");
    if (
      !map_embed_url.startsWith("https://www.google.com/maps/embed?pb=") ||
      url.origin !== "https://www.google.com" ||
      url.pathname !== "/maps/embed" ||
      url.hash ||
      !url.searchParams.get("pb")
    )
      throw new Error(
        "Use the Google Maps embed URL beginning https://www.google.com/maps/embed?pb= (the iframe src, not the HTML).",
      );
  }
  return {
    municipality_name,
    address,
    telephone,
    email,
    office_hours,
    social_label,
    social_url,
    map_embed_url,
  };
}

/** Save validation is stricter than the reader to preserve legacy public data. */
export function validateContactSettingsForSave(
  input: Record<string, unknown>,
): ContactSettingsInput {
  const settings = validateContactSettings(input);
  if (settings.telephone)
    settings.telephone = normalizeContactNumber("LANDLINE", settings.telephone);
  return settings;
}
