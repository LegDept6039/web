export const roles = ["superadmin", "admin", "editor", "viewer"] as const;
export type Role = (typeof roles)[number];
export type Permission = "viewer" | "editor" | "manager";
export type Operation = "read" | "write" | "delete";
export interface Office {
  archived_at?: string | null;
  id: string;
  name: string;
  short_name: string;
  slug: string;
  department: "executive" | "legislative";
  parent_department_id?: string | null;
  description: string;
  active: boolean;
  updated_at: string;
}
export interface Access {
  office_id: string;
  permission_level: Permission;
}
export function permits(
  role: Role,
  level: Permission | undefined,
  operation: Operation,
): boolean {
  if (role === "superadmin") return true;
  if (!level) return false;
  if (operation === "read") return true;
  if (operation === "write")
    return (
      (role === "admin" || role === "editor") &&
      (level === "editor" || level === "manager")
    );
  return role === "admin" && level === "manager";
}
