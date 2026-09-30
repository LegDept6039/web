import { getCollection } from "@/lib/content/repository";
export async function getOrdinances() {
  return getCollection("ordinances");
}
export async function getResolutions() {
  return getCollection("resolutions");
}
export async function getOfficials() {
  return getCollection("officials");
}
export async function getNews() {
  return getCollection("news");
}
export async function getArticle(slug: string) {
  return (await getNews()).find((article) => article.slug === slug);
}
export async function getSessions() {
  return getCollection("sessions");
}
export async function getServices() {
  return getCollection("services");
}
export async function getPrograms() {
  return getCollection("programs");
}
export async function getDepartments() {
  return getCollection("departments");
}
export async function getCommittees() {
  return getCollection("committees");
}
export async function getHearings() {
  return getCollection("hearings");
}
