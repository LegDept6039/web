import { getCollection } from "@/lib/content/repository";
export async function getDocumentCategories() {
  return getCollection("documentCategories");
}
export async function getDocuments(categoryId: string) {
  return getCollection("documents", { category_id: categoryId });
}
