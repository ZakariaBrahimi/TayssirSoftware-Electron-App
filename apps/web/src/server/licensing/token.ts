import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomInt,
  sign,
  verify,
} from "node:crypto";

/**
 * Signed entitlement tokens (Ed25519). Only the vendor's license server
 * holds the private key; installs embed the public key, so they can verify
 * a token offline but can never mint one.
 *
 * Format: base64url(JSON payload) "." base64url(signature)
 */
export type EntitlementPayload = {
  v: 1;
  /** "license": bought license key. "subscription": linked cloud store. */
  kind: "license" | "subscription";
  /** Device the token was issued for. */
  dev: string;
  plan: string;
  /** License id or store id. */
  ref: string;
  /** Expiry (ms since epoch); null = never. */
  exp: number | null;
  iat: number;
};

const b64url = (buf: Buffer) => buf.toString("base64url");

/** Accepts PEM, or base64 of the PEM (handy for single-line env vars). */
function readKey(material: string) {
  const pem = material.includes("BEGIN")
    ? material
    : Buffer.from(material, "base64").toString("utf8");
  return pem;
}

export function signEntitlement(payload: EntitlementPayload, privateKey: string) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const signature = sign(null, body, createPrivateKey(readKey(privateKey)));
  return `${b64url(body)}.${b64url(signature)}`;
}

export function verifyEntitlement(token: string, publicKey: string): EntitlementPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const data = Buffer.from(body, "base64url");
    const ok = verify(
      null,
      data,
      createPublicKey(readKey(publicKey)),
      Buffer.from(sig, "base64url"),
    );
    if (!ok) return null;
    const payload = JSON.parse(data.toString("utf8")) as EntitlementPayload;
    return payload.v === 1 ? payload : null;
  } catch {
    return null;
  }
}

export function generateSigningKeys() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

// No 0/O/1/I to avoid reading mistakes.
const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateLicenseKey() {
  const group = () =>
    Array.from({ length: 4 }, () => KEY_ALPHABET[randomInt(KEY_ALPHABET.length)]).join("");
  return `MIZN-${group()}-${group()}-${group()}-${group()}`;
}

export const hashSecret = (value: string) => createHash("sha256").update(value).digest("hex");
