export type RichNode = {
  type: string;
  text?: string;
  attrs?: { size?: string; start?: number };
  marks?: { type: string }[];
  content?: RichNode[];
};
export function legacyDocument(value: string | string[]): RichNode {
  const paragraphs = Array.isArray(value) ? value : value.split(/\n\n|\n/);
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: text ? [{ type: "text", text }] : [],
    })),
  };
}
export function richTextPlain(node: RichNode): string {
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return "\n";
  return (node.content || [])
    .map(richTextPlain)
    .join(node.type === "paragraph" ? "" : "\n");
}
export function validateRichText(input: unknown, required = false): RichNode {
  if (JSON.stringify(input)?.length > 200000)
    throw new Error("Content is too long.");
  let count = 0;
  function visit(value: unknown, depth: number): RichNode {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      depth > 12 ||
      ++count > 4000
    )
      throw new Error("Invalid rich text document.");
    const n = value as RichNode;
    const children: Record<string, string[]> = {
      doc: ["paragraph", "bulletList", "orderedList"],
      paragraph: ["text", "hardBreak"],
      bulletList: ["listItem"],
      orderedList: ["listItem"],
      listItem: ["paragraph", "bulletList", "orderedList"],
      text: [],
      hardBreak: [],
    };
    if (
      !Object.hasOwn(children, n.type) ||
      Object.keys(n).some(
        (k) => !["type", "text", "content", "attrs", "marks"].includes(k),
      )
    )
      throw new Error("Unsupported content formatting.");
    if (n.type === "text" ? typeof n.text !== "string" : n.text !== undefined)
      throw new Error("Invalid text node.");
    if (n.attrs != null) {
      if (typeof n.attrs !== "object" || Array.isArray(n.attrs))
        throw new Error("Invalid formatting attributes.");
      const allowed =
        n.type === "paragraph"
          ? ["size"]
          : n.type === "orderedList"
            ? ["start"]
            : [];
      if (
        Object.keys(n.attrs).some((k) => !allowed.includes(k)) ||
        (n.attrs.size !== undefined &&
          !["small", "normal", "large"].includes(n.attrs.size)) ||
        (n.attrs.start !== undefined && n.attrs.start !== 1)
      )
        throw new Error("Unsupported text size or list format.");
    }
    if (
      n.marks !== undefined &&
      (n.type !== "text" ||
        !Array.isArray(n.marks) ||
        n.marks.some(
          (m) =>
            !m ||
            Object.keys(m).some((k) => k !== "type") ||
            !["bold", "italic", "underline"].includes(m.type),
        ))
    )
      throw new Error("Unsupported text formatting.");
    if (n.content !== undefined) {
      if (!Array.isArray(n.content) || ["text", "hardBreak"].includes(n.type))
        throw new Error("Invalid content tree.");
      for (const c of n.content) {
        visit(c, depth + 1);
        if (!children[n.type].includes(c.type))
          throw new Error("Invalid content nesting.");
      }
    }
    return n;
  }
  const result = visit(input, 0);
  if (result.type !== "doc") throw new Error("Invalid rich text document.");
  const text = richTextPlain(result);
  if (text.length > 30000) throw new Error("Content is too long.");
  if (required && !text.trim()) throw new Error("Content is required.");
  return result;
}
