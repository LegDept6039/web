import type { DepartmentContact } from "@/types";

export const departmentContactTypes = {
  PHONE: "Phone",
  LANDLINE: "Landline",
  EMAIL: "Email",
  LOCATION: "Location",
  SOCIAL: "Social Link",
} as const satisfies Record<DepartmentContact["type"], string>;

/** Normalize only edited numbers. Public decoders keep legacy stored values. */
export function normalizeContactNumber(type: string, input: string): string {
  if (type !== "PHONE" && type !== "LANDLINE") return input;
  const value = input.trim();
  // Permit familiar pasted formatting, but never discard letters on the server.
  if (!/^\+?[0-9\s().-]+$/.test(value.replace(/^\(\+63\)/, "+63")))
    throw new Error(
      type === "PHONE"
        ? "Enter 10 digits after +63 for the phone number. Letters are not allowed."
        : "Enter a landline number using digits only. Letters are not allowed.",
    );
  const compact = value.replace(/[\s().-]/g, "");
  if (type === "PHONE") {
    const digits = compact.replace(/^\+?63(?=[0-9]{10}$)|^0(?=[0-9]{10}$)/, "");
    if (!/^[0-9]{10}$/.test(digits))
      throw new Error(
        "Enter exactly 10 digits after +63 for the phone number.",
      );
    return `+63${digits}`;
  }
  const digits = compact.replace(/^\+/, "");
  if (!/^[0-9]{1,100}$/.test(digits))
    throw new Error("Enter a landline number using 1 to 100 digits.");
  return digits;
}

/** Convert numeric pasted formats to the digits shown next to the fixed prefix. */
export function contactNumberInput(type: "PHONE" | "LANDLINE", input: string) {
  const digits = input.replace(/[^0-9]/g, "");
  if (type === "LANDLINE") return digits.slice(0, 100);
  return digits.replace(/^63(?=[0-9]{10}$)|^0(?=[0-9]{10}$)/, "").slice(0, 10);
}

export function editableContactNumber(type: string, input: string) {
  if (type !== "PHONE" && type !== "LANDLINE") return input;
  try {
    const normalized = normalizeContactNumber(type, input);
    return type === "PHONE" ? normalized.slice(3) : normalized;
  } catch {
    // Keep an unrecognized legacy value available for correction in the editor.
    return input;
  }
}

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
