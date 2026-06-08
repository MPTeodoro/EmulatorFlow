const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev') || !app.isPackaged;

let win = null;
let pythonProcess = null;
let engineReady = false;

// ─── Auto-updater ────────────────────────────────────────────────────────────

function setupAutoUpdater() {
  if (isDev) return; // don't check for updates in dev

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    win?.webContents.send('update-status', { type: 'available', version: info.version });
  });

  autoUpdater.on('update-downloaded', (info) => {
    win?.webContents.send('update-status', { type: 'ready', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater]', err.message);
  });

  // Check 5 seconds after launch (give window time to load)
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
}

// ─── Python engine ───────────────────────────────────────────────────────────

function startPythonEngine() {
  let cmd, args, cwd;

  if (isDev) {
    cmd  = 'python';
    args = ['engine/main.py'];
    cwd  = path.join(__dirname, '..');
  } else {
    cmd  = path.join(process.resourcesPath, 'engine', 'python-engine.exe');
    args = [];
    cwd  = process.resourcesPath;
  }

  // In packaged mode, make sure the binary exists before trying to spawn it
  if (!isDev && !fs.existsSync(cmd)) {
    console.error('[Engine] python-engine.exe not found at', cmd);
    win?.webContents.send('engine-status', { ok: false, reason: 'missing' });
    return;
  }

  try {
    pythonProcess = spawn(cmd, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Give it 8 seconds to bind the port; if the process dies before that, report it
    const startTimeout = setTimeout(() => {
      if (!engineReady) {
        win?.webContents.send('engine-status', { ok: false, reason: 'timeout' });
      }
    }, 8000);

    pythonProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      console.log('[Engine]', msg);
      if (msg.includes('8765')) {
        engineReady = true;
        clearTimeout(startTimeout);
        win?.webContents.send('engine-status', { ok: true });
      }
      win?.webContents.send('python-log', { level: 'info', message: msg });
    });

    pythonProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      console.error('[Engine ERR]', msg);
      win?.webContents.send('python-log', { level: 'error', message: msg });
    });

    pythonProcess.on('close', (code) => {
      console.log(`[Engine] exited with code ${code}`);
      pythonProcess = null;
      engineReady = false;
      if (code !== 0 && code !== null) {
        win?.webContents.send('engine-status', { ok: false, reason: 'crash', code });
      }
    });

    pythonProcess.on('error', (err) => {
      console.error('[Engine] spawn error:', err.message);
      win?.webContents.send('engine-status', { ok: false, reason: 'spawn', message: err.message });
    });

  } catch (err) {
    console.error('[Engine] Could not start:', err.message);
    win?.webContents.send('engine-status', { ok: false, reason: 'exception', message: err.message });
  }
}

// ─── Window ──────────────────────────────────────────────────────────────────

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.on('closed', () => { win = null; });
}

// ─── IPC: install update ─────────────────────────────────────────────────────

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('get-app-version', () => app.getVersion());

// ─── IPC: file system ────────────────────────────────────────────────────────

ipcMain.handle('read-file', async (_e, filePath) => {
  const buffer = fs.readFileSync(filePath);
  return buffer.toString('base64');
});

ipcMain.handle('write-file', async (_e, filePath, base64Data) => {
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filePath, buffer);
  return true;
});

ipcMain.handle('list-dir', async (_e, dirPath) => {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath);
});

ipcMain.handle('ensure-dir', async (_e, dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
  return true;
});

ipcMain.handle('get-projects-path', async () =>
  path.join(app.getPath('documents'), 'EmulatorFlow', 'projects')
);

ipcMain.handle('save-screenshot', async (_e, base64Data, imagesDir) => {
  fs.mkdirSync(imagesDir, { recursive: true });
  const filename = `screenshot_${Date.now()}.jpg`;
  const filePath = path.join(imagesDir, filename);
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  return { name: filename, path: filePath };
});

ipcMain.handle('list-images', async (_e, imagesDir) => {
  if (!fs.existsSync(imagesDir)) return [];
  const exts = ['.png', '.jpg', '.jpeg'];
  return fs.readdirSync(imagesDir)
    .filter((f) => exts.includes(path.extname(f).toLowerCase()))
    .map((name) => {
      const filePath = path.join(imagesDir, name);
      const data = fs.readFileSync(filePath).toString('base64');
      const mime = path.extname(name).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
      return { name, path: filePath, dataUrl: `data:${mime};base64,${data}` };
    });
});

ipcMain.handle('delete-image', async (_e, filePath) => {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return true;
});

ipcMain.handle('dialog-open-file', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: 'Select Reference Image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
    properties: ['openFile'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog-save-file', async (_e, defaultName) => {
  const result = await dialog.showSaveDialog(win, {
    title: 'Save File',
    defaultPath: defaultName || 'file',
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('minimize-window', () => win?.minimize());
ipcMain.handle('maximize-window', () => {
  if (!win) return;
  win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.handle('close-window', () => app.quit());

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  startPythonEngine();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (pythonProcess) { pythonProcess.kill(); pythonProcess = null; }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => { if (win === null) createWindow(); });

app.on('before-quit', () => {
  if (pythonProcess) { pythonProcess.kill(); pythonProcess = null; }
});
