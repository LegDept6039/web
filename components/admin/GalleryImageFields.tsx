"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { GALLERY_FILE_LIMIT, GALLERY_IMAGE_LIMIT } from "@/lib/content/gallery";
import styles from "./GalleryImageFields.module.css";

export function GalleryImageFields({
  images,
  onFilesChange,
}: {
  images: string[];
  onFilesChange: (files: File[]) => void;
}) {
  const [retained, setRetained] = useState(images);
  const [selected, setSelected] = useState<{ file: File; preview: string }[]>(
    [],
  );
  const previewUrls = useRef(new Set<string>());
  const [error, setError] = useState("");
  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  function update(files: { file: File; preview: string }[]) {
    setSelected(files);
    onFilesChange(files.map((item) => item.file));
  }
  return (
    <div className={styles.fields}>
      <input
        type="hidden"
        name="gallery_keep"
        value={JSON.stringify(retained)}
      />
      <label>
        Additional photos (optional)
        <input
          type="file"
          name="gallery_images_files"
          accept="image/jpeg,image/png"
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = "";
            if (
              files.some(
                (file) =>
                  !["image/jpeg", "image/png"].includes(file.type) ||
                  file.size > GALLERY_FILE_LIMIT ||
                  !file.size,
              )
            ) {
              setError("Choose JPG or PNG images up to 10 MB each.");
              return;
            }
            if (
              retained.length + selected.length + files.length >
              GALLERY_IMAGE_LIMIT
            ) {
              setError("Choose up to 12 additional photos.");
              return;
            }
            setError("");
            update([
              ...selected,
              ...files.map((file) => {
                const preview = URL.createObjectURL(file);
                previewUrls.current.add(preview);
                return { file, preview };
              }),
            ]);
          }}
        />
      </label>
      <p className="staff-note">
        Add up to 12 additional JPG or PNG photos, 10 MB each. The featured
        image appears first; these photos follow in the gallery.
      </p>
      {error && <p role="alert">{error}</p>}
      <ul className={styles.previews} aria-label="Additional photos">
        {retained.map((url, index) => (
          <li key={url}>
            <Image
              unoptimized
              src={url}
              alt={`Saved gallery photo ${index + 1}`}
              width={120}
              height={80}
            />
            <button
              type="button"
              onClick={() =>
                setRetained(retained.filter((item) => item !== url))
              }
            >
              Remove saved photo {index + 1}
            </button>
          </li>
        ))}
        {selected.map(({ file, preview }, index) => (
          <li key={`${index}-${file.name}`}>
            <Image
              unoptimized
              src={preview}
              alt={`New gallery photo ${index + 1}`}
              width={120}
              height={80}
            />
            <span className={styles.filename}>{file.name}</span>
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(preview);
                previewUrls.current.delete(preview);
                update(selected.filter((_, item) => item !== index));
              }}
            >
              Remove new photo {index + 1}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
