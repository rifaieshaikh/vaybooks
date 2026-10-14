const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

const DESKTOP_COMPOSE_URL = "http://127.0.0.1:5175";
const SHELL_URL = "http://127.0.0.1:5173";
const LOCAL_API_UI = "http://127.0.0.1:8000/";

function normalizeBaseUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function readConfigValue(key) {
  const dataDir = process.env.VAYBOOKS_DATA_DIR;
  if (!dataDir) {
    return "";
  }
  const configPath = path.join(dataDir, "config", "config.toml");
  try {
    if (!fs.existsSync(configPath)) {
      return "";
    }
    const text = fs.readFileSync(configPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const eq = trimmed.indexOf("=");
      if (eq < 0) {
        continue;
      }
      const name = trimmed.slice(0, eq).trim();
      if (name !== key) {
        continue;
      }
      return trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  } catch (_err) {
    return "";
  }
  return "";
}

function probeUrl(url) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (_err) {
      resolve(false);
      return;
    }
    const lib = parsed.protocol === "https:" ? https : http;
    const request = lib.get(url, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 400);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function resolveUiUrl() {
  const envOverride = normalizeBaseUrl(
    process.env.VAYBOOKS_UI_URL || process.env.API_BASE_URL || ""
  );
  if (envOverride) {
    return envOverride;
  }

  const configUrl = normalizeBaseUrl(
    readConfigValue("API_BASE_URL") || readConfigValue("VAYBOOKS_UI_URL") || ""
  );
  if (configUrl) {
    return configUrl;
  }

  if (app.isPackaged) {
    return LOCAL_API_UI;
  }

  if (await probeUrl(DESKTOP_COMPOSE_URL)) {
    return DESKTOP_COMPOSE_URL;
  }
  return SHELL_URL;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "VayBooks",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.platform === "win32") {
    app.setAppUserModelId("com.vaybooks.bms");
  }

  resolveUiUrl().then((url) => {
    console.log(`Loading VayBooks UI: ${url}`);
    win.loadURL(url);
  });

  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
