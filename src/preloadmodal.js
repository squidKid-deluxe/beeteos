import { ipcRenderer, contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  blockchainRequest: async (args) => await ipcRenderer.invoke('blockchainRequest', args),
  clickedAllow: async (allowData) => ipcRenderer.send('clickedAllow', allowData),
  clickedDeny: async (denyData) => ipcRenderer.send('clickedDeny', denyData),
  resetTimer: async () => await ipcRenderer.send('resetTimer'),
  getLocationSearch: () => window.location.search,
  getPrompt: (id) => {
    ipcRenderer.send(`get:prompt:${id}`);
  },
  onPrompt: (id, func) => {
    ipcRenderer.on(`respond:prompt:${id}`, (event, data) => {
        func(data);
    });
  },
});
