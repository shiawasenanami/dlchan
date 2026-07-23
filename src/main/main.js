const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Tray, Menu } = require('electron');
const path = require('path');
const { DownloadManager, isHlsUrl, setGlobalSpeedLimit } = require('./downloadEngine');
const { isYtDlpUrl, listFormats } = require('./ytdlp');
const licenseAdmin = require('./licenseAdmin');
const { startExtensionBridge } = require('./extensionBridge');
const license = require('./license');
const { autoUpdater } = require('electron-updater');
const { convertFile } = require('./mediaConverter');

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // every 4 hours, per product decision (see chat)

// We drive the download/install steps ourselves from the renderer (so the
// user sees a real progress bar and an explicit "restart to install"
// moment) instead of letting electron-updater grab and install silently
// the instant it finds something.
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('update:available', {
    hasUpdate: true,
    currentVersion: app.getVersion(),
    latestVersion: info.version,
    notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : ''
  });
});

autoUpdater.on('download-progress', (progress) => {
  mainWindow?.webContents.send('update:download-progress', {
    percent: progress.percent,
    bytesPerSecond: progress.bytesPerSecond,
    transferred: progress.transferred,
    total: progress.total
  });
});

autoUpdater.on('update-downloaded', () => {
  mainWindow?.webContents.send('update:downloaded');
});

autoUpdater.on('error', (err) => {
  mainWindow?.webContents.send('update:error', { message: err.message });
});

const downloadManager = new DownloadManager();
let mainWindow;
let bridgeServer;
let clipboardWatcher;
let hlsEnabled = true;
let tray;
let isQuitting = false;

const EXTENSION_DIR = path.join(__dirname, '..', '..', 'extension');

const CLIPBOARD_URL_RE = /https?:\/\/\S+\.(zip|rar|7z|exe|msi|pdf|mp3|mp4|mkv|webm|m3u8|apk|dmg)(\?\S*)?/i;
const seenClipboardUrls = new Set();
let lastClipboardText = '';

function startClipboardWatcher() {
  clipboardWatcher = setInterval(() => {
    const text = clipboard.readText();
    if (!text || text === lastClipboardText) return;
    lastClipboardText = text;
    const match = CLIPBOARD_URL_RE.exec(text);
    if (match && !seenClipboardUrls.has(match[0])) {
      seenClipboardUrls.add(match[0]);
      mainWindow?.webContents.send('clipboard:detected', { url: match[0] });
    }
  }, 1500);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 620,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#f4faf5',
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Most users leave a download manager running in the tray at all times —
  // closing the window minimizes to tray instead of quitting.
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, '..', '..', 'assets', 'icon.png'));
  tray.setToolTip('DL-chan');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'เปิด DL-chan', click: () => mainWindow.show() },
    { label: 'ตรวจสอบอัปเดตตอนนี้', click: () => runUpdateCheck() },
    { type: 'separator' },
    { label: 'ออกจากโปรแกรม', click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on('double-click', () => mainWindow.show());
}

async function runUpdateCheck() {
  // In dev (unpackaged) this throws/no-ops — electron-updater only makes
  // sense against a real installed app.asar it can compare/replace.
  if (!app.isPackaged) return { hasUpdate: false, currentVersion: app.getVersion(), error: 'dev build — auto-update disabled' };
  try {
    const result = await autoUpdater.checkForUpdates();
    const latestVersion = result?.updateInfo?.version;
    return {
      hasUpdate: Boolean(latestVersion && latestVersion !== app.getVersion()),
      currentVersion: app.getVersion(),
      latestVersion
    };
  } catch (err) {
    return { hasUpdate: false, currentVersion: app.getVersion(), error: err.message };
  }
}

ipcMain.handle('download:pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled) return null;
  return result.filePaths[0];
});

function normalizeHlsDest(destPath) {
  return destPath.replace(/\.m3u8$/i, '.ts');
}

ipcMain.handle('download:start', (event, { url, destPath, connections, headers, formatId }) => {
  const task = isYtDlpUrl(url)
    ? downloadManager.createYtDlpTask({ url, destPath, formatId })
    : (hlsEnabled && isHlsUrl(url))
      ? downloadManager.createHlsTask({ url, destPath: normalizeHlsDest(destPath), connections, headers })
      : downloadManager.createTask({ url, destPath, connections, headers });
  task.on('progress', (snapshot) => {
    mainWindow.webContents.send('download:progress', snapshot);
  });
  task.on('error', (message) => {
    mainWindow.webContents.send('download:error', { id: task.id, message });
  });
  task.start();
  return task.progressSnapshot();
});

ipcMain.handle('download:list-formats', async (event, url) => {
  try {
    return { ok: true, ...(await listFormats(url)) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('download:is-ytdlp-url', (event, url) => isYtDlpUrl(url));

ipcMain.handle('download:pause', (event, id) => {
  downloadManager.get(id)?.pause();
});

ipcMain.handle('download:resume', (event, id) => {
  downloadManager.get(id)?.resume();
});

ipcMain.handle('download:cancel', (event, id) => {
  downloadManager.get(id)?.cancel();
});

ipcMain.handle('download:open-folder', (event, destPath) => {
  shell.showItemInFolder(destPath);
});

ipcMain.handle('shell:open-path', (event, folderPath) => {
  shell.openPath(folderPath);
});

ipcMain.handle('app:quit', () => {
  isQuitting = true;
  app.quit();
});

ipcMain.handle('settings:set-speed-limit', (event, kbps) => {
  setGlobalSpeedLimit((kbps || 0) * 1024);
});

ipcMain.handle('settings:set-hls-enabled', (event, enabled) => {
  hlsEnabled = !!enabled;
});

ipcMain.handle('settings:get-launch-on-startup', () => app.getLoginItemSettings().openAtLogin);

ipcMain.handle('settings:set-launch-on-startup', (event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: !!enabled });
});

ipcMain.handle('setup:open-extension-folder', () => {
  shell.openPath(EXTENSION_DIR);
});

ipcMain.handle('setup:get-extension-path', () => EXTENSION_DIR);

ipcMain.handle('license:get-status', () => license.getStatus());

ipcMain.handle('license:activate', (event, code) => license.activate(code));

ipcMain.handle('license:admin-is-available', () => licenseAdmin.isAdminAvailable());

ipcMain.handle('license:admin-generate-gift-code', (event, { days, lifetime, note }) => {
  try {
    const { code } = licenseAdmin.generateGiftCode({ days, lifetime, note });
    return { ok: true, code };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('update:check-now', () => runUpdateCheck());

ipcMain.handle('update:download', () => autoUpdater.downloadUpdate());

ipcMain.handle('update:install', () => {
  isQuitting = true;
  autoUpdater.quitAndInstall();
});

ipcMain.handle('update:open-download', (event, url) => shell.openExternal(url));

ipcMain.handle('media:convert', async (event, { sourcePath, format }) => {
  try {
    const result = await convertFile(sourcePath, format);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  bridgeServer = startExtensionBridge({
    downloadManager,
    getMainWindow: () => mainWindow,
    isHlsEnabled: () => hlsEnabled
  });
  startClipboardWatcher();
  setTimeout(runUpdateCheck, 10000);
  setInterval(runUpdateCheck, UPDATE_CHECK_INTERVAL_MS);
});

app.on('before-quit', () => {
  isQuitting = true;
  bridgeServer?.close();
});

app.on('window-all-closed', () => {
  // Intentionally do nothing — the app lives in the tray until the user
  // explicitly quits from the tray menu (matches how IDM-style tools behave).
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
