import { ordinances } from "@/data/ordinances";
import { resolutions } from "@/data/resolutions";
import { officials } from "@/data/officials";
import { news } from "@/data/news";
import { sessions } from "@/data/sessions";
import { services } from "@/data/services";
import { programs } from "@/data/programs";
import { departments } from "@/data/departments";
import { committees } from "@/data/committees";
import { hearings } from "@/data/hearings";
// Replace these adapters with validated municipal API requests when available.
export async function getOrdinances() {
  return ordinances;
}
export async function getResolutions() {
  return resolutions;
}
export async function getOfficials() {
  return officials;
}
export async function getNews() {
  return news;
}
export async function getArticle(slug: string) {
  return news.find((article) => article.slug === slug);
}
export async function getSessions() {
  return sessions;
}
export async function getServices() {
  return services;
}
export async function getPrograms() {
  return programs;
}
export async function getDepartments() {
  return departments;
}
export async function getCommittees() {
  return committees;
}
export async function getHearings() {
  return hearings;
}
