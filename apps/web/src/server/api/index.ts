import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth } from "../auth";
import { AppError } from "../errors";
import { type AppEnv, requireAuth } from "./context";
import { brandsRoutes, categoriesRoutes } from "./routes/catalog";
import { productsRoutes } from "./routes/products";
import { reportsRoutes } from "./routes/reports";
import { salesRoutes } from "./routes/sales";
import { settingsRoutes } from "./routes/settings";
import { setupRoutes } from "./routes/setup";

const protectedRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .route("/products", productsRoutes)
  .route("/categories", categoriesRoutes)
  .route("/brands", brandsRoutes)
  .route("/sales", salesRoutes)
  .route("/reports", reportsRoutes)
  .route("/settings", settingsRoutes);

export const app = new Hono()
  .basePath("/api")
  .get("/health", (c) => c.json({ status: "ok" }))
  .on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw))
  .route("/setup", setupRoutes)
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
