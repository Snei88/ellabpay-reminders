const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('RemindersAPI', {
  getAll: () => ipcRenderer.invoke('reminders:getAll'),
  save: (reminder) => ipcRenderer.invoke('reminders:save', reminder),
  remove: (id) => ipcRenderer.invoke('reminders:delete', id),
  onClick: (cb) => ipcRenderer.on('notification:clicked', (_e, data) => cb?.(data)),
  onFallback: (cb) => ipcRenderer.on('notification:fallback', (_e, data) => cb?.(data))
});
