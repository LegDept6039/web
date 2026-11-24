import { officeContext } from "@/lib/offices/server";
import { DepartmentContentList } from "@/components/admin/DepartmentContentList";

export default async function Branches({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; office?: string; saved?: string }>;
}) {
  const context = await officeContext();
  const filters = await searchParams;
  return (
    <DepartmentContentList
      context={context}
      mode="branches"
      office={filters.office}
      filters={filters}
    />
  );
}
