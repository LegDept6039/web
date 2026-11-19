"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
export function ImageUpload({
  name,
  label,
  current,
  portrait = false,
}: {
  name: string;
  label: string;
  current?: string;
  portrait?: boolean;
}) {
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  return (
    <div>
      <label>
        {label} (JPEG, PNG, WebP; up to 10 MB)
        <input
          type="file"
          name={name}
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setError("");
            if (
              file &&
              (!file.size ||
                file.size > 10 * 1024 * 1024 ||
                !["image/jpeg", "image/png", "image/webp"].includes(file.type))
            ) {
              event.target.value = "";
              setPreview(undefined);
              setError("Choose a JPEG, PNG, or WebP image up to 10 MB.");
              return;
            }
            setPreview(file ? URL.createObjectURL(file) : undefined);
          }}
        />
      </label>
      {(preview || current) && (
        <Image
          unoptimized
          width={240}
          height={portrait ? 320 : 160}
          style={
            portrait
              ? {
                  width: 240,
                  maxWidth: "100%",
                  height: "auto",
                  aspectRatio: "3 / 4",
                  objectFit: "cover",
                  objectPosition: "center top",
                }
              : { objectFit: "contain", maxWidth: "100%" }
          }
          src={preview || current!}
          alt={`${label} preview`}
        />
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
