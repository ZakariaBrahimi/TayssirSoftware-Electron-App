// Tayssir POS desktop shell.
//
// Starts the bundled Next.js server (the same app that runs on the web) on
// localhost with a local SQLite database, then opens it in a window. Works
// fully offline. The renderer is a normal sandboxed web page: no Node.js
// APIs are exposed to it.
const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

let server = null;
let mainWindow = null;

// Store data in a readable folder, e.g. %APPDATA%/Tayssir POS on Windows.
app.setName("Tayssir POS");
app.setPath("userData", path.join(app.getPath("appData"), "Tayssir POS"));

const webDir = app.isPackaged
  ? path.join(process.resourcesPath, "web")
  : path.join(__dirname, "web-dist");

function findServerEntry() {
  // Standalone output mirrors the monorepo layout: <root>/apps/web/server.js
  const candidates = [path.join(webDir, "apps", "web", "server.js"), path.join(webDir, "server.js")];
  return candidates.find((p) => fs.existsSync(p));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Auth secret generated once per installation and kept in the user data folder. */
function getSecret(dataDir) {
  const file = path.join(dataDir, "auth-secret");
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, crypto.randomBytes(32).toString("base64"), { mode: 0o600 });
  }
  return fs.readFileSync(file, "utf8").trim();
}

async function waitForServer(url, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("The local server did not start in time.");
}

async function startServer() {
  const entry = findServerEntry();
  if (!entry) throw new Error(`Web build not found in ${webDir}. Run "npm run prepare:web".`);

  const dataDir = app.getPath("userData");
  fs.mkdirSync(dataDir, { recursive: true });
  const port = Number(process.env.TAYSSIR_PORT) || (await getFreePort());
  // Set TAYSSIR_HOST=0.0.0.0 to let other devices on the shop network
  // (tablets, phones) use this computer as the store server.
  const host = process.env.TAYSSIR_HOST || "127.0.0.1";
  const url = `http://127.0.0.1:${port}`;

  server = spawn(process.execPath, [entry], {
    cwd: path.dirname(entry),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: host,
      DATABASE_URL: `file:${path.join(dataDir, "tayssir.db")}`,
      MIGRATIONS_DIR: path.join(path.dirname(entry), "drizzle"),
      BETTER_AUTH_SECRET: getSecret(dataDir),
      BETTER_AUTH_URL: url,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = fs.createWriteStream(path.join(dataDir, "server.log"), { flags: "a" });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  server.on("exit", (code) => {
    if (code && !app.isQuitting) {
      dialog.showErrorBox("Tayssir POS", `The local server stopped (code ${code}). See server.log in ${dataDir}.`);
      app.quit();
    }
  });

  await waitForServer(url);
  return url;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: "Tayssir POS",
    icon: path.join(webDir, "apps", "web", "public", "icons", "icon-512.png"),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  // Keep navigation inside the app; open anything external in the browser.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (!target.startsWith(url)) shell.openExternal(target);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, target) => {
    if (!target.startsWith(url)) {
      event.preventDefault();
      shell.openExternal(target);
    }
  });
  mainWindow.loadURL(url);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      const url = await startServer();
      createWindow(url);
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
      });
    } catch (err) {
      dialog.showErrorBox("Tayssir POS", String(err?.message ?? err));
      app.quit();
    }
  });

  app.on("before-quit", () => {
    app.isQuitting = true;
    server?.kill();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
