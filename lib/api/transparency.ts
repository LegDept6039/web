import { getCollection } from "@/lib/content/repository";
export async function getDocumentCategories() {
  return getCollection("documentCategories");
}
export async function getDocuments(categoryId: string) {
  return (await getCollection("documents")).filter(
    (d) => d.categoryId === categoryId,
  );
}
