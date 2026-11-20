import type { DepartmentContact } from "@/types";

export const departmentContactTypes = {
  PHONE: "Phone",
  LANDLINE: "Landline",
  EMAIL: "Email",
  LOCATION: "Location",
  SOCIAL: "Social Link",
} as const satisfies Record<DepartmentContact["type"], string>;

export function isSocialContactUrl(value: string): boolean {
  if (
    value.length > 1000 ||
    !/^https:\/\/[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^\s<>"'\\]*)?$/.test(
      value,
    )
  )
    return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validateSocialContact(value: string, label?: string) {
  if (!label?.trim()) throw new Error("Social link label is required.");
  if (label.length > 100)
    throw new Error("Social link label must be 100 characters or fewer.");
  if (!isSocialContactUrl(value))
    throw new Error(
      "Enter a valid HTTPS social link URL up to 1000 characters.",
    );
}
