import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readContentConfig } from "@/lib/content/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = readContentConfig(process.env);
  if (config.source === "supabase") {
    const client = createServerClient(
      config.supabase.url,
      config.supabase.key,
      {
        cookieOptions: {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
        },
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(values, headers) {
            values.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({ request });
            values.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
            Object.entries(headers).forEach(([key, value]) =>
              response.headers.set(key, value),
            );
          },
        },
      },
    );
    // Verify/refresh before rendering. Pages and actions independently authorize.
    await client.auth.getUser();
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
export const config = {
  matcher: ["/login", "/admin/:path*", "/account/:path*"],
};
