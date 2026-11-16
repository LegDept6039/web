import type { Collection } from "@/lib/content/schema";
import { publicationPosition } from "@/lib/admin/publication";
import {
  COMMITTEE_DESCRIPTION_MAX_LENGTH,
  isDocumentCollection,
  isDocumentType,
} from "./config";
/** Only editable values are accepted. Existing legacy fields stay untouched on updates. */
export function parseLegislative(
  collection: Collection,
  form: FormData,
  existing: Record<string, unknown> | null,
) {
  const text = (key: string, required = true) => {
    const value = String(form.get(key) || "").trim();
    if (required && !value)
      throw new Error(`${key.replaceAll("_", " ")} is required.`);
    if (value.length > 30000) throw new Error("Content is too long.");
    return value;
  };
  const date = (key: string) => {
    const value = text(key);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    )
      throw new Error("Enter a valid date.");
    return value;
  };
  if (
    form.getAll("author_id").length > 1 ||
    form.getAll("co_author_id").length > 1
  )
    throw new Error("Choose exactly one author and at most one co-author.");
  const row: Record<string, unknown> = {
    id: existing?.id || crypto.randomUUID(),
  };
  if (isDocumentCollection(collection)) {
    if (existing && existing.published !== true)
      throw new Error(
        "This document is unpublished. It is preserved outside the published-document workspace.",
      );
    row.published = true;
    row.sort_order = existing?.sort_order || 1;
  } else {
    row.published = form.get("published") === "on";
    row.sort_order = publicationPosition(form);
  }
  if (!existing) row.is_sample = false;
  if (collection === "sessions") {
    Object.assign(row, {
      name: text("name"),
      number: text("number"),
      date: date("date"),
      type: text("type"),
    });
    if (
      !["Regular session", "Special session"].includes(String(row.type)) &&
      row.type !== existing?.type
    )
      throw new Error("Choose Regular or Special.");
    if (!existing)
      Object.assign(row, {
        description: "",
        agenda: [],
        image: "/images/department-placeholder.svg",
      });
  } else if (collection === "committees") {
    row.name = text("name");
    if (form.has("responsibility") || !existing) {
      const description = text("responsibility", false);
      if (description.length > COMMITTEE_DESCRIPTION_MAX_LENGTH)
        throw new Error(
          `Committee description must be ${COMMITTEE_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
        );
      row.responsibility = description;
    }
    for (const key of [
      "chair_id",
      "vice_chair_id",
      "member_1_id",
      "member_2_id",
      "member_3_id",
      "member_4_id",
    ])
      row[key] =
        text(key, key === "chair_id" || key === "vice_chair_id") || null;
    const members = [
      "chair_id",
      "vice_chair_id",
      "member_1_id",
      "member_2_id",
      "member_3_id",
      "member_4_id",
    ]
      .map((k) => row[k])
      .filter(Boolean);
    if (new Set(members).size !== members.length)
      throw new Error(
        "Choose a different official for each committee position.",
      );
    if (!existing) row.chair = "";
  } else {
    row.title = text("title");
    if (collection === "ordinances" || collection === "resolutions") {
      Object.assign(row, {
        number: text("number"),
        date_approved: date("date_approved"),
        year: Number(text("year")),
        author_id: text("author_id"),
        co_author_id: text("co_author_id", false) || null,
        committee_id: text("committee_id"),
        session_id: text("session_id"),
        summary: text("summary"),
      });
      if (
        !Number.isInteger(row.year) ||
        row.year !== Number(String(row.date_approved).slice(0, 4))
      )
        throw new Error("Year must match the document date.");
      if (row.author_id === row.co_author_id)
        throw new Error("Author and co-author must be different officials.");
      if (!existing)
        Object.assign(row, {
          author: "",
          co_author: null,
          status: "Approved",
          pdf_url: null,
        });
    } else {
      const type = text("document_type");
      if (!isDocumentType(type) || ["ordinance", "resolution"].includes(type))
        throw new Error("Choose a valid document type.");
      if (existing?.document_type && existing.document_type !== type)
        throw new Error("An existing document type cannot be changed.");
      Object.assign(row, {
        document_type: type,
        date: date("date"),
        description: text("description"),
        session_id: type === "executive-order" ? null : text("session_id"),
      });
      if (!existing) Object.assign(row, { category_id: null, file_url: "" });
    }
  }
  return row;
}
