import { BarangayManagement } from "@/components/admin/BarangayManagement";

export default function Page(props: {
  searchParams: Promise<{ saved?: string; page?: string }>;
}) {
  return <BarangayManagement {...props} basePath="/admin/barangays" />;
}
