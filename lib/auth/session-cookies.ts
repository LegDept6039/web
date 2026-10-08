/** Only terminal refresh failures justify removing the browser's session. */
export function invalidRefreshToken(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return (
    error.code === "refresh_token_not_found" ||
    error.code === "refresh_token_already_used"
  );
}
export function sessionCookieName(url: string, name: string): boolean {
  const prefix = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  return (
    name === prefix ||
    (name.startsWith(`${prefix}.`) &&
      /^\d+$/.test(name.slice(prefix.length + 1)))
  );
}
