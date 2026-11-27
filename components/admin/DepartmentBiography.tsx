"use client";
import { useId, useState } from "react";
import { BIOGRAPHY_LIMIT } from "@/lib/content/department-biography";
export function DepartmentBiography({
  initial = "",
  label = "Department Head Description",
}: {
  initial?: string;
  label?: string;
}) {
  const [value, setValue] = useState((initial || "").replace(/\r\n?/g, "\n"));
  const id = useId();
  const over = value.length > BIOGRAPHY_LIMIT;
  return (
    <label>
      {label}
      <textarea
        name="head_description"
        aria-label={label}
        value={value}
        maxLength={BIOGRAPHY_LIMIT}
        aria-describedby={`${id}-help ${id}`}
        aria-invalid={over || undefined}
        onChange={(e) => {
          setValue(e.target.value);
          e.target.setCustomValidity(
            e.target.value.length > BIOGRAPHY_LIMIT
              ? "Please shorten the biography to 800 characters or fewer."
              : "",
          );
        }}
        ref={(el) => {
          el?.setCustomValidity(
            over
              ? "Please shorten the biography to 800 characters or fewer."
              : "",
          );
        }}
      />
      <span id={`${id}-help`} className="staff-note">
        Biography or message about the head. Leave blank to omit it from the
        public page.
      </span>
      <span id={id} className="staff-note" aria-live="polite">
        {value.length} / {BIOGRAPHY_LIMIT}
        {over &&
          " - Existing biography exceeds the limit. Please shorten it manually; the saved text is unchanged."}
      </span>
    </label>
  );
}
