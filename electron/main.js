const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { spawn, execSync } = require('child_process');

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev') || !app.isPackaged;

let win = null;
let pythonProcess = null;
let engineReady = false;

// A second instance would spawn another engine that loses the race for port
// 8765 and then share the same project files — focus the first window instead.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

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

function killPythonEngine() {
  if (!pythonProcess) return;
  const pid = pythonProcess.pid;
  pythonProcess = null;
  engineReady = false;
  try {
    if (process.platform === 'win32') {
      // PyInstaller one-file runs as a bootloader + child python process;
      // .kill() only hits the bootloader and the child keeps port 8765
      // busy forever — taskkill /T takes the whole tree down.
      execSync(`taskkill /pid ${pid} /T /F`, { windowsHide: true, stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
    }
  } catch { /* already dead */ }
}

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
      windowsHide: true,
    });

    // PyInstaller one-file extracts itself on first run and antivirus scans
    // can stall that for a long while on slower machines — be generous.
    const startTimeout = setTimeout(() => {
      if (!engineReady) {
        win?.webContents.send('engine-status', { ok: false, reason: 'timeout' });
      }
    }, 30000);

    const checkReady = (msg) => {
      if (!engineReady && msg.includes('8765')) {
        engineReady = true;
        clearTimeout(startTimeout);
        win?.webContents.send('engine-status', { ok: true });
      }
    };

    pythonProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) {
        console.log('[Engine]', msg);
        checkReady(msg);
        win?.webContents.send('python-log', { level: 'info', message: msg });
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (!msg) return;
      checkReady(msg);
      // uvicorn writes INFO logs to stderr — don't show them as errors
      const isInfo = msg.startsWith('INFO:') || msg.startsWith('WARNING:');
      console.log(`[Engine${isInfo ? '' : ' ERR'}]`, msg);
      win?.webContents.send('python-log', { level: isInfo ? 'info' : 'error', message: msg });
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
  const buffer = await fsp.readFile(filePath);
  return buffer.toString('base64');
});

ipcMain.handle('write-file', async (_e, filePath, base64Data) => {
  const buffer = Buffer.from(base64Data, 'base64');
  // Atomic write: a crash mid-write must never leave a half-written
  // workflow.json behind (rename replaces the target even on Windows)
  const tmpPath = `${filePath}.tmp`;
  await fsp.writeFile(tmpPath, buffer);
  await fsp.rename(tmpPath, filePath);
  return true;
});

ipcMain.handle('list-dir', async (_e, dirPath) => {
  try {
    return await fsp.readdir(dirPath);
  } catch {
    return [];
  }
});

ipcMain.handle('ensure-dir', async (_e, dirPath) => {
  await fsp.mkdir(dirPath, { recursive: true });
  return true;
});

ipcMain.handle('get-projects-path', async () =>
  path.join(app.getPath('documents'), 'EmulatorFlow', 'projects')
);

ipcMain.handle('save-screenshot', async (_e, base64Data, imagesDir) => {
  await fsp.mkdir(imagesDir, { recursive: true });
  const filename = `screenshot_${Date.now()}.jpg`;
  const filePath = path.join(imagesDir, filename);
  await fsp.writeFile(filePath, Buffer.from(base64Data, 'base64'));
  return { name: filename, path: filePath };
});

ipcMain.handle('list-images', async (_e, imagesDir) => {
  const exts = ['.png', '.jpg', '.jpeg'];
  let entries;
  try {
    entries = await fsp.readdir(imagesDir);
  } catch {
    return [];
  }
  const images = await Promise.all(
    entries
      .filter((f) => exts.includes(path.extname(f).toLowerCase()))
      .map(async (name) => {
        const filePath = path.join(imagesDir, name);
        try {
          const data = (await fsp.readFile(filePath)).toString('base64');
          const mime = path.extname(name).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
          return { name, path: filePath, dataUrl: `data:${mime};base64,${data}` };
        } catch {
          return null;
        }
      })
  );
  return images.filter(Boolean);
});

ipcMain.handle('delete-image', async (_e, filePath) => {
  try {
    await fsp.unlink(filePath);
  } catch { /* already gone */ }
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
ipcMain.handle('relaunch-app', () => {
  // app.exit() skips before-quit, so kill the engine explicitly here —
  // an orphaned engine keeps port 8765 busy and the relaunched app's
  // engine can never bind it ("Engine offline" forever).
  killPythonEngine();
  app.relaunch();
  app.exit(0);
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  startPythonEngine();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  killPythonEngine();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => { if (win === null) createWindow(); });

app.on('before-quit', () => {
  killPythonEngine();
});
