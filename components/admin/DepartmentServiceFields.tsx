"use client";

import { useState, type ReactNode } from "react";
import { SERVICE_TITLE_LIMIT } from "@/lib/content/service";

export function DepartmentServiceFields({
  row,
  children,
}: {
  row: Record<string, unknown>;
  children: ReactNode;
}) {
  const [title, setTitle] = useState(String(row.name || ""));
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
      <div>
        <p className="required-field-title">
          Body <span aria-hidden="true">*</span>
        </p>
        {children}
      </div>
    </>
  );
}
