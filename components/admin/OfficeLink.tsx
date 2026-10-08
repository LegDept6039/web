"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
export function OfficeLink({ office, name }: { office: string; name: string }) {
  const active = useSearchParams().get("office") === office;
  return (
    <Link
      href={`/admin/content?office=${office}`}
      aria-current={active ? "page" : undefined}
    >
      {name}
    </Link>
  );
}
