"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addBulkSessions } from "@/app/admin/content/session-bulk-actions";
import { termDisplayName, type LegislativeTerm } from "@/lib/legislative/terms";
import {
  BULK_SESSION_MAX_ROWS,
  type BulkSessionInput,
} from "@/lib/legislative/session-bulk";

function emptyRow(key: number): BulkSessionInput & { key: number } {
  return { key, date: "", name: "", number: "", type: "Regular session" };
}

export function BulkSessionForm({
  offices,
  office,
  terms,
  term,
  today,
}: {
  offices: { id: string; name: string }[];
  office: string;
  terms: LegislativeTerm[];
  term: string;
  today: string;
}) {
  const [officeId, setOfficeId] = useState(office);
  const [termId, setTermId] = useState(
    terms.some((t) => t.id === term) ? term : "",
  );
  const [rows, setRows] = useState([emptyRow(0)]);
  const nextKey = useRef(1);
  const resultPanel = useRef<HTMLDivElement>(null);
  const [result, action, pending] = useActionState(addBulkSessions, {
    message: "",
  });
  useEffect(() => {
    if (result.message) resultPanel.current?.focus();
  }, [result]);
  const selected = terms.find((t) => t.id === termId);
  const listUrl = `/admin/content/sessions?${new URLSearchParams({ office: officeId, ...(selected ? { term: termId } : {}) })}`;
  function update(key: number, field: keyof BulkSessionInput, value: string) {
    setRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, [field]: value } : row,
      ),
    );
  }
  return (
    <form
      action={action}
      className="staff-form bulk-session-form"
      onReset={(event) => event.preventDefault()}
    >
      {result.message && (
        <div
          ref={resultPanel}
          role="alert"
          tabIndex={-1}
          className="staff-error"
        >
          <p>{result.message}</p>
          {result.errors && (
            <ul>
              {result.errors.map((error) => (
                <li key={error.row}>
                  Session {error.row}: {error.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <input type="hidden" name="office_id" value={officeId} />
      <input
        type="hidden"
        name="sessions"
        value={JSON.stringify(
          rows.map(({ date, name, number, type }) => ({
            date,
            name,
            number,
            type,
          })),
        )}
      />
      <fieldset disabled={pending} className="bulk-session-settings">
        <legend>Legislative Term</legend>
        {offices.length > 1 && (
          <label>
            Office
            <select
              value={officeId}
              onChange={(event) => setOfficeId(event.target.value)}
            >
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Legislative Term
          <select
            name="term_id"
            required
            value={termId}
            onChange={(event) => setTermId(event.target.value)}
          >
            <option value="">Select a term</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {termDisplayName(t, today)}
              </option>
            ))}
          </select>
        </label>
        <p className="staff-note">
          {selected
            ? `Session dates must fall between ${selected.start_date} and ${selected.end_date}, inclusive.`
            : "Choose the term these sessions belong to."}
        </p>
        <p className="staff-note">
          All sessions are published when saved and listed by date, newest first.
        </p>
      </fieldset>
      <div className="bulk-session-count" role="status">
        {rows.length} of {BULK_SESSION_MAX_ROWS} sessions
      </div>
      {rows.map((row, index) => (
        <fieldset key={row.key} disabled={pending} className="bulk-session-row">
          <legend>Session {index + 1}</legend>
          <div className="bulk-session-fields">
            <label>
              Date
              <input
                type="date"
                required
                value={row.date}
                min={selected?.start_date}
                max={selected?.end_date}
                onChange={(event) =>
                  update(row.key, "date", event.target.value)
                }
              />
            </label>
            <label>
              Name
              <input
                required
                maxLength={30000}
                value={row.name}
                onChange={(event) =>
                  update(row.key, "name", event.target.value)
                }
              />
            </label>
            <label>
              No. (Session Number)
              <input
                required
                maxLength={30000}
                value={row.number}
                onChange={(event) =>
                  update(row.key, "number", event.target.value)
                }
              />
            </label>
            <label>
              Type
              <select
                required
                value={row.type}
                onChange={(event) =>
                  update(row.key, "type", event.target.value)
                }
              >
                <option value="Regular session">Regular</option>
                <option value="Special session">Special</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            className="bulk-session-remove"
            aria-label={`Remove session ${index + 1}`}
            disabled={rows.length === 1}
            onClick={() =>
              setRows((current) =>
                current.filter((item) => item.key !== row.key),
              )
            }
          >
            <Trash2 size={15} aria-hidden="true" /> Remove
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="button bulk-session-add"
        disabled={pending || rows.length >= BULK_SESSION_MAX_ROWS}
        onClick={() => {
          const key = nextKey.current++;
          setRows((current) => [...current, emptyRow(key)]);
        }}
      >
        <Plus size={16} aria-hidden="true" /> Add another session
      </button>
      <div className="staff-actions">
        <button
          type="submit"
          className="button button-blue"
          disabled={pending || !selected}
        >
          {pending
            ? "Saving sessions..."
            : `Save ${rows.length} session${rows.length === 1 ? "" : "s"}`}
        </button>
        {!pending && (
          <Link className="button" href={listUrl}>
            Back to sessions
          </Link>
        )}
      </div>
    </form>
  );
}
