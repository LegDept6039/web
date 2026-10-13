export const BIOGRAPHY_LIMIT = 800;
export function validateBiography(value: string) {
  value = value.replace(/\r\n?/g, "\n");
  if (value.length > BIOGRAPHY_LIMIT)
    throw new Error(
      `Department Head biography must be ${BIOGRAPHY_LIMIT} characters or fewer. Your text has not been shortened; please edit it manually.`,
    );
  return value;
}
