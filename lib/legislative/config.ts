import type { Collection } from "@/lib/content/schema";
export const documentTypes = {
  ordinance: "Ordinance",
  resolution: "Resolution",
  agenda: "Agenda",
  minutes: "Minutes",
  "executive-order": "Executive Order (EO)",
} as const;
export type DocumentType = keyof typeof documentTypes;
export const isDocumentType = (value: string): value is DocumentType =>
  Object.hasOwn(documentTypes, value);
export const documentCollection = (type: DocumentType): Collection =>
  type === "ordinance"
    ? "ordinances"
    : type === "resolution"
      ? "resolutions"
      : "documents";
export const isDocumentCollection = (collection: Collection) =>
  ["ordinances", "resolutions", "documents"].includes(collection);
export const usesLegislativeFields = (collection: Collection) =>
  ["sessions", "committees", "ordinances", "resolutions", "documents"].includes(
    collection,
  );
export interface RelationOption {
  id: string;
  name: string;
}
export interface LegislativeOptions {
  officials: RelationOption[];
  committees: RelationOption[];
  sessions: RelationOption[];
}
export const emptyOptions: LegislativeOptions = {
  officials: [],
  committees: [],
  sessions: [],
};
export const COMMITTEE_DESCRIPTION_MAX_LENGTH = 500;
