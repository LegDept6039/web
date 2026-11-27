import { serviceFormDownload } from "@/lib/services/form-download";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return serviceFormDownload((await params).id);
}
