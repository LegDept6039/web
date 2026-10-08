"use client";
import Image from "next/image";
import { useState } from "react";
import { UserRound } from "lucide-react";
export function OfficialPhoto({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState<string>();
  return src && failed !== src ? (
    <Image
      src={src}
      alt={name}
      fill
      sizes="(max-width: 800px) 50vw, 25vw"
      style={{ objectFit: "cover" }}
      onError={() => setFailed(src)}
    />
  ) : (
    <>
      <UserRound size={90} strokeWidth={0.8} />
      <span>OFFICIAL PROFILE</span>
    </>
  );
}
