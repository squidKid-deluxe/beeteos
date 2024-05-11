import { ipcRenderer, contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    // MISC
    openURL: async (target) => ipcRenderer.send('openURL', target), // Links to explorers
    notify: async (msg) => ipcRenderer.send('notify', msg), // Triggering an electron notification prompt
    timer: (func) => { // Creating a timer event
        ipcRenderer.on(`resetTimer`, (event, data) => {
            func(data);
        });
    },
    resetTimer: async () => await ipcRenderer.send('resetTimer'), // Prevent wallet logout timer from reaching 0
    blockchainRequest: async (args) => await ipcRenderer.invoke('blockchainRequest', args), // Used in many components
    setNode: (func) => { // For storing the current connected blockchain node
        ipcRenderer.on('setNode', (event, args) => {
            func(args);
        });
    },
    // Stores
    seed: (args) => ipcRenderer.send('seed', args),
    decrypt: async (args) => await ipcRenderer.invoke('decrypt', args),
    id: async (args) => await ipcRenderer.invoke('id', args),
    aesEncrypt: async (args) => await ipcRenderer.invoke('aesEncrypt', args),
    aesDecrypt: async (args) => await ipcRenderer.invoke('aesDecrypt', args),
    sha512: async (args) => await ipcRenderer.invoke('sha512', args),
    getSignature: async (args) => await ipcRenderer.invoke('getSignature', args),
    verifyCrypto: async (args) => await ipcRenderer.invoke('verifyCrypto', args),
    // Backup and restore functionality
    downloadBackup: async (backupData) => ipcRenderer.send('downloadBackup', backupData),
    restore: async (args) => await ipcRenderer.invoke('restore', args),
    // Listening for raw/totp deeplink triggers
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
    // Creating popups for prompts and receipts
    createPopup: async (popupData) => ipcRenderer.send('createPopup', popupData),
    popupApproved: (id, func) => {
        ipcRenderer.on(`popupApproved_${id}`, (event, data) => {
            func(data);
        });
    },
    popupRejected: (id, func) => {
        ipcRenderer.on(`popupRejected_${id}`, (event, data) => {
            func(data);
        });
    },
    createReceipt: async (receiptData) => ipcRenderer.send('createReceipt', receiptData),
    // WWW
    launchServer: async (args) => await ipcRenderer.invoke('launchServer', args),
    closeServer: async () => await ipcRenderer.send('closeServer'),
    fetchSSL: async (args) => await ipcRenderer.invoke('fetchSSL', args),
    // Beeteos-js
    link: async (func) => {
        ipcRenderer.on("link", (event, data) => {
            func(data);
        })
    },
    relink: async (func) => {
        ipcRenderer.on("relink", (event, data) => {
            func(data);
        })
    },
    linkError: async (args) => await ipcRenderer.send('linkError', args),
    relinkError: async (args) => await ipcRenderer.send('relinkError', args),
    linkResponse: async (args) => await ipcRenderer.send('linkResponse', args),
    // Establishing web connection
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
    // Establishing web dapp linkage
    addLinkApp: async (func) => { // Store then return the link app object
        ipcRenderer.on("addLinkApp", (event, data) => {
            func(data);
        })
    },
    getLinkApp: async (func) => { // Retrieve existing linked app
        ipcRenderer.on("getLinkApp", (event, data) => {
            func(data);
        })
    },
    sendLinkAppResponse: async (args) => await ipcRenderer.send('getLinkAppResponse', args),
    // Handling web dapp requests
    getApiApp: async (func) => {
        ipcRenderer.on("getApiApp", (event, data) => {
            func(data);
        })
    },
    sendApiResponse: async (args) => await ipcRenderer.send('getApiResponse', args),
    // Responding to message signature requests
    onSignMessage: async (func) => {
        ipcRenderer.on("signMessage", (event, data) => {
            func(data);
        })
    },
    executeSignMessage: async (args) => await ipcRenderer.invoke('executeSignMessage', args),
    signMessageResponse: async (args) => await ipcRenderer.send('signMessageResponse', args),
    signMessageError: async (args) => await ipcRenderer.send('signMessageError', args),
    // Signing nfts on bts
    onSignNFT: async (func) => {
        ipcRenderer.on("signNFT", (event, data) => {
            func(data);
        })
    },
    signNFTResponse: async (args) => await ipcRenderer.send('signNFTResponse', args),
    signNFTError: async (args) => await ipcRenderer.send('signNFTError', args),
    // Handling injected calls
    onInjectedCall: async (func) => {
        ipcRenderer.on("injectedCall", (event, data) => {
            func(data);
        })
    },
    injectedCallResponse: async (args) => await ipcRenderer.send('injectedCallResponse', args),
    injectedCallError: async (args) => await ipcRenderer.send('injectedCallError', args),
    // Signing messages
    onRequestSignature: async (func) => {
        ipcRenderer.on("requestSignature", (event, data) => {
            func(data);
        })
    },
    sendSignatureResponse: async (args) => await ipcRenderer.send('signatureResponse', args),
    sendSignatureError: async (args) => await ipcRenderer.send('signatureError', args),
    //
    onGetSafeAccount: async (func) => {
        ipcRenderer.on("getSafeAccount", (event, data) => {
            func(data);
        })
    },
    getSafeAccountResponse: async (args) => await ipcRenderer.send('getSafeAccountResponse', args),
    // Informing 3rd party dapps of selected account details
    onGetAccount: async (func) => {
        ipcRenderer.on("getAccount", (event, data) => {
            func(data);
        })
    },
    getAccountResponse: async (args) => await ipcRenderer.send('getAccountResponse', args),
    getAccountError: async (args) => await ipcRenderer.send('getAccountError', args),
    //
    onVerifyMessage: async (func) => {
        ipcRenderer.on("verifyMessage", (event, data) => {
            func(data);
        })
    },
    verifyMessageResponse: async (args) => await ipcRenderer.send('verifyMessageResponse', args),
    verifyMessageError: async (args) => await ipcRenderer.send('verifyMessageError', args),
    //
    removeAllListeners: async (msg) => await ipcRenderer.removeAllListeners(msg),
    //
    /*
    // For logging background issues to renderer dev console
    onMainLog: async (func) => {
        ipcRenderer.on("mainLog", (event, data) => {
            func(data);
        })
    },
    */
});
