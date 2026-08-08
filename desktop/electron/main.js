const { app, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");

const DESKTOP_COMPOSE_URL = "http://127.0.0.1:5175";
const SHELL_URL = "http://127.0.0.1:5173";

function probeUrl(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
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
  const override = process.env.VAYBOOKS_UI_URL;
  if (override) {
    return override;
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
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

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
