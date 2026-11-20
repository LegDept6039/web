"use client";

import { useState } from "react";
import {
  SERVICE_BODY_LIMIT,
  SERVICE_TITLE_LIMIT,
  serviceEditorBody,
} from "@/lib/content/service";

export function DepartmentServiceFields({
  row,
}: {
  row: Record<string, unknown>;
}) {
  const [title, setTitle] = useState(String(row.name || ""));
  const [body, setBody] = useState(() => serviceEditorBody(row));
  return (
    <>
      <label>
        Title
        <input
          name="name"
          required
          maxLength={SERVICE_TITLE_LIMIT}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label>
        Body
        <textarea
          name="body"
          required
          rows={10}
          maxLength={SERVICE_BODY_LIMIT}
          aria-describedby="department-service-body-help"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <p className="staff-note" id="department-service-body-help">
        {body.length.toLocaleString()} / 30,000 characters. Line breaks are
        preserved on the public page.
      </p>
    </>
  );
}
