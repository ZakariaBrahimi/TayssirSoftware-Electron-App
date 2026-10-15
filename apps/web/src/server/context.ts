/** Who is acting, and on which store. Passed to every service call. */
export type Ctx = {
  storeId: string;
  userId: string | null;
  userName: string | null;
};

/**
 * Deployment mode:
 * - "local": one store per install (desktop app or self-hosted shop server),
 *   first-run setup, offline license, optional sync to a cloud store.
 * - "cloud": multi-store SaaS with public sign-up and subscriptions; also
 *   the license and sync server for desktop installs.
 */
export type Mode = "local" | "cloud";

export function getMode(): Mode {
  return process.env.TAYSSIR_MODE === "cloud" ? "cloud" : "local";
}
