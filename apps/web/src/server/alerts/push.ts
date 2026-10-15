import { createSign } from "node:crypto";

/*
 * Push notifications to the Android app through Firebase Cloud Messaging
 * (HTTP v1). The platform owner creates a Firebase project and sets
 * FIREBASE_SERVICE_ACCOUNT to its service account key (JSON, or base64).
 */

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

export function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  try {
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const account = JSON.parse(json) as ServiceAccount;
    return account.project_id && account.client_email && account.private_key ? account : null;
  } catch {
    return null;
  }
}

export const pushAvailable = () => serviceAccount() !== null;

const b64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

/** Signed JWT asking Google for a messaging access token. */
export function assertion(account: ServiceAccount, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: account.token_uri ?? "https://oauth2.googleapis.com/token",
      iat,
      exp: iat + 3600,
    }),
  );
  const signature = createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(account.private_key.replace(/\\n/g, "\n"));
  return `${header}.${claims}.${b64url(signature)}`;
}

let cached: { token: string; expires: number } | null = null;

async function accessToken(account: ServiceAccount, fetcher: typeof fetch) {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const res = await fetcher(account.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: assertion(account),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
  } | null;
  if (!res.ok || !data?.access_token) throw new Error(`Firebase auth failed (HTTP ${res.status})`);
  cached = { token: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/** Thrown when the phone uninstalled the app or the token expired. */
export class PushGoneError extends Error {}

export async function sendPush(
  token: string,
  message: { title: string; body: string; url?: string },
  fetcher: typeof fetch = fetch,
) {
  const account = serviceAccount();
  if (!account) throw new Error("Push notifications are not configured");
  const res = await fetcher(
    `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${await accessToken(account, fetcher)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: message.title, body: message.body },
          data: message.url ? { url: message.url } : {},
          android: { priority: "high", notification: { channel_id: "stock" } },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (res.ok) return;
  const error = (await res.json().catch(() => null)) as {
    error?: { status?: string; details?: { errorCode?: string }[] };
  } | null;
  const code = error?.error?.details?.find((d) => d.errorCode)?.errorCode ?? error?.error?.status;
  if (res.status === 404 || code === "UNREGISTERED" || code === "NOT_FOUND") {
    throw new PushGoneError(code ?? "UNREGISTERED");
  }
  throw new Error(`Push failed (HTTP ${res.status}${code ? `, ${code}` : ""})`);
}

/** For tests: forget the cached access token. */
export const resetPushToken = () => {
  cached = null;
};
