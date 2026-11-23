"use client";

import { useState } from "react";
import type { DashboardOfficial } from "@/lib/legislative/dashboard";

export function LegislativeAuthorshipTable({
  officials,
  officialsAvailable,
  authorshipAvailable,
}: {
  officials: DashboardOfficial[];
  officialsAvailable: boolean;
  authorshipAvailable: { ordinances: boolean; resolutions: boolean };
}) {
  const [type, setType] = useState<"resolutions" | "ordinances">("resolutions");
  const label = type === "resolutions" ? "Resolutions" : "Ordinances";
  const available = officialsAvailable && authorshipAvailable[type];
  return (
    <section
      className="legislative-authorship"
      aria-labelledby="legislative-authorship-heading"
    >
      <div className="legislative-authorship-toolbar">
        <div>
          <h2 id="legislative-authorship-heading">Authorship by official</h2>
          <p aria-live="polite">
            Published {label.toLowerCase()} in the selected term.
          </p>
        </div>
        <div
          className="legislative-type-switch"
          role="group"
          aria-label="Document type"
        >
          {(["resolutions", "ordinances"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={type === option}
              aria-controls={available ? "legislative-authorship-table" : undefined}
              onClick={() => setType(option)}
            >
              {option === "resolutions" ? "Resolutions" : "Ordinances"}
            </button>
          ))}
        </div>
      </div>
      {!available ? (
        <div className="legislative-dashboard-empty" role="alert">
          Unable to load{" "}
          {officialsAvailable
            ? label.toLowerCase() + " authorship counts"
            : "officials"}
          . Reload this page to try again.
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table
            className="admin-table legislative-authorship-table"
            id="legislative-authorship-table"
          >
            <caption className="sr-only">
              {label} authored and co-authored by official
            </caption>
            <thead>
              <tr>
                <th scope="col">Official</th>
                <th scope="col">Authored</th>
                <th scope="col">Co-authored</th>
              </tr>
            </thead>
            <tbody>
              {officials.length ? (
                officials.map((official) => (
                  <tr key={official.id}>
                    <th scope="row">{official.name}</th>
                    <td>{official[type].authored.toLocaleString("en-PH")}</td>
                    <td>{official[type].coauthored.toLocaleString("en-PH")}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="legislative-dashboard-empty">
                    No officials are assigned to this term.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
