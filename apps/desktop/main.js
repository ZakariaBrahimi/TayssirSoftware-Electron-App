// Tayssir POS desktop shell.
//
// Starts the bundled Next.js server (the same app that runs on the web) on
// localhost with a local SQLite database, then opens it in a window. Works
// fully offline. The renderer is a normal sandboxed web page: no Node.js
// APIs are exposed to it. Updates are downloaded from GitHub Releases.
const { app, BrowserWindow, shell, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const { execSync, spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

/** Exit code the server uses to ask for a restart (after a backup restore). */
const RESTART_EXIT_CODE = 75;

let server = null;
let mainWindow = null;
let serverUrl = null;
let quitting = false;

// Store data in a readable folder, e.g. %APPDATA%/Tayssir POS on Windows.
app.setName("Tayssir POS");
app.setPath("userData", path.join(app.getPath("appData"), "Tayssir POS"));

const webDir = app.isPackaged
  ? path.join(process.resourcesPath, "web")
  : path.join(__dirname, "web-dist");

/** Build-time settings written by scripts/prepare-web.mjs. */
function readAppConfig() {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(webDir, "app-config.json"), "utf8"),
    );
  } catch {
    return {};
  }
}

function findServerEntry() {
  // Standalone output mirrors the monorepo layout: <root>/apps/web/server.js
  const candidates = [
    path.join(webDir, "bundle", "apps", "web", "server.js"),
    path.join(webDir, "apps", "web", "server.js"),
  ];
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
    fs.writeFileSync(file, crypto.randomBytes(32).toString("base64"), {
      mode: 0o600,
    });
  }
  return fs.readFileSync(file, "utf8").trim();
}

/**
 * Stable identifier of this computer, used to bind a license to it.
 * Hashed so the raw hardware id never leaves the machine.
 */
function getMachineId(dataDir) {
  let raw = null;
  try {
    if (process.platform === "win32") {
      const out = execSync(
        "reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid",
        { encoding: "utf8" },
      );
      raw = /MachineGuid\s+REG_SZ\s+(\S+)/.exec(out)?.[1] ?? null;
    } else if (process.platform === "darwin") {
      const out = execSync("ioreg -rd1 -c IOPlatformExpertDevice", {
        encoding: "utf8",
      });
      raw = /"IOPlatformUUID" = "([^"]+)"/.exec(out)?.[1] ?? null;
    } else {
      for (const file of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
        if (fs.existsSync(file)) raw = fs.readFileSync(file, "utf8").trim();
        if (raw) break;
      }
    }
  } catch {
    raw = null;
  }
  if (!raw) {
    // Fallback: random id kept with the data.
    const file = path.join(dataDir, "device-id");
    if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomUUID());
    raw = fs.readFileSync(file, "utf8").trim();
  }
  return crypto
    .createHash("sha256")
    .update(`tayssir:${raw}`)
    .digest("hex")
    .slice(0, 32);
}

async function waitForServer(url, timeoutMs = 60_000) {
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

async function startServer(port) {
  const entry = findServerEntry();
  if (!entry)
    throw new Error(
      `Web build not found in ${webDir}. Run "npm run prepare:web".`,
    );

  const dataDir = app.getPath("userData");
  fs.mkdirSync(dataDir, { recursive: true });
  const config = readAppConfig();
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
      TAYSSIR_MODE: "local",
      DATABASE_URL: `file:${path.join(dataDir, "tayssir.db")}`,
      MIGRATIONS_DIR: path.join(path.dirname(entry), "drizzle"),
      BETTER_AUTH_SECRET: getSecret(dataDir),
      BETTER_AUTH_URL: url,
      TAYSSIR_DEVICE_ID: getMachineId(dataDir),
      TAYSSIR_DEVICE_NAME: os.hostname(),
      ...(config.licensePublicKey
        ? { LICENSE_PUBLIC_KEY: config.licensePublicKey }
        : {}),
      ...(config.licenseServerUrl
        ? { LICENSE_SERVER_URL: config.licenseServerUrl }
        : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = fs.createWriteStream(path.join(dataDir, "server.log"), {
    flags: "a",
  });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  server.on("exit", (code) => {
    if (quitting) return;
    if (code === RESTART_EXIT_CODE) {
      // A backup was restored: start again on the same port and reload.
      startServer(port)
        .then(() => mainWindow?.reload())
        .catch((err) => fatal(err));
    } else if (code) {
      fatal(
        new Error(
          `The local server stopped (code ${code}). See server.log in ${dataDir}.`,
        ),
      );
    }
  });

  await waitForServer(url);
  return url;
}

function fatal(err) {
  dialog.showErrorBox("Tayssir POS", String(err?.message ?? err));
  app.quit();
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
    icon: path.join(
      webDir,
      "bundle",
      "apps",
      "web",
      "public",
      "icons",
      "icon-512.png",
    ),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
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
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.loadURL(url);
}

/** Checks GitHub Releases for updates; installs on the user's approval. */
function setupAutoUpdates() {
  if (!app.isPackaged || process.env.TAYSSIR_DISABLE_UPDATES === "1") return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: () => {},
    warn: () => {},
    error: (e) =>
      fs.appendFileSync(
        path.join(app.getPath("userData"), "updater.log"),
        `${new Date().toISOString()} ${e}\n`,
      ),
    debug: () => {},
  };
  autoUpdater.on("update-downloaded", async (info) => {
    const { response } = await dialog.showMessageBox(mainWindow ?? undefined, {
      type: "info",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "Tayssir POS",
      message: `Version ${info.version} is ready to install.`,
      detail:
        "Your data is kept and backed up automatically before the update. " +
        "If you choose Later, the update installs the next time you close the app.",
    });
    if (response === 0) {
      quitting = true;
      server?.kill();
      setImmediate(() => autoUpdater.quitAndInstall());
    }
  });
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 6 * 3_600_000).unref();
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
      const port = Number(process.env.TAYSSIR_PORT) || (await getFreePort());
      serverUrl = await startServer(port);
      createWindow(serverUrl);
      setupAutoUpdates();
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow(serverUrl);
      });
    } catch (err) {
      fatal(err);
    }
  });

  app.on("before-quit", () => {
    quitting = true;
    server?.kill();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
