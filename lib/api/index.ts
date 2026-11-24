import { readContentConfig } from "@/lib/content/config";
import { getCollection } from "@/lib/content/repository";
import type { Department } from "@/types";
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
  const [news, departments] = await Promise.all([
    getCollection("news"),
    getDepartments(),
  ]);
  return news.map((article) => {
    const department = article.officeId
      ? departments.find((d) => d.officeId === article.officeId)
      : undefined;
    return {
      ...article,
      source:
        article.source ||
        (department
          ? { name: department.name, slug: department.slug || department.id }
          : {
              name:
                article.contentScope === "legislative"
                  ? "Legislative Access"
                  : "Municipal information portal",
            }),
    };
  });
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
export async function getProgram(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return undefined;
  return (await getCollection("programs", { slug })).find(
    (p) => (p.slug || p.id) === slug,
  );
}
export async function getDepartments() {
  const departments = (await getCollection("departments")).filter(
    isPublicExecutiveDepartment,
  );
  const parentIds = new Set(
    departments.filter((d) => !d.parentDepartmentId).map((d) => d.id),
  );
  return departments.filter(
    (d) => !d.parentDepartmentId || parentIds.has(d.parentDepartmentId),
  );
}
function isPublicExecutiveDepartment(d: Department) {
  return d.contentScope !== "legislative" && d.active !== false;
}
export async function getDepartmentParent(department: Department) {
  if (!department.parentDepartmentId) return undefined;
  const parent = (
    await getCollection("departments", { id: department.parentDepartmentId })
  ).find((d) => d.id === department.parentDepartmentId);
  return parent &&
    isPublicExecutiveDepartment(parent) &&
    !parent.parentDepartmentId
    ? parent
    : undefined;
}
async function publicDepartment(department?: Department) {
  if (!department || !isPublicExecutiveDepartment(department)) return undefined;
  if (department.parentDepartmentId && !(await getDepartmentParent(department)))
    return undefined;
  return department;
}
export async function getDepartmentBranches(parentId: string) {
  const parent = (await getCollection("departments", { id: parentId })).find(
    (d) => d.id === parentId,
  );
  if (
    !parent ||
    !isPublicExecutiveDepartment(parent) ||
    parent.parentDepartmentId
  )
    return [];
  return (
    await getCollection("departments", { parent_department_id: parentId })
  ).filter(
    (d) => isPublicExecutiveDepartment(d) && d.parentDepartmentId === parentId,
  );
}
export async function getDepartmentContactDirectory() {
  const [departments, contacts] = await Promise.all([
    getDepartments(),
    getCollection("contacts", { content_scope: "executive" }),
  ]);
  const contactsByOffice = new Map<string, typeof contacts>();
  for (const contact of contacts) {
    if (!contact.value.trim()) continue;
    const entries = contactsByOffice.get(contact.officeId) || [];
    entries.push(contact);
    contactsByOffice.set(contact.officeId, entries);
  }
  return departments.flatMap((department) => {
    const entries = contactsByOffice.get(department.officeId || department.id);
    return entries?.length ? [{ department, contacts: entries }] : [];
  });
}
export async function getCommittees() {
  return getCollection("committees");
}
export async function getHearings() {
  return getCollection("hearings");
}

export async function getDepartment(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return undefined;
  const departments = await getCollection("departments", { slug });
  const current = departments.find((d) => (d.slug || d.id) === slug);
  if (current) return publicDepartment(current);
  const config = readContentConfig(process.env);
  if (config.source !== "supabase" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    return undefined;
  const params = new URLSearchParams({
    select: "department_id",
    slug: `eq.${slug}`,
    limit: "1",
  });
  const response = await fetch(
    `${config.supabase.url}/rest/v1/department_slug_aliases?${params}`,
    {
      headers: { apikey: config.supabase.key },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new Error("Department aliases are unavailable. Apply migration 009.");
  const aliases = await response.json();
  const id = aliases[0]?.department_id;
  if (typeof id !== "string") return undefined;
  return publicDepartment((await getCollection("departments", { id }))[0]);
}
export async function getDepartmentContent(officeId?: string) {
  if (!officeId) return { news: [], programs: [], contacts: [], services: [] };
  const [news, programs, contacts, services] = await Promise.all([
    getCollection("news", { office_id: officeId }),
    getCollection("programs", { office_id: officeId }),
    getCollection("contacts", { office_id: officeId }),
    getCollection("services", {
      office_id: officeId,
      content_scope: "executive",
    }),
  ]);
  return {
    services: services.filter(
      (s) => s.officeId === officeId && s.contentScope === "executive",
    ),
    contacts: contacts.filter((c) => c.officeId === officeId),
    news: news.filter(
      (n) => n.officeId === officeId && n.contentScope !== "legislative",
    ),
    programs: programs.filter(
      (p) => p.officeId === officeId && p.contentScope !== "legislative",
    ),
  };
}
