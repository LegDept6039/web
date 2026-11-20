export const SERVICE_TITLE_LIMIT = 300;
export const SERVICE_BODY_LIMIT = 30000;

export function serviceEditorBody(row: Record<string, unknown>) {
  if (typeof row.body === "string") return row.body;
  return [
    typeof row.description === "string" ? row.description : "",
    ...(Array.isArray(row.steps)
      ? row.steps.filter((step): step is string => typeof step === "string")
      : []),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function validateService(name: string, body: string) {
  const title = name.trim();
  const text = body.trim();
  if (!title || title.length > SERVICE_TITLE_LIMIT)
    throw new Error(
      `Enter a service title up to ${SERVICE_TITLE_LIMIT} characters.`,
    );
  if (!text || text.length > SERVICE_BODY_LIMIT)
    throw new Error("Enter a service body up to 30,000 characters.");
  return { name: title, body: text };
}

export function serviceExcerpt(body: string) {
  const text = body.replace(/\s+/g, " ").trim();
  return text.length > 200 ? `${text.slice(0, 199).trimEnd()}…` : text;
}
