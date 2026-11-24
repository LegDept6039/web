export const USERNAME_HELP =
  "Use 3 to 40 characters: letters, numbers, periods, underscores or hyphens. Start with a letter or number.";

/** Usernames are case-insensitive; the database stores their canonical form. */
export function normalizeUsername(input: unknown): string {
  if (typeof input !== "string") throw new Error(USERNAME_HELP);
  const username = input.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username))
    throw new Error(USERNAME_HELP);
  return username;
}
