import { DepartmentManagement } from "@/components/admin/DepartmentManagement";

export default function Branches({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  return <DepartmentManagement searchParams={searchParams} branches />;
}
