"use client";
import { useEffect, useState } from "react";
import { positionLimit } from "@/app/admin/content/position-actions";
import type { Collection } from "@/lib/content/schema";
export function PublicationFields({
  collection,
  office = "",
  branch,
  original = "",
  published: initial = false,
  position = 0,
}: {
  collection: Collection;
  office?: string;
  branch: string;
  original?: string;
  published?: boolean;
  position?: number;
}) {
  const [published, setPublished] = useState(initial);
  const [value, setValue] = useState(position > 0 ? String(position) : "");
  const [result, setResult] = useState<{
    key: string;
    max?: number;
    error?: string;
  }>();
  const key = `${collection}:${office}:${branch}:${original}`;
  const dateOrdered = branch === "legislative" && collection === "sessions";
  useEffect(() => {
    let live = true;
    if (published && !dateOrdered)
      positionLimit(collection, office, branch, original)
        .then((r) => {
          if (live) setResult({ key, ...r });
        })
        .catch(() => {
          if (live)
            setResult({
              key,
              error: "Unable to load positions. Reload and try again.",
            });
        });
    return () => {
      live = false;
    };
  }, [collection, office, branch, original, published, key, dateOrdered]);
  const current = result?.key === key ? result : undefined;
  return (
    <div className="publication-fields">
      <label>
        <input
          type="checkbox"
          name="published"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
        />{" "}
        Published
      </label>
      {dateOrdered ? (
        <>
          <input
            type="hidden"
            name="sort_order"
            value={published ? position || 1 : 0}
          />
          <p className="staff-note">
            Sessions are listed by session date, newest first.
          </p>
        </>
      ) : published ? (
        <>
          <label>
            {collection === "departments" ? "Display Order" : "Sort order"}
            <input
              type="number"
              name="sort_order"
              min={1}
              max={current?.max}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              aria-required="true"
            />
          </label>
          <p className="staff-note">
            {current?.max
              ? `Choose a position from 1 to ${current.max}. Existing items shift automatically.`
              : "Loading available positions..."}
          </p>
          {current?.error && <p role="alert">{current.error}</p>}
        </>
      ) : (
        <>
          <input type="hidden" name="sort_order" value="0" />
          <p className="staff-note">Unpublished records use position 0.</p>
        </>
      )}
    </div>
  );
}
