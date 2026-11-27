import { validateRichText } from "./rich-text";
import {
  departmentContactTypes,
  validateSocialContact,
} from "./department-contact";
import { legislativeRoles } from "@/lib/officials/roles";
import { documentApprovalModes } from "@/lib/legislative/approval";
import type {
  DepartmentContact,
  Official,
  Ordinance,
  Resolution,
  NewsArticle,
  Session,
  Service,
  Department,
  Program,
  Committee,
  Hearing,
  DocumentCategory,
  MunicipalDocument,
} from "@/types";
export interface Collections {
  contacts: DepartmentContact;
  officials: Official;
  ordinances: Ordinance;
  resolutions: Resolution;
  news: NewsArticle;
  sessions: Session;
  services: Service;
  departments: Department;
  programs: Program;
  committees: Committee;
  hearings: Hearing;
  documentCategories: DocumentCategory;
  documents: MunicipalDocument;
}
export type Collection = keyof Collections;
type Field = {
  column: string;
  kind: "text" | "integer" | "boolean" | "list" | "date" | "url";
  optional?: boolean;
  values?: readonly string[];
};
type Definition<T> = {
  table: string;
  key: string;
  fields: {
    [
      P in keyof Omit<
        T,
        "source" | "richBody" | "committeeName" | "sessionName" | "formUrl"
      >
    ]-?: Field;
  };
};
const text = (column: string): Field => ({ column, kind: "text" });
const url = (column: string, optional = false): Field => ({
  column,
  kind: "url",
  optional,
});
const date = (column: string): Field => ({ column, kind: "date" });
const list = (column: string): Field => ({ column, kind: "list" });
const sample: Field = { column: "is_sample", kind: "boolean" };
const documentFields = {
  officeId: { ...text("office_id"), optional: true },
  contentScope: {
    ...text("content_scope"),
    optional: true,
    values: ["executive", "legislative"],
  },
  approvalMode: {
    ...text("approval_mode"),
    optional: true,
    values: [...documentApprovalModes],
  },
  termId: { ...text("term_id"), optional: true },
  authorId: { ...text("author_id"), optional: true },
  coAuthorId: { ...text("co_author_id"), optional: true },
  committeeId: { ...text("committee_id"), optional: true },
  sessionId: { ...text("session_id"), optional: true },
  id: text("id"),
  number: text("number"),
  title: text("title"),
  dateApproved: date("date_approved"),
  year: { column: "year", kind: "integer" } as Field,
  author: text("author"),
  coAuthor: { ...text("co_author"), optional: true },
  status: text("status"),
  summary: text("summary"),
  pdfUrl: url("pdf_url", true),
  isSample: sample,
};
export const definitions: { [K in Collection]: Definition<Collections[K]> } = {
  contacts: {
    table: "department_contacts",
    key: "id",
    fields: {
      id: text("id"),
      officeId: text("office_id"),
      contentScope: {
        ...text("content_scope"),
        values: ["executive", "legislative"],
      },
      type: {
        ...text("type"),
        values: Object.keys(departmentContactTypes),
      },
      value: text("value"),
      label: { ...text("label"), optional: true },
      isSample: sample,
    },
  },
  officials: {
    table: "officials",
    key: "id",
    fields: {
      termId: { ...text("term_id"), optional: true },
      id: text("id"),
      name: text("name"),
      legislativeRole: {
        ...text("legislative_role"),
        optional: true,
        values: Object.keys(legislativeRoles),
      },
      role: text("role"),
      branch: { ...text("branch"), values: ["executive", "legislative"] },
      description: text("description"),
      photoUrl: url("photo_url", true),
      isSample: sample,
    },
  },
  ordinances: { table: "ordinances", key: "id", fields: documentFields },
  resolutions: { table: "resolutions", key: "id", fields: documentFields },
  news: {
    table: "news",
    key: "id",
    fields: {
      galleryImages: { ...list("gallery_images"), optional: true },
      id: { ...text("id"), optional: true },
      officeId: { ...text("office_id"), optional: true },
      barangayId: { ...text("barangay_id"), optional: true },
      contentScope: {
        ...text("content_scope"),
        optional: true,
        values: ["executive", "legislative"],
      },
      slug: text("slug"),
      title: text("title"),
      category: text("category"),
      date: date("date"),
      excerpt: text("excerpt"),
      image: url("image"),
      content: list("content"),
      isSample: sample,
    },
  },
  sessions: {
    table: "sessions",
    key: "id",
    fields: {
      officeId: { ...text("office_id"), optional: true },
      contentScope: {
        ...text("content_scope"),
        optional: true,
        values: ["executive", "legislative"],
      },
      termId: { ...text("term_id"), optional: true },
      name: { ...text("name"), optional: true },
      id: text("id"),
      number: text("number"),
      type: {
        ...text("type"),
        values: ["Regular session", "Special session", "Caucus meeting"],
      },
      date: date("date"),
      description: text("description"),
      agenda: list("agenda"),
      image: url("image"),
      isSample: sample,
    },
  },
  services: {
    table: "services",
    key: "id",
    fields: {
      formName: { ...text("form_name"), optional: true },
      body: { ...text("body"), optional: true },
      officeId: { ...text("office_id"), optional: true },
      contentScope: {
        ...text("content_scope"),
        optional: true,
        values: ["executive", "legislative"],
      },
      id: text("id"),
      name: text("name"),
      description: text("description"),
      icon: text("icon"),
      office: text("office"),
      steps: list("steps"),
      isSample: sample,
    },
  },
  departments: {
    table: "departments",
    key: "id",
    fields: {
      parentDepartmentId: { ...text("parent_department_id"), optional: true },
      acronym: { ...text("short_name"), optional: true },
      body: { ...text("body"), optional: true },
      imageUrl: url("image_url", true),
      active: { column: "active", kind: "boolean", optional: true },
      headDescription: { ...text("head_description"), optional: true },
      slug: { ...text("slug"), optional: true },
      headName: { ...text("head_name"), optional: true },
      headTitle: { ...text("head_title"), optional: true },
      headPhoto: url("head_photo", true),
      showHeadPhotoOnPage: {
        column: "show_head_photo_on_page",
        kind: "boolean",
        optional: true,
      },
      officeId: { ...text("office_id"), optional: true },
      contentScope: {
        ...text("content_scope"),
        optional: true,
        values: ["executive", "legislative"],
      },
      id: text("id"),
      name: text("name"),
      description: text("description"),
      isSample: sample,
    },
  },
  programs: {
    table: "programs",
    key: "id",
    fields: {
      galleryImages: { ...list("gallery_images"), optional: true },
      slug: { ...text("slug"), optional: true },
      image: url("image", true),
      officeId: { ...text("office_id"), optional: true },
      contentScope: {
        ...text("content_scope"),
        optional: true,
        values: ["executive", "legislative"],
      },
      id: text("id"),
      name: text("name"),
      description: text("description"),
      category: text("category"),
      status: text("status"),
      isSample: sample,
    },
  },
  committees: {
    table: "committees",
    key: "id",
    fields: {
      termId: { ...text("term_id"), optional: true },
      chairId: { ...text("chair_id"), optional: true },
      viceChairId: { ...text("vice_chair_id"), optional: true },
      member1Id: { ...text("member_1_id"), optional: true },
      member2Id: { ...text("member_2_id"), optional: true },
      member3Id: { ...text("member_3_id"), optional: true },
      member4Id: { ...text("member_4_id"), optional: true },
      id: text("id"),
      name: text("name"),
      responsibility: text("responsibility"),
      chair: text("chair"),
      isSample: sample,
    },
  },
  hearings: {
    table: "hearings",
    key: "id",
    fields: {
      id: text("id"),
      title: text("title"),
      date: date("date"),
      venue: text("venue"),
      sectors: text("sectors"),
      relatedOrdinance: text("related_ordinance"),
      status: { ...text("status"), values: ["Upcoming", "Previous"] },
      isSample: sample,
    },
  },
  documentCategories: {
    table: "document_categories",
    key: "id",
    fields: {
      contentScope: {
        ...text("content_scope"),
        optional: true,
        values: ["executive", "legislative", "transparency"],
      },
      id: text("id"),
      name: text("name"),
      description: text("description"),
      href: url("href", true),
      isSample: sample,
    },
  },
  documents: {
    table: "municipal_documents",
    key: "id",
    fields: {
      officeId: { ...text("office_id"), optional: true },
      termId: { ...text("term_id"), optional: true },
      contentScope: {
        ...text("content_scope"),
        optional: true,
        values: ["executive", "legislative", "transparency"],
      },
      attachmentPath: { ...text("attachment_path"), optional: true },
      reportFrequency: {
        ...text("report_frequency"),
        optional: true,
        values: ["annual", "quarterly"],
      },
      reportYear: { column: "report_year", kind: "integer", optional: true },
      annualPdfPath: { ...text("annual_pdf_path"), optional: true },
      q1PdfPath: { ...text("q1_pdf_path"), optional: true },
      q2PdfPath: { ...text("q2_pdf_path"), optional: true },
      q3PdfPath: { ...text("q3_pdf_path"), optional: true },
      q4PdfPath: { ...text("q4_pdf_path"), optional: true },
      id: text("id"),
      categoryId: { ...text("category_id"), optional: true },
      documentType: {
        ...text("document_type"),
        optional: true,
        values: ["agenda", "minutes", "executive-order"],
      },
      sessionId: { ...text("session_id"), optional: true },
      title: text("title"),
      description: text("description"),
      date: date("date"),
      fileUrl: url("file_url", true),
      isSample: sample,
    },
  },
};
export function isSafeContentUrl(value: string): boolean {
  if (/[\\\s\u0000-\u001f]/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
export function decodeRecord<K extends Collection>(
  collection: K,
  input: unknown,
): Collections[K] {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error(`Invalid ${collection} record.`);
  const row = { ...input } as Record<string, unknown>;
  for (const [fk, join, target] of [
    ["author_id", "author_record", "author"],
    ["co_author_id", "co_author_record", "co_author"],
    ["chair_id", "chair_record", "chair"],
  ]) {
    if (row[fk])
      row[target] = (row[join] as { name?: string } | null)?.name || "";
  }
  if (row.author_id && !row.co_author_id) row.co_author = null;
  const output: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(
    definitions[collection].fields,
  ) as [string, Field][]) {
    const value = row[field.column];
    if (
      (value === null || value === undefined || value === "") &&
      field.optional
    )
      continue;
    let valid: boolean;
    switch (field.kind) {
      case "integer":
        valid = typeof value === "number" && Number.isSafeInteger(value);
        break;
      case "boolean":
        valid = typeof value === "boolean";
        break;
      case "list":
        valid =
          Array.isArray(value) && value.every((v) => typeof v === "string");
        break;
      case "date":
        valid =
          typeof value === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(value) &&
          !Number.isNaN(Date.parse(value)) &&
          new Date(value).toISOString().startsWith(value);
        break;
      case "url":
        valid = typeof value === "string" && isSafeContentUrl(value);
        break;
      default:
        valid = typeof value === "string";
    }
    if (field.values) valid = valid && field.values.includes(String(value));
    if (!valid)
      throw new Error(
        `Invalid ${collection}.${field.column}. Check this field in Supabase.`,
      );
    output[name] = value;
  }
  if (
    ["news", "programs"].includes(collection) &&
    row.source &&
    typeof row.source === "object"
  ) {
    const source = row.source as Record<string, unknown>;
    if (typeof source.name === "string")
      output.source = {
        name: source.name,
        ...(typeof source.slug === "string" &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.slug)
          ? { slug: source.slug }
          : {}),
      };
  }
  if (
    ["news", "programs", "services"].includes(collection) &&
    row.rich_body != null
  )
    output.richBody = validateRichText(row.rich_body);
  if (["news", "programs"].includes(collection) && output.galleryImages) {
    const images = output.galleryImages as string[];
    if (images.length > 12 || images.some((image) => !isSafeContentUrl(image)))
      throw new Error("Invalid gallery photos. Check this record in Supabase.");
  }
  if (
    collection === "services" &&
    typeof row.form_path === "string" &&
    row.form_path
  )
    output.formUrl = `/services/files/${encodeURIComponent(String(output.id))}`;
  for (const [join, key] of [
    ["committee_record", "committeeName"],
    ["session_record", "sessionName"],
  ]) {
    const relation = row[join] as { name?: string; number?: string } | null;
    if (relation) output[key] = relation.name || relation.number;
  }
  if (collection === "contacts" && output.type === "SOCIAL")
    validateSocialContact(
      output.value as string,
      output.label as string | undefined,
    );
  // Every domain field was validated against its collection's typed definition above.
  return output as unknown as Collections[K];
}
