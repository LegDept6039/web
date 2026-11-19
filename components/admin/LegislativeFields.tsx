"use client";
import { termDisplayName, termForDate } from "@/lib/legislative/terms";

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
  const [masterId, setMasterId] = useState(String(row.master_id || ""));
  const masterName = options.masters?.find(
    (master) => master.id === masterId,
  )?.name;
  const terms = options.terms || [];
  const [manualTerm, setManualTerm] = useState(
    String(
      row.term_id ||
        (row.id ? "" : termForDate(terms, options.today || "")?.id) ||
        "",
    ),
  );
  const [recordDate, setRecordDate] = useState(
    String(row.date_approved || row.date || ""),
  );
  const [sessionId, setSessionId] = useState(String(row.session_id || ""));
  const termId =
    collection === "committees"
      ? manualTerm
      : termForDate(terms, recordDate)?.id;
  const assignedTerm = terms.find((term) => term.id === termId);
  const matchingSessions = options.sessions.filter(
    (session) =>
      Boolean(termId) &&
      session.termId === termId &&
      session.date === recordDate,
  );
  const matchedSessionId =
    matchingSessions.length === 1
      ? matchingSessions[0].id
      : matchingSessions.some((session) => session.id === sessionId)
        ? sessionId
        : "";
  const authors = options.officials.filter(
    (official) => official.legislativeRole === "SANGGUNIANG_BAYAN",
  );
  const sessionControl =
    matchingSessions.length > 1 ? (
      <label>
        Session
        <select
          name="session_id"
          aria-label="Session"
          required
          value={matchedSessionId}
          onChange={(event) => setSessionId(event.target.value)}
        >
          <option value="">Select the session held on this date</option>
          {matchingSessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
            </option>
          ))}
        </select>
        <span className="staff-note">
          Multiple sessions were held on this date. Choose the correct session.
        </span>
      </label>
    ) : (
      <label>
        Session
        <input type="hidden" name="session_id" value={matchedSessionId} />
        <output className="staff-derived-value" aria-label="Session">
          {matchingSessions[0]?.name ||
            (recordDate
              ? "No matching session"
              : "Enter the document date first")}
        </output>
        <span className="staff-note">
          {matchingSessions.length
            ? "Automatically matched to the document date."
            : "Create a session for this date in the same Legislative office and term before saving."}
        </span>
      </label>
    );
  const termControl =
    collection === "committees" ? (
      <label>
        Legislative Term
        <select
          name="term_id"
          required
          value={manualTerm}
          onChange={(e) => setManualTerm(e.target.value)}
        >
          <option value="">Select a term</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {termDisplayName(t, options.today)}
            </option>
          ))}
        </select>
      </label>
    ) : (
      <label>
        Assigned Legislative Term
        <output
          className="staff-derived-value"
          aria-label="Assigned Legislative Term"
        >
          {assignedTerm
            ? termDisplayName(assignedTerm, options.today)
            : "No matching term"}
        </output>
        <span className="staff-note">
          Determined by the record date.{" "}
          {termId
            ? ""
            : "Choose a covered date or assigned session. Ask Superadmin to create missing terms."}
        </span>
      </label>
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
        onChange={
          type === "date" ? (e) => setRecordDate(e.target.value) : undefined
        }
      />
    </label>
  );
  const select = (
    name: string,
    label: string,
    items: RelationOption[],
    required = true,
  ) => (
    <label key={`${name}:${termId || "unassigned"}`}>
      {label}
      <select
        aria-label={label}
        name={name}
        required={required}
        defaultValue={String(row[name] || "")}
      >
        <option value="">{required ? "Select..." : "N/A"}</option>
        {items
          .filter((o) => Boolean(termId) && o.termId === termId)
          .map((o) => (
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
        {input("date", "Date", "date")}
        {termControl}
        {input("name", "Name")}
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
        {termControl}
        {row.id && row.master_id ? (
          <label>
            Master Committee
            <input type="hidden" name="master_id" value={masterId} />
            <input readOnly value={masterName || String(row.name || "")} />
          </label>
        ) : (
          <label>
            Master Committee
            <select
              name="master_id"
              required
              value={masterId}
              onChange={(event) => setMasterId(event.target.value)}
            >
              <option value="">Select a master committee</option>
              {(options.masters || []).map((master) => (
                <option key={master.id} value={master.id}>
                  {master.name}
                </option>
              ))}
            </select>
            {Boolean(row.id) && (
              <span className="staff-note">
                Review this historical record before associating it. Its saved
                name and ID will be preserved.
              </span>
            )}
          </label>
        )}
        {Boolean(row.id && row.name && row.name !== masterName) && (
          <p className="staff-note">
            Saved historical name: {String(row.name)}. This name is preserved
            for this term.
          </p>
        )}
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
        {select("chair_id", "Chairperson", options.officials, false)}
        {select("vice_chair_id", "Vice-Chairperson", options.officials, false)}
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
        {input("date_approved", "Date", "date")}
        {termControl}
        {input("title", "Title")}
        {input("number", "Document Number")}
        {select("author_id", "Author", authors)}
        {select("co_author_id", "Co-author", authors, false)}
        {Boolean(row.author && !row.author_id) && (
          <p className="staff-note">
            Existing author: {String(row.author)}. Select the matching official.
          </p>
        )}
        {input("year", "Year", "number")}
        {select("committee_id", "Category", options.committees)}
        {body("summary")}
        {sessionControl}
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
      {input("date", "Date", "date")}
      {documentType !== "executive-order" && sessionControl}
      {termControl}
      {input("title", "Title")}
      {body("description")}
    </>
  );
}
