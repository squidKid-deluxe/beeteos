import { ipcRenderer, contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  openURL: async (target) => ipcRenderer.send('openURL', target),
  blockchainRequest: async (args) => await ipcRenderer.invoke('blockchainRequest', args),
  notify: async (msg) => ipcRenderer.send('notify', msg),
  createPopup: async (popupData) => ipcRenderer.send('createPopup', popupData),
  downloadBackup: async (backupData) => ipcRenderer.send('downloadBackup', backupData),
  id: async (args) => await ipcRenderer.invoke('id', args),
  aesEncrypt: async (args) => await ipcRenderer.invoke('aesEncrypt', args),
  aesDecrypt: async (args) => await ipcRenderer.invoke('aesDecrypt', args),
  sha512: async (args) => await ipcRenderer.invoke('sha512', args),
  restore: async (args) => await ipcRenderer.invoke('restore', args),
  onRawDeepLink: (func) => {
    ipcRenderer.on('rawdeeplink', (event, args) => {
      func(args);
    });
  },
  onDeepLink: (func) => {
    ipcRenderer.on('deeplink', (event, args) => {
      func(args);
    });
  },
  getPrompt: (id) => {
    ipcRenderer.send(`get:prompt:${id}`);
  },
  onPrompt: (id, func) => {
    ipcRenderer.on(`respond:prompt:${id}`, (event, data) => {
      func(data);
    });
  },
  getReceipt: (id) => {
    ipcRenderer.send(`get:receipt:${id}`);
  },
  onReceipt: (id, func) => {
    ipcRenderer.on(`respond:receipt:${id}`, (event, data) => {
      func(data);
    });
  },
  launchServer: async (args) => await ipcRenderer.invoke('launchServer', args),
  closeServer: async () => await ipcRenderer.send('closeServer'),
  fetchSSL: async (args) => await ipcRenderer.invoke('fetchSSL', args),
  link: async (args) => await ipcRenderer.on('link', args),
  relink: async (args) => await ipcRenderer.on('relink', args),
  linkResponse: async (args) => await ipcRenderer.send('linkResponse', args),
  addLinkApp: async (func) => {
    ipcRenderer.on("addLinkApp", (event, data) => {
        func(data);
    })
  },
  getLinkApp: async (func) => {
    ipcRenderer.on("getLinkApp", (event, data) => {
        func(data);
    })
  },
  getLinkAppResponse: async (args) => await ipcRenderer.send('getLinkAppResponse', args),
  getAuthApp: async (func) => {
    ipcRenderer.on("getAuthApp", (event, data) => {
        func(data);
    })
  },
  sendAuthResponse: async (args) => await ipcRenderer.send('getAuthResponse', args),
  newRequest: async (func) => {
    ipcRenderer.on("newRequest", (event, data) => {
        func(data);
    })
  },
  timer: (func) => {
    ipcRenderer.on(`resetTimer`, (event, data) => {
      func(data);
    });
  },
  resetTimer: async () => await ipcRenderer.send('resetTimer'),
  getApiApp: async (func) => {
    ipcRenderer.on("getApiApp", (event, data) => {
        func(data);
    })
  },
  sendApiResponse: async (args) => await ipcRenderer.send('getApiResponse', args),
  setNode: (func) => {
    ipcRenderer.on('setNode', (event, args) => {
      func(args);
    });
  },
  onSignMessage: async (func) => {
    ipcRenderer.on("signMessage", (event, data) => {
        func(data);
    })
  },
  executeSignMessage: async (args) => await ipcRenderer.invoke('executeSignMessage', args),
  signMessageResponse: async (args) => await ipcRenderer.send('signMessageResponse', args),
  signMessageError: async (args) => await ipcRenderer.send('signMessageError', args),
});
