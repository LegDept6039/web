import type { Collection } from "@/lib/content/schema";
/** Branch collection availability, not configurable per-user module permissions. */
export function branchAllows(branch: string, collection: Collection) {
  return (
    branch === "legislative" ||
    (branch === "executive" &&
      ["departments", "news", "programs", "contacts"].includes(collection))
  );
}
