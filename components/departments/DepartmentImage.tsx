"use client";
import Image from "next/image";
import { useState } from "react";
export function DepartmentImage({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState<string>();
  return (
    <Image
      src={src && failed !== src ? src : "/images/department-placeholder.svg"}
      alt={src && failed !== src ? name : "Department image placeholder"}
      fill
      sizes="(max-width:700px) 100vw, 33vw"
      style={{ objectFit: "cover" }}
      onError={() => setFailed(src)}
    />
  );
}
