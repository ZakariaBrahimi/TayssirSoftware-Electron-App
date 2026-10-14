import { generateKeyPairSync, createVerify } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeDb, makeProduct, makeStore } from "@/test/helpers";
import type { Ctx } from "../context";
import type { Database } from "../db/client";
import { pushDevices } from "../db/schema";
import { PushGoneError, assertion, resetPushToken, sendPush, serviceAccount } from "./push";
import { registerDevice, sendDigest } from "./service";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const account = {
  project_id: "mizan-test",
  client_email: "push@mizan-test.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};

/** Fake Google endpoints: an access token, then FCM answers. */
function fakeFetch(fcm: (body: { message: { token: string } }) => Response) {
  const calls: { url: string; body: string }[] = [];
  const fetcher = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body ?? "") });
    if (String(url).includes("oauth2")) {
      return new Response(JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }));
    }
    return fcm(JSON.parse(String(init?.body)));
  }) as typeof fetch;
  return { fetcher, calls };
}

beforeEach(() => {
  process.env.FIREBASE_SERVICE_ACCOUNT = Buffer.from(JSON.stringify(account)).toString("base64");
  resetPushToken();
});
afterEach(() => {
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
});

describe("push", () => {
  it("signs a Google service-account JWT", () => {
    expect(serviceAccount()?.project_id).toBe("mizan-test");
    const [header, claims, signature] = assertion(account, 1_700_000_000_000).split(".");
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toMatchObject({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      iat: 1_700_000_000,
      exp: 1_700_003_600,
    });
    const ok = createVerify("RSA-SHA256")
      .update(`${header}.${claims}`)
      .verify(publicKey, Buffer.from(signature, "base64url"));
    expect(ok).toBe(true);
  });

  it("sends through FCM v1 and reports uninstalled apps", async () => {
    const { fetcher, calls } = fakeFetch(() => new Response("{}"));
    await sendPush("token-1", { title: "Shop", body: "3 to reorder", url: "/fr/reorder" }, fetcher);
    expect(calls[1].url).toBe("https://fcm.googleapis.com/v1/projects/mizan-test/messages:send");
    expect(JSON.parse(calls[1].body).message).toMatchObject({
      token: "token-1",
      notification: { title: "Shop", body: "3 to reorder" },
      data: { url: "/fr/reorder" },
    });

    const gone = fakeFetch(
      () =>
        new Response(
          JSON.stringify({
            error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] },
          }),
          { status: 404 },
        ),
    );
    await expect(sendPush("old", { title: "a", body: "b" }, gone.fetcher)).rejects.toBeInstanceOf(
      PushGoneError,
    );
  });
});

describe("summaries on phones", () => {
  let db: Database;
  let ctx: Ctx;
  beforeEach(async () => {
    db = await makeDb();
    ({ ctx } = await makeStore(db));
  });

  it("sends the summary to the store's phones and forgets uninstalled ones", async () => {
    await makeProduct(db, ctx, { name: "Milk", stock: 0 });
    await registerDevice(db, {
      storeId: ctx.storeId,
      userId: "u1",
      token: "phone-ok",
      platform: "android",
    });
    await registerDevice(db, {
      storeId: ctx.storeId,
      userId: "u1",
      token: "phone-gone",
      platform: "android",
    });
    const sent: string[] = [];
    const result = await sendDigest(db, ctx.storeId, {
      senders: {
        telegram: async () => {},
        email: async () => {},
        push: async (token, message) => {
          if (token === "phone-gone") throw new PushGoneError("UNREGISTERED");
          sent.push(`${token}: ${message.title}`);
        },
      },
    });
    expect(result).toMatchObject({ sent: 1, channels: 2, alerts: 1 });
    expect(sent).toEqual(["phone-ok: Shop"]);
    const left = await db.select().from(pushDevices);
    expect(left.map((d) => d.token)).toEqual(["phone-ok"]);
  });
});
