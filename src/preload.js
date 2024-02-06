const { ipcRenderer, contextBridge } = require("electron");

async function _openURL(target) {
  ipcRenderer.send('openURL', target);
}
contextBridge.exposeInMainWorld('electron', {
  openURL: async (target) => _openURL(target),
  blockchainRequest: async (args) => await ipcRenderer.invoke('blockchainRequest', args),
  notify: async (msg) => ipcRenderer.send('notify', msg),
  createPopup: async (popupData) => ipcRenderer.send('createPopup', popupData),
  clickedAllow: async (allowData) => ipcRenderer.send('clickedAllow', allowData),
  clickedDeny: async (denyData) => ipcRenderer.send('clickedDeny', denyData),
  downloadBackup: async (backupData) => ipcRenderer.send('downloadBackup', backupData),
  timeout: async (callbackFn) => ipcRenderer.on('timeout', async (event, args) => {
    callbackFn();
  }),
});
