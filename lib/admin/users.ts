import { roles, type Access } from "@/lib/offices/permissions";
export function parseUser(form: FormData) {
  const name = String(form.get("display_name") || "").trim();
  const role = String(form.get("role") || "");
  if (!name || name.length > 120 || !roles.some((r) => r === role))
    throw new Error("Enter a name and valid role.");
  const access: Access[] = form.getAll("office").map((value) => {
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
    name,
    role,
    active: form.get("active") === "on",
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
