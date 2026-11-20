import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/lib/auth/config";
import {
  invalidRefreshToken,
  sessionCookieName,
} from "@/lib/auth/session-cookies";
import { authDiagnostic, errorCode } from "@/lib/auth/diagnostics";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = authConfig();
  if (config) {
    const originalSessionCookies = request.cookies
      .getAll()
      .filter((c) => sessionCookieName(config.url, c.name));
    const client = createServerClient(config.url, config.key, {
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values, headers) {
          values.forEach(({ name, value, options }) => {
            if (options.maxAge === 0) request.cookies.delete(name);
            else request.cookies.set(name, value);
          });
          const previousCookies = response.cookies.getAll();
          response = NextResponse.next({ request });
          previousCookies.forEach((cookie) => response.cookies.set(cookie));
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    });
    // Verify/refresh before rendering. Pages and actions independently authorize.
    let refreshError: unknown;
    try {
      const { error } = await client.auth.getUser();
      if (invalidRefreshToken(error)) refreshError = error;
    } catch (error) {
      if (!invalidRefreshToken(error)) throw error;
      refreshError = error;
    }
    if (refreshError) {
      // Remove all original chunks even if the SDK already removed some in setAll.
      // Downstream rendering and the browser must both see an anonymous session.
      const names = new Set(
        [
          ...originalSessionCookies,
          ...request.cookies
            .getAll()
            .filter((c) => sessionCookieName(config.url, c.name)),
        ].map((c) => c.name),
      );
      names.forEach((name) => request.cookies.delete(name));
      const previousCookies = response.cookies.getAll();
      response = NextResponse.next({ request });
      previousCookies.forEach((cookie) => response.cookies.set(cookie));
      names.forEach((name) =>
        response.cookies.set(name, "", {
          path: "/",
          maxAge: 0,
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        }),
      );
      authDiagnostic("refresh", {
        outcome: "stale_session_cleared",
        code: errorCode(refreshError),
      });
    }
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
export const config = {
  matcher: [
    "/login",
    "/change-password",
    "/admin/:path*",
    "/account/:path*",
    "/superadmin/:path*",
  ],
};
