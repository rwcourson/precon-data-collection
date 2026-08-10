import type { Role, User } from "@/db/schema";

/**
 * Hard-coded platform super admins. These accounts always resolve to
 * corporate_admin with corporate (all-region) scope, regardless of Entra groups.
 * Env SUPER_ADMIN_EMAILS can add more (comma-separated).
 */
const BUILTIN_SUPER_ADMINS = ["rcourson@brasfieldgorrie.com"] as const;

export function superAdminEmails(): Set<string> {
  const fromEnv = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...BUILTIN_SUPER_ADMINS, ...fromEnv]);
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return superAdminEmails().has(email.trim().toLowerCase());
}

export function isSuperAdmin(user: Pick<User, "email" | "role">): boolean {
  return isSuperAdminEmail(user.email);
}

/** Super admins and Corporate Precon Admins. */
export function isCorporateAdmin(user: Pick<User, "email" | "role">): boolean {
  return isSuperAdmin(user) || user.role === "corporate_admin";
}

export const SUPER_ADMIN_ROLE: Role = "corporate_admin";
export const SUPER_ADMIN_TITLE = "Platform Super Admin";
