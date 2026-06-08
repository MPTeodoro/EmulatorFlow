const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,

  readFile:       (filePath)              => ipcRenderer.invoke('read-file', filePath),
  writeFile:      (filePath, base64Data)  => ipcRenderer.invoke('write-file', filePath, base64Data),
  listDir:        (dirPath)               => ipcRenderer.invoke('list-dir', dirPath),
  ensureDir:      (dirPath)               => ipcRenderer.invoke('ensure-dir', dirPath),
  getProjectsPath: ()                     => ipcRenderer.invoke('get-projects-path'),
  dialogOpenFile: ()                      => ipcRenderer.invoke('dialog-open-file'),
  dialogSaveFile: (defaultName)           => ipcRenderer.invoke('dialog-save-file', defaultName),
  minimizeWindow: ()                      => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: ()                      => ipcRenderer.invoke('maximize-window'),
  closeWindow:    ()                      => ipcRenderer.invoke('close-window'),

  saveScreenshot: (base64Data, imagesDir) => ipcRenderer.invoke('save-screenshot', base64Data, imagesDir),
  listImages:     (imagesDir)             => ipcRenderer.invoke('list-images', imagesDir),
  deleteImage:    (filePath)              => ipcRenderer.invoke('delete-image', filePath),

  getAppVersion:  ()                      => ipcRenderer.invoke('get-app-version'),
  installUpdate:  ()                      => ipcRenderer.invoke('install-update'),

  onPythonLog: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on('python-log', h);
    return () => ipcRenderer.removeListener('python-log', h);
  },

  onEngineStatus: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on('engine-status', h);
    return () => ipcRenderer.removeListener('engine-status', h);
  },

  onUpdateStatus: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on('update-status', h);
    return () => ipcRenderer.removeListener('update-status', h);
  },
});
