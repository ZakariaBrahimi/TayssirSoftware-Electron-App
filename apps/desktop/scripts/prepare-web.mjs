// Copies the Next.js standalone build (plus static assets, public files and
// database migrations) into ./web-dist so Electron can bundle and run it.
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webApp = path.resolve(here, "../../web");
const standalone = path.join(webApp, ".next", "standalone");
const out = path.resolve(here, "../web-dist");

if (!existsSync(standalone)) {
  console.error("No standalone build found. Run `npm run build -w @tayssir/web` first.");
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
cpSync(standalone, out, { recursive: true, verbatimSymlinks: true });

const appOut = path.join(out, "apps", "web");
cpSync(path.join(webApp, ".next", "static"), path.join(appOut, ".next", "static"), { recursive: true });
cpSync(path.join(webApp, "public"), path.join(appOut, "public"), { recursive: true });
cpSync(path.join(webApp, "drizzle"), path.join(appOut, "drizzle"), { recursive: true });
// Never ship a development database.
rmSync(path.join(appOut, "data"), { recursive: true, force: true });

console.log(`✔ Web app prepared in ${path.relative(process.cwd(), out)}`);
