/**
 * Admin gate for the /admin analytics dashboard. Admins are listed by email in
 * the ADMIN_EMAILS env var (comma-separated, case-insensitive). If unset, the
 * dashboard is closed to everyone — a safe default with no accidental exposure.
 * Intentionally not a DB role: this is a single-operator tool.
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}
