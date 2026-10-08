import "server-only";
import { readContentConfig } from "@/lib/content/config";
// Auth configuration is independent of whether public content uses mock data.
export function authConfig() {
  if (
    !process.env.SUPABASE_URL?.trim() &&
    !process.env.SUPABASE_PUBLISHABLE_KEY?.trim()
  )
    return null;
  const config = readContentConfig({
    ...process.env,
    CONTENT_SOURCE: "supabase",
  });
  return config.source === "supabase" ? config.supabase : null;
}
