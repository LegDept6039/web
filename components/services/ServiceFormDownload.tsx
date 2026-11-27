import { Download } from "lucide-react";
import type { Service } from "@/types";

export function ServiceFormDownload({ service }: { service: Service }) {
  if (!service.formUrl) return null;
  return (
    <p className="mt-4">
      <a href={service.formUrl} className="text-link" download>
        <Download size={16} aria-hidden="true" />
        Download service form{service.formName
          ? `: ${service.formName}`
          : ""}{" "}
        (PDF)
      </a>
    </p>
  );
}
