"use client";
import { useActionState } from "react";
import type { MasterCommittee } from "@/lib/legislative/committee-master";
import { saveMasterCommittee } from "./actions";
export function MasterForm({ committee }: { committee?: MasterCommittee }) {
  const [message, action, pending] = useActionState(saveMasterCommittee, "");
  return (
    <form action={action} className="staff-form staff-card">
      <h2>{committee ? "Edit Master Committee" : "Add Master Committee"}</h2>
      <input type="hidden" name="id" value={committee?.id || ""} />
      <input
        type="hidden"
        name="updated_at"
        value={committee?.updated_at || ""}
      />
      {committee && <p className="staff-note">Committee ID: {committee.id}</p>}
      <label>
        Committee Name
        <input
          name="name"
          required
          maxLength={300}
          defaultValue={committee?.name}
        />
      </label>
      <label>
        Sort Order
        <input
          name="sort_order"
          type="number"
          required
          min={0}
          max={1000000}
          step={1}
          defaultValue={committee?.sort_order ?? 0}
        />
      </label>
      <p className="staff-note">
        Lower numbers appear first. Changes apply to the catalog and new
        compositions; saved historical names are preserved.
      </p>
      {message && <p role="alert">{message}</p>}
      <button className="button button-blue" disabled={pending}>
        {pending ? "Saving..." : "Save committee"}
      </button>
    </form>
  );
}
