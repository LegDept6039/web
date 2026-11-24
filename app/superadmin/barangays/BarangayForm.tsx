"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useActionState, useEffect, useState } from "react";
import { saveBarangay } from "./actions";
import type { Barangay } from "@/lib/barangays/validation";
import { legacyDocument } from "@/lib/content/rich-text";
import { BarangayImage } from "@/components/barangays/BarangayImage";
const RichTextEditor = dynamic(
  () => import("@/components/admin/RichTextEditor"),
  { ssr: false },
);

export function BarangayForm({
  barangay,
  canWrite = true,
  basePath = "/superadmin/barangays",
}: {
  barangay?: Barangay;
  canWrite?: boolean;
  basePath?: "/admin/barangays" | "/superadmin/barangays";
}) {
  const [message, action, pending] = useActionState(saveBarangay, "");
  const [name, setName] = useState(barangay?.name || "");
  const [captain, setCaptain] = useState(barangay?.captain_name || "");
  const [body, setBody] = useState(
    barangay?.rich_body || legacyDocument(barangay?.body || ""),
  );
  const [published, setPublished] = useState(barangay?.published || false);
  const [order, setOrder] = useState(barangay?.sort_order || 0);
  const [preview, setPreview] = useState<string>();
  const [photoError, setPhotoError] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  return (
    <form
      className="staff-form staff-card barangay-admin-form"
      action={action}
      onReset={(event) => event.preventDefault()}
    >
      <input type="hidden" name="id" value={barangay?.id || ""} />
      <input
        type="hidden"
        name="updated_at"
        value={barangay?.updated_at || ""}
      />
      <input type="hidden" name="rich_body" value={JSON.stringify(body)} />
      {message && (
        <p className="staff-error" role="alert">
          {message}
        </p>
      )}
      <fieldset disabled={pending || !canWrite}>
        <legend>Barangay details</legend>
        <label>
          Barangay name
          <input
            name="name"
            required
            maxLength={160}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Barangay captain
          <input
            name="captain_name"
            maxLength={200}
            value={captain}
            onChange={(event) => setCaptain(event.target.value)}
          />
        </label>
        <p className="staff-note">
          Only the barangay name is required. You can add the captain, image and
          body later.
        </p>
        <div className="barangay-admin-image">
          <BarangayImage
            src={preview || (!removeImage ? barangay?.image_url : null)}
            name={name || "Barangay"}
          />
        </div>
        <label>
          Barangay image
          <input
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setPhotoError("");
              if (!file) {
                setPreview(undefined);
                return;
              }
              if (
                file.size > 10 * 1024 * 1024 ||
                !["image/jpeg", "image/png", "image/webp"].includes(file.type)
              ) {
                setPhotoError("Choose a JPEG, PNG, or WebP image up to 10 MB.");
                event.target.value = "";
                setPreview(undefined);
                return;
              }
              setRemoveImage(false);
              setPreview(URL.createObjectURL(file));
            }}
          />
        </label>
        <p className="staff-note">
          Images are cropped to a square (1:1). Keep the main subject near the
          center. JPEG, PNG or WebP, up to 10 MB.
        </p>
        {photoError && (
          <p role="alert" className="staff-error">
            {photoError}
          </p>
        )}
        {barangay?.image_url && (
          <label className="barangay-checkbox">
            <input
              type="checkbox"
              name="remove_image"
              checked={removeImage}
              onChange={(event) => setRemoveImage(event.target.checked)}
            />
            Remove current image
          </label>
        )}
        <div>
          <p>Body</p>
          <RichTextEditor
            label="Body"
            required={false}
            initial={barangay?.rich_body || undefined}
            legacy={barangay?.body || ""}
            disabled={pending || !canWrite}
            onChange={setBody}
          />
        </div>
      </fieldset>
      <fieldset disabled={pending || !canWrite}>
        <legend>Publication</legend>
        <label className="barangay-checkbox">
          <input
            type="checkbox"
            name="published"
            checked={published}
            onChange={(event) => setPublished(event.target.checked)}
          />
          Published
        </label>
        <label>
          Display order
          <input
            name="sort_order"
            type="number"
            min={0}
            max={2147483647}
            step={1}
            value={order}
            onChange={(event) => setOrder(Number(event.target.value))}
          />
        </label>
        <p className="staff-note">
          Lower numbers appear first. Uncheck Published to hide this barangay
          while retaining its content.
        </p>
      </fieldset>
      <div className="staff-actions">
        {canWrite && (
          <button
            className="button button-blue"
            disabled={pending || Boolean(photoError)}
          >
            {pending ? "Saving..." : "Save barangay"}
          </button>
        )}
        <Link className="button" href={basePath}>
          Back to barangays
        </Link>
        {barangay?.published && (
          <Link className="button" href={`/barangays/${barangay.slug}`}>
            View public page
          </Link>
        )}
      </div>
    </form>
  );
}
