"use client";
import { useRouter } from "next/navigation";
import {
  documentTypes,
  documentCollection,
  isDocumentType,
} from "@/lib/legislative/config";
export function DocumentTypeSelector({ office }: { office?: string }) {
  const router = useRouter();
  return (
    <div className="staff-card staff-form">
      <label>
        Document type
        <select
          aria-label="Document type"
          defaultValue=""
          onChange={(e) => {
            const type = e.target.value;
            if (isDocumentType(type))
              router.push(
                `/admin/content/${documentCollection(type)}/new?type=${type}${office ? `&office=${office}` : ""}`,
              );
          }}
        >
          <option value="">Select document type...</option>
          {Object.entries(documentTypes).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
