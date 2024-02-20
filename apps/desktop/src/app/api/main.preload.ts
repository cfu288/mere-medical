import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  platform: process.platform,
  onExternalNavigate: (callback: (arg0: any) => void) =>
    ipcRenderer.on('navigate', (_event, value) => callback(value)),
});
