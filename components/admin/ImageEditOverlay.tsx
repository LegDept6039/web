"use client";
import Image from "next/image";
import { Camera, UserRound, ImageIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
export function ImageEditOverlay({
  name,
  removeName,
  current,
  label,
  portrait = false,
  editable = true,
}: {
  name: string;
  removeName: string;
  current?: string;
  label: string;
  portrait?: boolean;
  editable?: boolean;
}) {
  const id = useId();
  const [preview, setPreview] = useState<string>();
  const [removed, setRemoved] = useState(false);
  const [failed, setFailed] = useState<string>();
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const source = preview || (!removed ? current : undefined);
  return (
    <div className="image-edit-control">
      <div
        className={`image-edit-frame${portrait ? " image-edit-portrait" : ""}`}
      >
        {source && source !== failed ? (
          <Image
            unoptimized
            fill
            sizes={portrait ? "300px" : "240px"}
            src={source}
            alt={`${label} preview`}
            onError={() => setFailed(source)}
          />
        ) : (
          <div className="image-edit-placeholder">
            {portrait ? <UserRound size={54} /> : <ImageIcon size={44} />}
            <span>{label}</span>
          </div>
        )}
        {editable && (
          <label className="image-edit-overlay">
            <Camera size={18} aria-hidden="true" />
            <span>{source ? "Change image" : "Add image"}</span>
            <input
              className="image-edit-input"
              type="file"
              name={name}
              accept="image/jpeg,image/png,image/webp"
              aria-label={label}
              aria-describedby={id}
              onChange={(event) => {
                const file = event.target.files?.[0];
                setError("");
                if (
                  file &&
                  (!file.size ||
                    file.size > 10 * 1024 * 1024 ||
                    !["image/jpeg", "image/png", "image/webp"].includes(
                      file.type,
                    ))
                ) {
                  event.target.value = "";
                  setPreview(undefined);
                  setError("Choose a JPEG, PNG, or WebP image up to 10 MB.");
                  return;
                }
                setPreview(file ? URL.createObjectURL(file) : undefined);
                if (file) setRemoved(false);
              }}
            />
          </label>
        )}
      </div>
      <p className="staff-note" id={id}>
        JPEG, PNG or WebP, up to 10 MB.
        {portrait && " Use a 3:4 portrait, such as 900 × 1200 px."}
      </p>
      {error && (
        <p role="alert" className="staff-error">
          {error}
        </p>
      )}
      {current && editable && (
        <label className="image-edit-remove">
          <input
            type="checkbox"
            name={removeName}
            checked={removed}
            onChange={(e) => setRemoved(e.target.checked)}
          />
          Remove current image
        </label>
      )}
      {removed && preview && (
        <p className="staff-note">The selected replacement takes priority.</p>
      )}
    </div>
  );
}
