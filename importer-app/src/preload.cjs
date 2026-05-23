const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nxt5', {
  generateImport: (form) => ipcRenderer.invoke('generate-import', form)
});
