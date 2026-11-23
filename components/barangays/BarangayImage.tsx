"use client";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { useState } from "react";

export function BarangayImage({
  src,
  name,
  profileLabel = "Barangay profile",
}: {
  src?: string | null;
  name: string;
  profileLabel?: string;
}) {
  const [failed, setFailed] = useState<string>();
  return (
    <div className="barangay-image">
      {src && failed !== src ? (
        <Image
          src={src}
          alt={name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 400px"
          style={{ objectFit: "cover" }}
          onError={() => setFailed(src)}
        />
      ) : (
        <div
          className="barangay-image-placeholder"
          role="img"
          aria-label={`${name} image unavailable`}
        >
          <MapPin size={48} strokeWidth={1} aria-hidden="true" />
          <span>{profileLabel}</span>
        </div>
      )}
    </div>
  );
}
