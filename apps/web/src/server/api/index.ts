import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth } from "../auth";
import { AppError } from "../errors";
import { type AppEnv, requireAuth } from "./context";
import { backupRoutes } from "./routes/backup";
import { billingRoutes, subscriptionRoutes } from "./routes/billing";
import { brandsRoutes, categoriesRoutes } from "./routes/catalog";
import { dataRoutes } from "./routes/data";
import { licenseRoutes, licenseServerRoutes } from "./routes/licensing";
import { appInfoRoutes, setupRoutes, signupRoutes } from "./routes/onboarding";
import { platformRoutes } from "./routes/platform";
import { customersRoutes, suppliersRoutes } from "./routes/parties";
import { productsRoutes } from "./routes/products";
import { purchasesRoutes } from "./routes/purchases";
import { reportsRoutes } from "./routes/reports";
import { salesRoutes } from "./routes/sales";
import { shiftsRoutes } from "./routes/shifts";
import { meRoutes, settingsRoutes, usersRoutes } from "./routes/store";
import { syncClientRoutes, syncDevicesRoutes, syncServerRoutes } from "./routes/sync";

const protectedRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .route("/me", meRoutes)
  .route("/products", productsRoutes)
  .route("/categories", categoriesRoutes)
  .route("/brands", brandsRoutes)
  .route("/sales", salesRoutes)
  .route("/customers", customersRoutes)
  .route("/suppliers", suppliersRoutes)
  .route("/purchases", purchasesRoutes)
  .route("/shifts", shiftsRoutes)
  .route("/reports", reportsRoutes)
  .route("/settings", settingsRoutes)
  .route("/users", usersRoutes)
  .route("/license", licenseRoutes)
  .route("/backup", backupRoutes)
  .route("/data", dataRoutes)
  .route("/sync-client", syncClientRoutes)
  .route("/sync-devices", syncDevicesRoutes)
  .route("/subscription", subscriptionRoutes);

export const app = new Hono()
  .basePath("/api")
  .get("/health", (c) => c.json({ status: "ok" }))
  // Better Auth's admin endpoints are not store-aware: never expose them.
  .all("/auth/admin/*", () => {
    throw new AppError("NOT_FOUND");
  })
  .on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw))
  .route("/app", appInfoRoutes)
  .route("/setup", setupRoutes)
  .route("/signup", signupRoutes)
  .route("/licenses", licenseServerRoutes)
  .route("/sync", syncServerRoutes)
  .route("/platform", platformRoutes)
  .route("/billing", billingRoutes)
  .route("/", protectedRoutes);

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      err.status,
    );
  }
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500);
});

app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404));

export type AppType = typeof app;
