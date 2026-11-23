"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useActionState, useEffect, useState } from "react";
import { saveSKProfile } from "./actions";
import type { SKProfile } from "@/lib/sk/validation";
import type { SKBarangayOption } from "@/lib/sk/admin";
import { legacyDocument } from "@/lib/content/rich-text";
import { BarangayImage } from "@/components/barangays/BarangayImage";
const RichTextEditor = dynamic(
  () => import("@/components/admin/RichTextEditor"),
  { ssr: false },
);

export function SKProfileForm({
  profile,
  barangays,
}: {
  profile?: SKProfile;
  barangays: SKBarangayOption[];
}) {
  const [message, action, pending] = useActionState(saveSKProfile, "");
  const [barangayId, setBarangayId] = useState(profile?.barangay_id || "");
  const [chairperson, setChairperson] = useState(
    profile?.chairperson_name || "",
  );
  const [body, setBody] = useState(
    profile?.rich_body || legacyDocument(profile?.body || ""),
  );
  const [published, setPublished] = useState(profile?.published || false);
  const [order, setOrder] = useState(profile?.sort_order || 0);
  const [preview, setPreview] = useState<string>();
  const [photoError, setPhotoError] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const selected = barangays.find((barangay) => barangay.id === barangayId);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  return (
    <form
      className="staff-form staff-card barangay-admin-form sk-admin-form"
      action={action}
      onReset={(event) => event.preventDefault()}
    >
      <input type="hidden" name="id" value={profile?.id || ""} />
      <input
        type="hidden"
        name="updated_at"
        value={profile?.updated_at || ""}
      />
      <input type="hidden" name="rich_body" value={JSON.stringify(body)} />
      {message && (
        <p className="staff-error" role="alert">
          {message}
        </p>
      )}
      <fieldset disabled={pending}>
        <legend>SK details</legend>
        <label>
          Barangay
          <select
            name="barangay_id"
            required
            value={barangayId}
            onChange={(event) => setBarangayId(event.target.value)}
          >
            <option value="">Choose a barangay</option>
            {barangays.map((barangay) => (
              <option key={barangay.id} value={barangay.id}>
                {barangay.name}
                {barangay.published ? "" : " (draft)"}
              </option>
            ))}
          </select>
        </label>
        <p className="staff-note">
          Each barangay has one SK profile. Publish the barangay before
          publishing its SK profile. The chairperson, image and body can be
          added later.
        </p>
        <label>
          SK chairperson
          <input
            name="chairperson_name"
            maxLength={200}
            value={chairperson}
            onChange={(event) => setChairperson(event.target.value)}
          />
        </label>
        <div className="barangay-admin-image">
          <BarangayImage
            src={preview || (!removeImage ? profile?.image_url : null)}
            name={selected ? `SK ${selected.name}` : "SK"}
            profileLabel="SK profile"
          />
        </div>
        <label>
          SK image
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
        {profile?.image_url && (
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
            initial={profile?.rich_body || undefined}
            legacy={profile?.body || ""}
            disabled={pending}
            onChange={setBody}
          />
        </div>
      </fieldset>
      <fieldset disabled={pending}>
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
          Lower numbers appear first. Uncheck Published to hide this SK profile
          while retaining its content.
        </p>
      </fieldset>
      <div className="staff-actions">
        <button
          className="button button-blue"
          disabled={pending || Boolean(photoError)}
        >
          {pending ? "Saving..." : "Save SK profile"}
        </button>
        <Link className="button" href="/superadmin/barangays/sk">
          Back to SK profiles
        </Link>
        {profile?.published &&
          barangays.some(
            (barangay) =>
              barangay.id === profile.barangay_id && barangay.published,
          ) && (
            <Link className="button" href={`/sk/${profile.slug}`}>
              View public page
            </Link>
          )}
      </div>
    </form>
  );
}
