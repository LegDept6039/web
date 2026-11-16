import { transparencyDownload } from "@/lib/transparency/download";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return transparencyDownload(request, (await params).id, true);
}
