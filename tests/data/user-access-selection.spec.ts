import { test, expect } from "@playwright/test";
import { parseUser } from "../../lib/admin/users";

const office = "00000000-0000-4000-8000-000000000001";
function form(selections: string[]) {
  const value = new FormData();
  value.set("display_name", "Staff member");
  value.set("username", "staff.member");
  value.set("role", "editor");
  value.set("active", "on");
  selections.forEach((selection) => value.append("office", selection));
  return value;
}

test("Office Access supports Transparency alone and with a department", () => {
  expect(parseUser(form(["transparency"]))).toMatchObject({
    role: "editor",
    transparencyAccess: true,
    access: [],
  });
  expect(parseUser(form([office, "transparency"]))).toMatchObject({
    transparencyAccess: true,
    access: [{ office_id: office, permission_level: "editor" }],
  });
});

test("deselecting Transparency revokes it while preserving selected departments", () => {
  const value = form([office]);
  value.set("transparency_access", "on");
  expect(parseUser(value)).toMatchObject({
    transparencyAccess: false,
    access: [{ office_id: office, permission_level: "editor" }],
  });
  expect(parseUser(form([]))).toMatchObject({
    transparencyAccess: false,
    access: [],
  });
  expect(() => parseUser(form(["transparency", "transparency"]))).toThrow();
  expect(() => parseUser(form(["unknown-scope"]))).toThrow();
});
