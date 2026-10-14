import { Hono } from "hono";
import {
  auditListQuery,
  endOfDay,
  extendTrialInput,
  optionsQuery,
  passwordResetInput,
  platformDeviceListQuery,
  platformLicenseCreateInput,
  platformLicenseListQuery,
  platformLicenseUpdateInput,
  platformPaymentInput,
  platformPaymentListQuery,
  platformStoreListQuery,
  reasonInput,
  subscriptionInput,
} from "@/lib/validators/platform";
import { db } from "../../db";
import { platformCurrency } from "../../platform/access";
import { listAudit } from "../../platform/audit";
import { listDevices, revokeDevice } from "../../platform/devices";
import {
  createLicense,
  getLicenseDetail,
  licenseOptions,
  listLicenses,
  removeActivations,
  setLicenseRevoked,
  updateLicense,
} from "../../platform/licenses";
import { getOverview } from "../../platform/overview";
import { listPayments, recordPayment, voidPayment } from "../../platform/payments";
import {
  extendTrial,
  getStoreDetail,
  listStores,
  reactivateStore,
  resetStoreUserPassword,
  setSubscription,
  storeOptions,
  suspendStore,
} from "../../platform/stores";
import { onlyMode, validate } from "../context";
import { type PlatformEnv, requirePlatformAdmin, requireTwoFactor } from "../platform-context";

const storesRoutes = new Hono<PlatformEnv>()
  .get("/", validate("query", platformStoreListQuery), async (c) =>
    c.json(await listStores(db, c.req.valid("query"))),
  )
  .get("/options", validate("query", optionsQuery), async (c) =>
    c.json(await storeOptions(db, c.req.valid("query").q)),
  )
  .get("/:id", async (c) => c.json(await getStoreDetail(db, c.req.param("id"))))
  .put("/:id/subscription", validate("json", subscriptionInput), async (c) => {
    const { currentPeriodEnd, ...rest } = c.req.valid("json");
    return c.json(
      await setSubscription(db, c.get("actor"), c.req.param("id"), {
        ...rest,
        currentPeriodEnd:
          currentPeriodEnd === undefined
            ? undefined
            : currentPeriodEnd === null
              ? null
              : endOfDay(currentPeriodEnd),
      }),
    );
  })
  .post("/:id/extend-trial", validate("json", extendTrialInput), async (c) =>
    c.json(await extendTrial(db, c.get("actor"), c.req.param("id"), c.req.valid("json").days)),
  )
  .post("/:id/suspend", validate("json", reasonInput), async (c) =>
    c.json(await suspendStore(db, c.get("actor"), c.req.param("id"), c.req.valid("json").reason)),
  )
  .post("/:id/reactivate", async (c) =>
    c.json(await reactivateStore(db, c.get("actor"), c.req.param("id"))),
  )
  .post("/:id/users/:userId/password", validate("json", passwordResetInput), async (c) =>
    c.json(
      await resetStoreUserPassword(
        db,
        c.get("actor"),
        c.req.param("id"),
        c.req.param("userId"),
        c.req.valid("json").password,
      ),
    ),
  );

const licensesRoutes = new Hono<PlatformEnv>()
  .get("/", validate("query", platformLicenseListQuery), async (c) =>
    c.json(await listLicenses(db, c.req.valid("query"))),
  )
  .get("/options", validate("query", optionsQuery), async (c) =>
    c.json(await licenseOptions(db, c.req.valid("query").q)),
  )
  .post("/", validate("json", platformLicenseCreateInput), async (c) => {
    const { key, license } = await createLicense(db, c.get("actor"), c.req.valid("json"));
    // The key is returned once and never stored.
    return c.json({ key, id: license.id }, 201);
  })
  .get("/:id", async (c) => c.json(await getLicenseDetail(db, c.req.param("id"))))
  .patch("/:id", validate("json", platformLicenseUpdateInput), async (c) => {
    const { expiresAt, ...rest } = c.req.valid("json");
    return c.json(
      await updateLicense(db, c.get("actor"), c.req.param("id"), {
        ...rest,
        ...(expiresAt !== undefined
          ? { expiresAt: expiresAt === null ? null : endOfDay(expiresAt) }
          : {}),
      }),
    );
  })
  .post("/:id/revoke", async (c) =>
    c.json(await setLicenseRevoked(db, c.get("actor"), c.req.param("id"), true)),
  )
  .post("/:id/restore", async (c) =>
    c.json(await setLicenseRevoked(db, c.get("actor"), c.req.param("id"), false)),
  )
  .post("/:id/reset", async (c) =>
    c.json(await removeActivations(db, c.get("actor"), c.req.param("id"))),
  )
  .delete("/:id/activations/:activationId", async (c) =>
    c.json(
      await removeActivations(db, c.get("actor"), c.req.param("id"), c.req.param("activationId")),
    ),
  );

const devicesRoutes = new Hono<PlatformEnv>()
  .get("/", validate("query", platformDeviceListQuery), async (c) =>
    c.json(await listDevices(db, c.req.valid("query"))),
  )
  .post("/:id/revoke", async (c) =>
    c.json(await revokeDevice(db, c.get("actor"), c.req.param("id"))),
  );

const paymentsRoutes = new Hono<PlatformEnv>()
  .get("/", validate("query", platformPaymentListQuery), async (c) => {
    const { from, to, ...rest } = c.req.valid("query");
    return c.json(
      await listPayments(db, {
        ...rest,
        from: from ? new Date(`${from}T00:00:00.000Z`) : undefined,
        to: to ? new Date(endOfDay(to).getTime() + 1) : undefined,
      }),
    );
  })
  .post("/", validate("json", platformPaymentInput), async (c) =>
    c.json(await recordPayment(db, c.get("actor"), c.req.valid("json")), 201),
  )
  .post("/:id/void", validate("json", reasonInput), async (c) =>
    c.json(await voidPayment(db, c.get("actor"), c.req.param("id"), c.req.valid("json").reason)),
  );

/** Cloud mode: the platform owner's console API. */
export const platformRoutes = new Hono<PlatformEnv>()
  .use(onlyMode("cloud"), requirePlatformAdmin)
  .get("/me", (c) => c.json({ user: c.get("platformUser"), currency: platformCurrency() }))
  .use(requireTwoFactor)
  .get("/overview", async (c) => c.json(await getOverview(db)))
  .get("/audit", validate("query", auditListQuery), async (c) =>
    c.json(await listAudit(db, c.req.valid("query"))),
  )
  .route("/stores", storesRoutes)
  .route("/licenses", licensesRoutes)
  .route("/devices", devicesRoutes)
  .route("/payments", paymentsRoutes);
