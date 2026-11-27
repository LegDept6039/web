"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import styles from "./PhotoGallery.module.css";

type PhotoGalleryProps = {
  title: string;
  coverImage?: string;
  images?: string[];
  preload?: boolean;
};

export function PhotoGallery({
  title,
  coverImage,
  images = [],
  preload = false,
}: PhotoGalleryProps) {
  const photos = [
    ...new Set(
      [coverImage, ...images]
        .map((src) => src?.trim())
        .filter((src): src is string => Boolean(src)),
    ),
  ];
  if (!photos.length) return null;
  return (
    <Gallery
      key={photos.join("\n")}
      photos={photos}
      title={title}
      preload={preload}
    />
  );
}

function Gallery({
  photos,
  title,
  preload,
}: {
  photos: string[];
  title: string;
  preload: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const thumbnailList = useRef<HTMLOListElement>(null);
  const thumbnails = useRef<Array<HTMLButtonElement | null>>([]);
  const frameId = useId();
  const multiple = photos.length > 1;
  const currentPhoto = photos[selected];
  const imageFailed = (src: string) =>
    setFailed((previous) =>
      previous.includes(src) ? previous : [...previous, src],
    );

  function selectPhoto(index: number, focusThumbnail = false) {
    const next = (index + photos.length) % photos.length;
    setSelected(next);
    const thumbnail = thumbnails.current[next];
    if (focusThumbnail) thumbnail?.focus({ preventScroll: true });
    if (thumbnail && thumbnailList.current) {
      thumbnailList.current.scrollTo({
        left:
          thumbnail.offsetLeft -
          (thumbnailList.current.clientWidth - thumbnail.clientWidth) / 2,
        behavior: "auto",
      });
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!multiple || event.altKey || event.ctrlKey || event.metaKey) return;
    const next =
      event.key === "ArrowLeft"
        ? selected - 1
        : event.key === "ArrowRight"
          ? selected + 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? photos.length - 1
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    selectPhoto(
      next,
      (event.target as HTMLElement).hasAttribute("data-photo-thumbnail"),
    );
  }

  return (
    <div
      className={styles.gallery}
      role="region"
      aria-label={`${title} photos`}
      aria-roledescription={multiple ? "carousel" : undefined}
      onKeyDown={handleKeyDown}
    >
      <div
        className={`${styles.viewer}${multiple ? ` ${styles.withControls}` : ""}`}
      >
        {multiple && (
          <button
            className={styles.arrow}
            type="button"
            onClick={() => selectPhoto(selected - 1)}
            aria-label="Previous photo"
            aria-controls={frameId}
          >
            <ChevronLeft size={24} aria-hidden="true" />
          </button>
        )}
        <div className={styles.frame} id={frameId}>
          {failed.includes(currentPhoto) ? (
            <div
              className={styles.unavailable}
              role="img"
              aria-label={`Photo ${selected + 1} is unavailable`}
            >
              <ImageOff size={30} aria-hidden="true" />
              <span>Photo unavailable</span>
            </div>
          ) : (
            <Image
              key={currentPhoto}
              className={styles.image}
              src={currentPhoto}
              alt={
                multiple
                  ? `${title}, photo ${selected + 1} of ${photos.length}`
                  : title
              }
              fill
              sizes="(max-width: 600px) calc(100vw - 40px), 790px"
              preload={preload && selected === 0}
              onError={() => imageFailed(currentPhoto)}
            />
          )}
        </div>
        {multiple && (
          <button
            className={styles.arrow}
            type="button"
            onClick={() => selectPhoto(selected + 1)}
            aria-label="Next photo"
            aria-controls={frameId}
          >
            <ChevronRight size={24} aria-hidden="true" />
          </button>
        )}
      </div>
      {multiple && (
        <>
          <p className={styles.count} aria-live="polite" aria-atomic="true">
            Photo {selected + 1} of {photos.length}
          </p>
          <ol
            className={styles.thumbnails}
            ref={thumbnailList}
            aria-label="Choose a photo"
          >
            {photos.map((src, index) => (
              <li key={src}>
                <button
                  ref={(element) => {
                    thumbnails.current[index] = element;
                  }}
                  className={styles.thumbnail}
                  type="button"
                  data-photo-thumbnail=""
                  onClick={() => selectPhoto(index)}
                  aria-label={`Show photo ${index + 1} of ${photos.length}`}
                  aria-current={index === selected ? "true" : undefined}
                  aria-controls={frameId}
                >
                  {failed.includes(src) ? (
                    <ImageOff size={20} aria-hidden="true" />
                  ) : (
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="88px"
                      onError={() => imageFailed(src)}
                    />
                  )}
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
