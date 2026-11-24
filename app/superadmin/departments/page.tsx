import { DepartmentManagement } from "@/components/admin/DepartmentManagement";

export default function Departments({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  return <DepartmentManagement searchParams={searchParams} />;
}
