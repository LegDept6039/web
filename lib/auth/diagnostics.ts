import { createHash } from "node:crypto";

// Never pass credentials, session objects, user objects or request headers here.
export function authDiagnostic(
  stage: string,
  values: {
    outcome: string;
    userId?: string;
    code?: string;
    databaseMessage?: string;
    status?: number;
    sessionPresent?: boolean;
    profilePresent?: boolean;
    active?: boolean;
    role?: string;
    membershipCount?: number;
  },
) {
  const debug = process.env.AUTH_DEBUG === "true";
  if (!debug && values.outcome === "ok") return;
  const { userId, ...safe } = values;
  console.info(
    "[portal-auth]",
    JSON.stringify({
      stage,
      ...safe,
      userFingerprint: userId
        ? createHash("sha256").update(userId).digest("hex").slice(0, 12)
        : undefined,
      projectFingerprint: process.env.SUPABASE_URL
        ? createHash("sha256")
            .update(process.env.SUPABASE_URL.trim().replace(/\/$/, ""))
            .digest("hex")
            .slice(0, 12)
        : undefined,
    }),
  );
}

export function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error))
    return undefined;
  const code = String(error.code);
  return /^[a-zA-Z0-9_]{1,64}$/.test(code) ? code : undefined;
}

export function passwordError(error: { code?: string; status?: number }) {
  switch (error.code) {
    case "invalid_credentials":
      return "Unable to sign in. Invalid email or password.";
    case "email_not_confirmed":
      return "Unable to sign in. Confirm your email address first.";
    case "user_banned":
      return "Unable to sign in. This authentication account is disabled.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many sign-in attempts. Please try again later.";
    default:
      return `Unable to sign in. The authentication service rejected the request${errorCode(error) ? ` (${errorCode(error)})` : ""}. Please try again or contact your administrator.`;
  }
}

// Only database SELECT errors with recognized PostgreSQL/PostgREST codes qualify.
// Exclude response details, hints, headers and arbitrary Auth/transport objects.
export function databaseMessage(error: {
  code?: string;
  message?: string;
}): string | undefined {
  if (!/^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/.test(error.code || ""))
    return undefined;
  return error.message
    ?.replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[redacted-key]")
    .replace(
      /[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g,
      "[redacted-token]",
    )
    .replace(/https?:\/\/\S+/g, "[redacted-url]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(
      /(?:password|access_token|refresh_token|secret)\s*[:=]\s*[^\s,;]+/gi,
      "[redacted-credential]",
    )
    .slice(0, 400);
}
