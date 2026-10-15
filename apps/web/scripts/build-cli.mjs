/**
 * Bundles the vendor CLI (src/server/cli/admin.ts) into one file, so it runs
 * with plain Node next to the standalone server (Docker image), without the
 * sources or tsx:  node admin.mjs <command>
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

await build({
  entryPoints: [path.join(root, "src/server/cli/admin.ts")],
  outfile: path.join(root, ".next/standalone/apps/web/admin.mjs"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  alias: { "@": path.join(root, "src") },
  // Native database driver: resolved from the standalone node_modules.
  external: ["@libsql/client", "libsql"],
  // Some bundled CommonJS code calls require().
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "warning",
});
console.log("CLI bundled: .next/standalone/apps/web/admin.mjs");
