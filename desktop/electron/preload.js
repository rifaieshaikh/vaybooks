const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("vaybooksDesktop", {
  isDesktop: true,
});
