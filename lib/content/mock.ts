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
import { documentCategories } from "@/data/transparency";
import type { Collection, Collections } from "./schema";
export const mockCollections: { [K in Collection]: Collections[K][] } = {
  ordinances,
  resolutions,
  officials,
  news,
  sessions,
  services,
  programs,
  departments,
  committees,
  hearings,
  documentCategories,
  documents: [],
};
export function readMockCollection<K extends Collection>(
  collection: K,
): Collections[K][] {
  return mockCollections[collection].map((row) => ({ ...row, isSample: true }));
}
