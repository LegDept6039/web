import { expect, test } from "@playwright/test";
import { departmentHeadPhotoVisibility } from "../../lib/admin/department-photo-visibility";
import { parseContent } from "../../lib/admin/content";

function departmentForm() {
  const form = new FormData();
  form.set("id", "mayors-office");
  form.set("name", "Mayor's Office");
  form.set("description", "Office information");
  form.set("head_photo", "/images/mayor.webp");
  form.set("image_url", "/images/department.webp");
  return form;
}

test("old office forms retain either saved photo visibility preference", () => {
  const form = departmentForm();
  expect(departmentHeadPhotoVisibility(form)).toBe(true);
  expect(departmentHeadPhotoVisibility(form, true)).toBe(true);
  expect(departmentHeadPhotoVisibility(form, false)).toBe(false);
  // An unsupported checkbox value is not an explicit request to hide it.
  form.set("show_head_photo_on_page", "false");
  expect(departmentHeadPhotoVisibility(form, true)).toBe(true);
});

test("unchecked current forms hide the detail portrait without clearing either image", () => {
  const form = departmentForm();
  form.set("head_photo_visibility_present", "1");
  expect(departmentHeadPhotoVisibility(form, true)).toBe(false);
  expect(parseContent("departments", form)).toMatchObject({
    show_head_photo_on_page: false,
    head_photo: "/images/mayor.webp",
    image_url: "/images/department.webp",
  });
});

test("checking the setting restores detail portrait visibility", () => {
  const form = departmentForm();
  form.set("head_photo_visibility_present", "1");
  form.set("show_head_photo_on_page", "on");
  expect(departmentHeadPhotoVisibility(form, false)).toBe(true);
  expect(parseContent("departments", form).show_head_photo_on_page).toBe(true);
  // Explicit checked input is accepted even from a form without the marker.
  form.delete("head_photo_visibility_present");
  expect(departmentHeadPhotoVisibility(form, false)).toBe(true);
});

test("new and legacy department parsing defaults to showing the portrait", () => {
  expect(parseContent("departments", departmentForm())).toMatchObject({
    show_head_photo_on_page: true,
    head_photo: "/images/mayor.webp",
  });
});
