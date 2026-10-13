import { test, expect } from "@playwright/test";
import { uploadFile } from "../../lib/admin/upload-file";
test("file reader accepts FormData-compatible files across realms and rejects malformed attachments", () => {
  const file = {
    name: "photo.png",
    size: 12,
    type: "image/png",
    arrayBuffer: async () => new ArrayBuffer(12),
  };
  const form = { get: () => file } as unknown as FormData;
  expect(file instanceof File).toBe(false);
  expect(uploadFile(form, "photo")).toBe(file);
  expect(uploadFile(new FormData(), "photo")).toBeNull();
  const bad = new FormData();
  bad.set("photo", "not a file");
  expect(() => uploadFile(bad, "photo")).toThrow("not received");
  bad.set("photo", new File([], "empty.png"));
  expect(uploadFile(bad, "photo")).toBeNull();
});
