export interface Official {
  id: string;
  name: string;
  role: string;
  branch: "executive" | "legislative";
  description: string;
}
export interface LegislativeDocument {
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
export interface NewsArticle {
  slug: string;
  title: string;
  category: string;
  date: string;
  excerpt: string;
  image: string;
  content: string[];
}
export interface Session {
  id: string;
  number: string;
  type: "Regular session" | "Special session" | "Caucus meeting";
  date: string;
  description: string;
  agenda: string[];
  image: string;
}
export interface Service {
  id: string;
  name: string;
  description: string;
  icon: string;
  office: string;
  steps: string[];
}
export interface Department {
  id: string;
  name: string;
  description: string;
}
export interface Program {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
}
export interface Committee {
  id: string;
  name: string;
  responsibility: string;
  chair: string;
}
export interface Hearing {
  id: string;
  title: string;
  date: string;
  venue: string;
  sectors: string;
  relatedOrdinance: string;
  status: "Upcoming" | "Previous";
}
