"use client";

import { useId } from "react";

export function DepartmentPhotoVisibility({
  visible = true,
  editable = true,
}: {
  visible?: boolean;
  editable?: boolean;
}) {
  const noteId = useId();
  return (
    <div className="department-photo-visibility">
      <input
        type="hidden"
        name="head_photo_visibility_present"
        value="1"
        disabled={!editable}
      />
      <label>
        <input
          type="checkbox"
          name="show_head_photo_on_page"
          defaultChecked={visible}
          disabled={!editable}
          aria-describedby={noteId}
        />
        Show head photo on this department page
      </label>
      <p className="staff-note" id={noteId}>
        Photos in the Departments directory stay visible. Unchecking this keeps
        the uploaded head photo and hides it only on this department&apos;s own page.
      </p>
    </div>
  );
}
