"use client";
import { useActionState } from "react";
import type { LegislativeTerm } from "@/lib/legislative/terms";
import { saveTerm } from "./actions";
export function TermForm({ term }: { term?: LegislativeTerm }) {
  const [message, action, pending] = useActionState(saveTerm, "");
  return (
    <form action={action} className="staff-form staff-card">
      <h2>{term ? "Edit Legislative Term" : "Create Legislative Term"}</h2>
      <input type="hidden" name="id" value={term?.id || ""} />
      <input type="hidden" name="updated_at" value={term?.updated_at || ""} />
      <label>
        Term Name
        <input name="name" required maxLength={150} defaultValue={term?.name} />
      </label>
      <label>
        Start Date
        <input
          name="start_date"
          type="date"
          required
          defaultValue={term?.start_date}
        />
      </label>
      <label>
        End Date
        <input
          name="end_date"
          type="date"
          required
          defaultValue={term?.end_date}
        />
      </label>
      <p className="staff-note">
        Displayed years are added automatically from the dates. Status follows
        Philippine time automatically. Dates cannot overlap another term.
      </p>
      {!term && (
        <p className="staff-note">
          Creating a term automatically publishes its committees from Master
          Committees. Assign chairpersons and members in the Committees
          workspace.
        </p>
      )}
      {message && <p role="alert">{message}</p>}
      <button className="button button-blue" disabled={pending}>
        {pending ? "Saving..." : "Save term"}
      </button>
    </form>
  );
}
