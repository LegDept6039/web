import { RichText } from "@/components/shared/RichText";
import type { RichNode } from "@/lib/content/rich-text";

export function ServiceBody({
  body,
  richBody,
}: {
  body: string;
  richBody?: RichNode;
}) {
  return (
    <div className={`service-body${richBody ? " service-body-formatted" : ""}`}>
      {richBody ? <RichText document={richBody} legacy={body} /> : body}
    </div>
  );
}
