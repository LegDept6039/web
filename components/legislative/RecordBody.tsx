"use client";

import { useEffect, useId, useRef, useState } from "react";

export function RecordBody({ text }: { text: string }) {
  const id = useId();
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(body);
      const previewHeight =
        parseFloat(style.lineHeight) *
        parseInt(style.getPropertyValue("--record-body-preview-lines"), 10);
      setCanExpand(body.scrollHeight > previewHeight + 1);
    });
    observer.observe(body);
    return () => observer.disconnect();
  }, [text]);

  return (
    <>
      <p
        id={id}
        ref={bodyRef}
        className={`record-body-copy${expanded ? "" : " record-body-copy--collapsed"}`}
      >
        {text}
      </p>
      {canExpand && (
        <button
          type="button"
          className="text-link record-body-toggle"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </>
  );
}
