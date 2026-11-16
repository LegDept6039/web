export const STAFF_IDLE_MS = 60 * 60 * 1000;
export const STAFF_SESSION_COOKIE = "portal-staff-session";
export const STAFF_TAB_KEY = "portal-staff-tab";
export const validTabToken = (value: string) => /^[a-f0-9]{64}$/.test(value);
