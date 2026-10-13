import { Fragment, type ReactNode } from "react";
import {
  legacyDocument,
  validateRichText,
  type RichNode,
} from "@/lib/content/rich-text";
export function RichText({
  document,
  legacy,
}: {
  document?: RichNode;
  legacy: string | string[];
}) {
  const doc = validateRichText(document || legacyDocument(legacy));
  function render(n: RichNode, index: number): ReactNode {
    if (n.type === "text") {
      let text: ReactNode = n.text;
      for (const m of n.marks || [])
        text =
          m.type === "bold" ? (
            <strong>{text}</strong>
          ) : m.type === "italic" ? (
            <em>{text}</em>
          ) : (
            <u>{text}</u>
          );
      return <Fragment key={index}>{text}</Fragment>;
    }
    const children = n.content?.map(render);
    switch (n.type) {
      case "paragraph":
        return (
          <p key={index} data-size={n.attrs?.size || "normal"}>
            {children}
          </p>
        );
      case "bulletList":
        return <ul key={index}>{children}</ul>;
      case "orderedList":
        return <ol key={index}>{children}</ol>;
      case "listItem":
        return <li key={index}>{children}</li>;
      case "hardBreak":
        return <br key={index} />;
      default:
        return <Fragment key={index}>{children}</Fragment>;
    }
  }
  return <div className="rich-text">{doc.content?.map(render)}</div>;
}
