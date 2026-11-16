"use client";

import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { EmptyState } from "@/components/shared/ui";

export interface CommitteeDirectoryItem {
  id: string;
  name: string;
  responsibility: string;
  chair: string;
  viceChair: string;
  members: string[];
}

export function CommitteeDirectory({
  committees,
}: {
  committees: CommitteeDirectoryItem[];
}) {
  const [query, setQuery] = useState("");
  const keyword = query.trim().toLocaleLowerCase();
  const filtered = committees.filter((committee) =>
    [
      committee.name,
      committee.responsibility,
      committee.chair,
      committee.viceChair,
      ...committee.members,
    ]
      .join(" ")
      .toLocaleLowerCase()
      .includes(keyword),
  );

  return (
    <div className="committee-directory">
      <div className="committee-toolbar">
        <div>
          <h2>Committee directory</h2>
          <p>Open a committee to view its responsibilities and members.</p>
        </div>
        <div className="committee-search">
          <label htmlFor="committee-search">Search committees or members</label>
          <div>
            <Search size={18} aria-hidden="true" />
            <input
              id="committee-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Committee or member name"
            />
          </div>
        </div>
      </div>
      <p className="committee-result-count" role="status">
        {filtered.length} of {committees.length} committees
      </p>
      {filtered.length ? (
        <div className="committee-list">
          {filtered.map((committee) => (
            <details className="committee-entry" key={committee.id}>
              <summary>
                <h3>{committee.name}</h3>
                <span className="committee-chair">
                  <span>Chairperson</span>
                  {committee.chair || "Not yet listed"}
                </span>
                <span className="committee-toggle">
                  View members <ChevronDown size={18} aria-hidden="true" />
                </span>
              </summary>
              <div className="committee-details">
                {committee.responsibility && (
                  <div className="committee-responsibility">
                    <h4>Responsibilities</h4>
                    <p>{committee.responsibility}</p>
                  </div>
                )}
                <div className="committee-membership">
                  <h4>Committee membership</h4>
                  <dl>
                    <div>
                      <dt>Chairperson</dt>
                      <dd>{committee.chair || "Not yet listed"}</dd>
                    </div>
                    <div>
                      <dt>Vice-chairperson</dt>
                      <dd>{committee.viceChair || "Not yet listed"}</dd>
                    </div>
                    <div>
                      <dt>Members</dt>
                      <dd>
                        {committee.members.length ? (
                          <ul>
                            {committee.members.map((name, index) => (
                              <li key={index}>{name}</li>
                            ))}
                          </ul>
                        ) : (
                          "Members have not yet been listed."
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </details>
          ))}
        </div>
      ) : committees.length ? (
        <>
          <EmptyState />
          <button
            className="committee-clear"
            type="button"
            onClick={() => setQuery("")}
          >
            Clear search
          </button>
        </>
      ) : (
        <p className="empty-state">No committees have been published yet.</p>
      )}
    </div>
  );
}
