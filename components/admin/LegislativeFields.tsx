"use client";
import { useState } from "react";
import { COMMITTEE_DESCRIPTION_MAX_LENGTH } from "@/lib/legislative/config";
import type { Collection } from "@/lib/content/schema";
import type {
  LegislativeOptions,
  RelationOption,
} from "@/lib/legislative/config";
export function LegislativeFields({
  collection,
  row,
  options,
}: {
  collection: Collection;
  row: Record<string, unknown>;
  options: LegislativeOptions;
}) {
  const [documentType, setDocumentType] = useState(
    String(row.document_type || ""),
  );
  const [committeeDescription, setCommitteeDescription] = useState(
    String(row.responsibility || ""),
  );
  const input = (
    name: string,
    label: string,
    type = "text",
    required = true,
  ) => (
    <label key={name}>
      {label}
      <input
        aria-label={label}
        name={name}
        type={type}
        required={required}
        defaultValue={String(row[name] || "")}
      />
    </label>
  );
  const select = (
    name: string,
    label: string,
    items: RelationOption[],
    required = true,
  ) => (
    <label key={name}>
      {label}
      <select
        aria-label={label}
        name={name}
        required={required}
        defaultValue={String(row[name] || "")}
      >
        <option value="">{required ? "Select..." : "N/A"}</option>
        {items.map((o) => (
          <option value={o.id} key={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
  const body = (name: string) => (
    <label>
      Body
      <textarea
        aria-label="Body"
        name={name}
        rows={10}
        required
        defaultValue={String(row[name] || "")}
      />
    </label>
  );
  if (collection === "sessions")
    return (
      <>
        {input("name", "Name")}
        {input("date", "Date", "date")}
        {input("number", "No. (Session Number)")}
        <label>
          Type
          <select
            aria-label="Type"
            name="type"
            required
            defaultValue={String(row.type || "")}
          >
            <option value="">Select...</option>
            <option value="Regular session">Regular</option>
            <option value="Special session">Special</option>
            {row.type === "Caucus meeting" && <option>Caucus meeting</option>}
          </select>
        </label>
      </>
    );
  if (collection === "committees")
    return (
      <>
        {input("name", "Committee Name")}
        <label>
          Committee description (optional)
          <textarea
            aria-label="Committee description"
            aria-describedby="committee-description-help"
            name="responsibility"
            rows={4}
            maxLength={COMMITTEE_DESCRIPTION_MAX_LENGTH}
            value={committeeDescription}
            onChange={(event) => setCommitteeDescription(event.target.value)}
          />
          <span id="committee-description-help" className="staff-note">
            {committeeDescription.length}/{COMMITTEE_DESCRIPTION_MAX_LENGTH}{" "}
            characters. Describe the committee’s responsibilities. Line breaks
            appear on the public page.
          </span>
        </label>
        {select("chair_id", "Chairperson", options.officials)}
        {select("vice_chair_id", "Vice-Chairperson", options.officials)}
        {[1, 2, 3, 4].map((n) =>
          select(`member_${n}_id`, `Member ${n}`, options.officials, false),
        )}
        {Boolean(row.chair && !row.chair_id) && (
          <p className="staff-note">
            Existing chair text: {String(row.chair)}. Select the matching
            official to link this committee.
          </p>
        )}
      </>
    );
  if (collection === "ordinances" || collection === "resolutions")
    return (
      <>
        {input("title", "Title")}
        {input("number", "Document Number")}
        {select("author_id", "Author", options.officials)}
        {select("co_author_id", "Co-author", options.officials, false)}
        {Boolean(row.author && !row.author_id) && (
          <p className="staff-note">
            Existing author: {String(row.author)}. Select the matching official.
          </p>
        )}
        {input("year", "Year", "number")}
        {input("date_approved", "Date", "date")}
        {select("committee_id", "Category", options.committees)}
        {body("summary")}
        {select("session_id", "Session", options.sessions)}
      </>
    );
  return (
    <>
      {row.document_type ? (
        <input type="hidden" name="document_type" value={documentType} />
      ) : (
        <label>
          Document type
          <select
            name="document_type"
            aria-label="Document type"
            value={documentType}
            required
            onChange={(e) => setDocumentType(e.target.value)}
          >
            <option value="">
              Select a type for this existing document...
            </option>
            <option value="agenda">Agenda</option>
            <option value="minutes">Minutes</option>
            <option value="executive-order">Executive Order (EO)</option>
          </select>
        </label>
      )}
      {input("title", "Title")}
      {input("date", "Date", "date")}
      {documentType !== "executive-order" &&
        select("session_id", "Session", options.sessions)}
      {body("description")}
    </>
  );
}
