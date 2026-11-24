import { roles, type Access } from "@/lib/offices/permissions";
import { normalizeUsername } from "@/lib/auth/username";
export function parseUser(form: FormData) {
  const username = normalizeUsername(form.get("username"));
  const name = String(form.get("display_name") || "").trim();
  const role = String(form.get("role") || "");
  if (!name || name.length > 120 || !roles.some((r) => r === role))
    throw new Error("Enter a name and valid role.");
  const selections = form.getAll("office").map(String);
  if (new Set(selections).size !== selections.length)
    throw new Error("Duplicate office assignments.");
  const access: Access[] = selections
    .filter((value) => value !== "transparency")
    .map((value) => {
      const office = String(value);
      const level = String(
        form.get(`permission:${office}`) ||
          (role === "admin" || role === "superadmin"
            ? "manager"
            : role === "editor"
              ? "editor"
              : "viewer"),
      );
      if (
        !/^[0-9a-f-]{36}$/i.test(office) ||
        !["viewer", "editor", "manager"].includes(level)
      )
        throw new Error("Invalid office permissions.");
      return {
        office_id: office,
        permission_level: level as Access["permission_level"],
      };
    });
  if (new Set(access.map((a) => a.office_id)).size !== access.length)
    throw new Error("Duplicate office assignments.");
  return {
    username,
    name,
    role,
    active: form.get("active") === "on",
    transparencyAccess: selections.includes("transparency"),
    access,
  };
}
export function passwordInput(form: FormData) {
  const password = String(form.get("password") || "");
  if (password.length < 12 || password.length > 128)
    throw new Error("Use a password with 12 to 128 characters.");
  if (password !== form.get("confirm_password"))
    throw new Error("Passwords do not match.");
  return password;
}
