/**
 * Who may use the platform console (cloud mode): accounts with the
 * "platform" role, no store, AND listed in PLATFORM_ADMINS. Requiring both
 * means a database leak or a misconfigured user alone grants nothing.
 */
export const PLATFORM_ROLE = "platform";

export function platformAdminUsernames() {
  return new Set(
    (process.env.PLATFORM_ADMINS ?? "")
      .split(",")
      .map((u) => u.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isPlatformAdmin(u: {
  role?: string | null;
  username?: string | null;
  storeId?: string | null;
}) {
  return (
    u.role === PLATFORM_ROLE &&
    !u.storeId &&
    Boolean(u.username) &&
    platformAdminUsernames().has(u.username!.toLowerCase())
  );
}

/** Currency used for platform payments and revenue figures. */
export function platformCurrency() {
  return (process.env.PLATFORM_CURRENCY || "DZD").toUpperCase();
}

/** Who performed an action, for the audit log. */
export type Actor = { id: string | null; name: string; ip?: string | null };

export const CLI_ACTOR: Actor = { id: null, name: "CLI" };
