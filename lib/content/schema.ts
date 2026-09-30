import type {
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
  fields: { [P in keyof T]-?: Field };
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
  officials: {
    table: "officials",
    key: "id",
    fields: {
      id: text("id"),
      name: text("name"),
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
    key: "slug",
    fields: {
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
      id: text("id"),
      categoryId: text("category_id"),
      title: text("title"),
      description: text("description"),
      date: date("date"),
      fileUrl: url("file_url"),
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
  const row = input as Record<string, unknown>;
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
  // Every domain field was validated against its collection's typed definition above.
  return output as unknown as Collections[K];
}
