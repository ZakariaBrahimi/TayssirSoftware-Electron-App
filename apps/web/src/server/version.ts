/** Version of this build, reported by desktops to the cloud (set by the desktop shell). */
export function appVersion() {
  return process.env.TAYSSIR_APP_VERSION || process.env.npm_package_version || "dev";
}

export const VERSION_HEADER = "x-tayssir-version";

/** Reads a client-reported version, keeping it short and printable. */
export function cleanVersion(value: string | null | undefined) {
  const v = value?.trim().slice(0, 32);
  return v && /^[\w.+-]+$/.test(v) ? v : null;
}
