export interface ContentRecord {
  isSample?: boolean;
}
export interface Official extends ContentRecord {
  termId?: string;
  legislativeRole?: import("@/lib/officials/roles").LegislativeRole;
  id: string;
  name: string;
  role: string;
  photoUrl?: string;
  branch: "executive" | "legislative";
  description: string;
}
export interface LegislativeDocument extends ContentRecord {
  termId?: string;
  authorId?: string;
  coAuthorId?: string;
  committeeId?: string;
  sessionId?: string;
  committeeName?: string;
  sessionName?: string;
  id: string;
  number: string;
  title: string;
  dateApproved: string;
  year: number;
  author: string;
  coAuthor?: string;
  status: string;
  summary: string;
  pdfUrl?: string;
}
export type Ordinance = LegislativeDocument;
export type Resolution = LegislativeDocument;
export interface NewsArticle extends ContentRecord {
  richBody?: import("@/lib/content/rich-text").RichNode;
  id?: string;
  source?: { name: string; slug?: string };
  officeId?: string;
  contentScope?: "executive" | "legislative";
  slug: string;
  title: string;
  category: string;
  date: string;
  excerpt: string;
  image: string;
  content: string[];
}
export interface Session extends ContentRecord {
  termId?: string;
  name?: string;
  id: string;
  number: string;
  type: "Regular session" | "Special session" | "Caucus meeting";
  date: string;
  description: string;
  agenda: string[];
  image: string;
}
export interface Service extends ContentRecord {
  body?: string;
  officeId?: string;
  contentScope?: "executive" | "legislative";
  id: string;
  name: string;
  description: string;
  icon: string;
  office: string;
  steps: string[];
}
export interface Department extends ContentRecord {
  acronym?: string;
  body?: string;
  imageUrl?: string;
  active?: boolean;
  headDescription?: string;
  slug?: string;
  headName?: string;
  headTitle?: string;
  headPhoto?: string;
  officeId?: string;
  contentScope?: "executive" | "legislative";
  id: string;
  name: string;
  description: string;
}
export interface Program extends ContentRecord {
  richBody?: import("@/lib/content/rich-text").RichNode;
  source?: { name: string; slug?: string };
  slug?: string;
  image?: string;
  officeId?: string;
  contentScope?: "executive" | "legislative";
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
}
export interface Committee extends ContentRecord {
  termId?: string;
  chairId?: string;
  viceChairId?: string;
  member1Id?: string;
  member2Id?: string;
  member3Id?: string;
  member4Id?: string;
  id: string;
  name: string;
  responsibility: string;
  chair: string;
}
export interface Hearing extends ContentRecord {
  id: string;
  title: string;
  date: string;
  venue: string;
  sectors: string;
  relatedOrdinance: string;
  status: "Upcoming" | "Previous";
}

export interface DocumentCategory extends ContentRecord {
  contentScope?: "executive" | "legislative" | "transparency";
  id: string;
  name: string;
  description: string;
  href?: string;
}
export interface MunicipalDocument extends ContentRecord {
  termId?: string;
  reportFrequency?: "annual" | "quarterly";
  reportYear?: number;
  annualPdfPath?: string;
  q1PdfPath?: string;
  q2PdfPath?: string;
  q3PdfPath?: string;
  q4PdfPath?: string;
  contentScope?: "executive" | "legislative" | "transparency";
  attachmentPath?: string;
  documentType?: "agenda" | "minutes" | "executive-order";
  sessionId?: string;
  id: string;
  categoryId?: string;
  title: string;
  description: string;
  date: string;
  fileUrl?: string;
}

export interface DepartmentContact extends ContentRecord {
  id: string;
  officeId: string;
  contentScope: "executive" | "legislative";
  type: "PHONE" | "LANDLINE" | "EMAIL" | "LOCATION" | "SOCIAL";
  value: string;
  label?: string;
}
