export interface ContentRecord {
  isSample?: boolean;
}
export interface Official extends ContentRecord {
  id: string;
  name: string;
  role: string;
  photoUrl?: string;
  branch: "executive" | "legislative";
  description: string;
}
export interface LegislativeDocument extends ContentRecord {
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
  slug: string;
  title: string;
  category: string;
  date: string;
  excerpt: string;
  image: string;
  content: string[];
}
export interface Session extends ContentRecord {
  id: string;
  number: string;
  type: "Regular session" | "Special session" | "Caucus meeting";
  date: string;
  description: string;
  agenda: string[];
  image: string;
}
export interface Service extends ContentRecord {
  id: string;
  name: string;
  description: string;
  icon: string;
  office: string;
  steps: string[];
}
export interface Department extends ContentRecord {
  id: string;
  name: string;
  description: string;
}
export interface Program extends ContentRecord {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
}
export interface Committee extends ContentRecord {
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
  id: string;
  name: string;
  description: string;
  href?: string;
}
export interface MunicipalDocument extends ContentRecord {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  date: string;
  fileUrl: string;
}
