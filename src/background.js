// This is main process of Electron, started as first thing when your
// app starts. It runs through entire life of your application.
// It doesn't have any windows which you can see on screen, but we can open
// window from here.
import path from "path";
import url from "url";
import fs from 'fs';
import os from 'os';
//import { argv } from 'node:process';
import queryString from "query-string";
import {PrivateKey} from "bitsharesjs";

import { v4 as uuidv4 } from 'uuid';
import sha512 from "crypto-js/sha512.js";
import aes from "crypto-js/aes.js";
import ENC from 'crypto-js/enc-utf8.js';
import Base64 from 'crypto-js/enc-base64';
import * as secp from "@noble/secp256k1";

import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  dialog,
  ipcMain,
  Notification,
  shell
} from 'electron';

import Logger from './lib/Logger.js';
import {initApplicationMenu} from './lib/applicationMenu.js';
import { getSignature } from "./lib/SecureRemote.js";
import * as Actions from './lib/Actions.js';
import getBlockchainAPI from "./lib/blockchains/blockchainFactory.js";
import BTSWalletHandler from "./lib/blockchains/bitshares/BTSWalletHandler.js";
import BeetServer from './lib/BeetServer.js';

import { injectedCall, voteFor, transfer } from './lib/apiUtils.js';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let modalWindows = {};
let modalRequests = {};
let receiptWindows = {};

var isDevMode = process.execPath.match(/[\\/]electron/);
const logger = new Logger(isDevMode ? 3 : 0);
let tray = null;

/*
 * On modal popup this runs to create child browser window
 */
const createModal = async (arg, modalEvent) => {
    let modalHeight = 600;
    let modalWidth = 800;
    if (!mainWindow) {
        logger.debug(`No window`);
        throw 'No main window';
    }

    let request = arg.request;
    let id = request.id;
    if (!request || !request.id) {
        logger.debug(`No request`);
        throw 'No request';
    }

    if (modalWindows[id] || modalRequests[id]) {
        throw 'Modal exists already!';
    }

    let type = request.type;
    if (!type) {
        throw 'No modal type'
    }

    modalRequests[id] = {request: request, event: modalEvent};
    let targetURL = `file://${__dirname}/modal.html?id=${encodeURIComponent(id)}`;
    let modalData = { id, type, request };

    if (type === Actions.REQUEST_LINK) {
        let existingLinks = arg.existingLinks;
        if (existingLinks) {
            modalRequests[id]['existingLinks'] = existingLinks;
            modalData['existingLinks'] = existingLinks;
        }
    }

    if ([Actions.INJECTED_CALL, Actions.REQUEST_SIGNATURE].includes(type)) {
      let visualizedAccount = arg.visualizedAccount;
      let visualizedParams = arg.visualizedParams;
      if (!visualizedAccount || !visualizedParams) {
        throw 'Missing required visualized fields'
      }
      modalRequests[id]['visualizedAccount'] = visualizedAccount;
      modalRequests[id]['visualizedParams'] = visualizedParams;
      modalData['visualizedAccount'] = visualizedAccount;
      modalData['visualizedParams'] = visualizedParams;
    }

    if ([Actions.VOTE_FOR].includes(type)) {
      let payload = arg.payload;
      if (!payload) {
        throw 'Missing required payload field'
      }
      modalRequests[id]['payload'] = payload;
      modalData['payload'] = payload;
    }

    if ([
      Actions.REQUEST_LINK,
      Actions.REQUEST_RELINK,
      Actions.GET_ACCOUNT,
      Actions.SIGN_MESSAGE,
      Actions.SIGN_NFT
    ].includes(type)) {
      let accounts = arg.accounts;
      if (!accounts) {
        throw 'Missing required accounts field'
      }
      modalRequests[id]['accounts'] = accounts;
      modalData['accounts'] = accounts;
    }

    if ([Actions.TRANSFER].includes(type)) {
      let chain = arg.chain;
      let toSend = arg.toSend;
      let accountName = arg.accountName;

      if (!chain || !accountName || !toSend) {
        throw 'Missing required fields'
      }

      modalRequests[id]['chain'] = chain;
      modalRequests[id]['toSend'] = toSend;
      modalRequests[id]['accountName'] = accountName;

      let target = arg.target;
      modalRequests[id]['target'] = target;

      modalData['chain'] = chain;
      modalData['accountName'] = accountName;
      modalData['target'] = target;
      modalData['toSend'] = toSend;
    }

    if ([Actions.INJECTED_CALL, Actions.TRANSFER].includes(type)) {
        if (arg.isBlockedAccount) {
            modalRequests[id]['warning'] = true;
            modalData['warning'] = "blockedAccount";
        } else if (arg.serverError) {
            modalRequests[id]['warning'] = true;
            modalData['warning'] = "serverError";
        }
    }

    ipcMain.on(`get:prompt:${id}`, (event) => {
        // The modal window is ready to receive data
        event.reply(`respond:prompt:${id}`, modalData);
    });

    modalWindows[id] = new BrowserWindow({
        parent: mainWindow,
        title: 'BeetEOS prompt',
        width: modalWidth,
        height: modalHeight,
        minWidth: modalWidth,
        minHeight: modalHeight,
        maxWidth: modalWidth,
        maximizable: true,
        maxHeight: modalHeight,
        useContentSize: true,
        webPreferences: {
            nodeIntegration: false, // Keep false for security
            contextIsolation: true, // Keep true for security
            enableRemoteModule: false, // Keep false for security
            preload: path.join(__dirname, "preload.js"),
        },
        icon: __dirname + '/img/beet-taskbar.png'
    });

    modalWindows[id].loadURL(targetURL);

    modalWindows[id].once('ready-to-show', () => {
        console.log('ready to show modal')
        modalWindows[id].show();
    })

    modalWindows[id].on('closed', () => {
      if (modalWindows[id]) {
          delete modalWindows[id];
      }

      if (modalRequests[id]) {
          modalRequests[id].event.sender.send(`popupRejected_${id}`, {
              id: id,
              result: {
                  isError: true,
                  method: type,
                  error: 'User closed modal without answering prompt.'
              }
          });
          delete modalRequests[id];
          modalData = {};
      }
    });
}

/*
 * Creating an optional receipt browser window popup
 */
const createReceipt = async (arg, modalEvent) => {
    let modalHeight = 600;
    let modalWidth = 800;
    if (!mainWindow) {
        logger.debug(`No window`);
        throw 'No main window';
    }

    let request = arg.request;
    let id = request.id;
    let result = arg.result;
    let receipt = arg.receipt;
    let notifyTXT = arg.notifyTXT;
    if (!request || !request.id || !result || !notifyTXT || !receipt) {
        logger.debug(`No request`);
        throw 'No request';
    }

    if (receiptWindows[id]) {
        throw 'Receipt window exists already!';
    }

    let targetURL = `file://${__dirname}/receipt.html?id=${encodeURIComponent(id)}`;
   
    ipcMain.on(`get:receipt:${id}`, (event) => {
        // The modal window is ready to receive data
        event.reply(
            `respond:receipt:${id}`,
            { id, request, result, receipt, notifyTXT }
        );
    });

    receiptWindows[id] = new BrowserWindow({
        parent: mainWindow,
        title: 'BeetEOS receipt',
        width: modalWidth,
        height: modalHeight,
        minWidth: modalWidth,
        minHeight: modalHeight,
        maxWidth: modalWidth,
        maximizable: true,
        maxHeight: modalHeight,
        useContentSize: true,
        webPreferences: {
            nodeIntegration: false, // Keep false for security
            contextIsolation: true, // Keep true for security
            enableRemoteModule: false, // Keep false for security
            preload: path.join(__dirname, "preload.js"),
        },
        icon: __dirname + '/img/beet-taskbar.png'
    });

    receiptWindows[id].loadURL(targetURL);

    receiptWindows[id].once('ready-to-show', () => {
        console.log('ready to show modal')
        receiptWindows[id].show();
    })

    receiptWindows[id].on('closed', () => {
      if (receiptWindows[id]) {
          delete receiptWindows[id];
      }
    });
}

/*
 * User approved modal contents. Close window, resolve promise, delete references.
 */
ipcMain.on('clickedAllow', (event, arg) => {
  console.log('ipcmain clickedAllow');
  let id = arg.request.id;

  if (modalWindows[id]) {
    modalWindows[id].close();
    delete modalWindows[id];
  }

  if (modalRequests[id]) {
    modalRequests[id].event.sender.send(`popupApproved_${id}`, arg);
    delete modalRequests[id];
  }
});

/*
 * User rejected modal contents. Close window, reject promise, delete references.
 */
ipcMain.on('clickedDeny', (event, arg) => {
  console.log('ipcmain clickedDeny');
  let id = arg.request.id;

  if (modalWindows[id]) {
    modalWindows[id].close();
    delete modalWindows[id];
  }

  if (modalRequests[id]) {
    modalRequests[id].event.sender.send(`popupRejected_${id}`, arg);
    delete modalRequests[id];
  }
});

/*
 * A modal error occurred. Close window, resolve promise, delete references.
 */
ipcMain.on('modalError', (event, arg) => {
  if (modalWindows[arg.id]) {
    modalWindows[arg.id].close();
    delete modalWindows[arg.id];
  }
  if (modalRequests[arg.id]) {
    modalRequests[arg.id].reject(arg);
    delete modalRequests[arg.id];
  }
});


function _parseDeeplink(
    requestContent,
    chain,
    blockchain,
    blockchainActions,
    settingsRows,
    currentCode
) {
    let processedRequest;
    try {
        processedRequest = decodeURIComponent(requestContent);
    } catch (error) {
        console.log('Processing request failed');
        return;
    }
    
    let parsedRequest;
    try {
        parsedRequest = Base64.parse(processedRequest).toString(ENC)
    } catch (error) {
        console.log('Parsing request failed');
        return;
    }

    let request;
    if (currentCode) {
        let decryptedBytes;
        try {
            decryptedBytes = aes.decrypt(parsedRequest, currentCode);
        } catch (error) {
            console.log(error);
            return;
        }
  
        let decryptedData;
        try {
            decryptedData = decryptedBytes.toString(ENC);
        } catch (error) {
            console.log(error);
            return;
        }

        try {
            request = JSON.parse(decryptedData);
        } catch (error) {
            console.log(error);
            return;
        }
    } else {
        try {
            request = JSON.parse(parsedRequest);
        } catch (error) {
            console.log(error);
            return;
        }
    }

    if (
        !request
        || !request.id
        || !request.payload
        || !request.payload.chain
        || !request.payload.method
        || request.payload.method === Actions.INJECTED_CALL && !request.payload.params
    ) {
        console.log('invalid request format');
        return;
    }
    
    if (chain !== request.payload.chain) {
        console.log("Incoming deeplink request for wrong chain");
        return;
    }

    if (!Object.keys(Actions).map(key => Actions[key]).includes(request.payload.method)) {
        console.log("Unsupported request type rejected");
        return;
    }

    if (!blockchainActions.includes(request.payload.method)) {
        console.log({
            msg: "Unsupported request type rejected",
            request
        });
        return
    }

    if (!settingsRows.includes(request.payload.method)) {
        console.log("Unauthorized beet operation");
        return;
    }

    if (request.payload.method === Actions.INJECTED_CALL) {
        let tr;
        try {
            tr = blockchain._parseTransactionBuilder(request.payload.params);
        } catch (error) {
            console.log(error)
        }

        let authorizedUse = false;
        if (tr && ["BTS", "BTS_TEST", "TUSC"].includes(chain)) {
            for (let i = 0; i < tr.operations.length; i++) {
                let operation = tr.operations[i];
                if (settingsRows && settingsRows.includes(operation[0])) {
                    authorizedUse = true;
                    break;
                }
            }
        } else if (tr && ["EOS", "BEOS", "TLOS"].includes(chain)) {
            for (let i = 0; i < tr.actions.length; i++) {
                let operation = tr.actions[i];
                if (settingsRows && settingsRows.includes(operation.name)) {
                    authorizedUse = true;
                    break;
                }
            }
        }

        if (!authorizedUse) {
            console.log(`Unauthorized use of deeplinked ${chain} blockchain operation`);
            return;
        }
        console.log("Authorized use of deeplinks")
    }

    return {
      id: request.id,
      type: request.payload.method,
      payload: request.payload
    };
}

/*
 * Creating the primary window, only runs once.
 */
const createWindow = async () => {
  let width = 480;
  let height = 695;
  mainWindow = new BrowserWindow({
      width: width,
      height: height,
      minWidth: width,
      minHeight: height,
      maxWidth: width,
      maximizable: false,
      maxHeight: height,
      useContentSize: true,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false, // Keep false for security
        contextIsolation: true, // Keep true for security
        enableRemoteModule: false, // Keep false for security
        preload: path.join(__dirname, "preload.js"),
      },
      icon: __dirname + '/img/beet-taskbar.png'
  });

  initApplicationMenu(mainWindow);
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "index.html"),
      protocol: "file:",
      slashes: true
    })
  );

  tray = new Tray(__dirname + '/img/beet-tray.png');
  const contextMenu = Menu.buildFromTemplate([
      {
          label: 'Show App',
          click: function () {
              mainWindow.show();
          }
      },
      {
          label: 'Quit',
          click: function () {
              app.isQuiting = true;
              tray = null;
              app.quit();
          }
      }
  ]);
  tray.setToolTip('BeetEOS');

  tray.on('right-click', (event, bounds) => {
      tray.popUpContextMenu(contextMenu);
  });

  ipcMain.handle('launchServer', async (event, arg) => {
    const { key, cert } = arg;
    return BeetServer.initialize(
        60554,
        60555,
        key,
        cert,
        mainWindow.webContents
    ).then(() => {
        return {
            http: BeetServer.httpTerminator ? true : false,
            https: BeetServer.httpsTerminator ? true : false
        };
    }).catch((error) => {
        console.log(error);
        return {
            http: false,
            https: false
        };
    })
  });

  ipcMain.on('closeServer', async (event, arg) => {
    let _closure;
    try {
        _closure = await BeetServer.close();
    } catch (error) {
        console.log(error);
    }

    if (_closure) {
        console.log(_closure)
    }
  });

  ipcMain.handle('fetchSSL', async (event, arg) => {
    let key;
    try {
        key = await fetch('https://raw.githubusercontent.com/beetapp/beet-certs/master/beet.key')
                    .then(res => res.text());
    } catch (error) {
        console.log(error);
    }

    let cert;
    try {
        cert = await fetch('https://raw.githubusercontent.com/beetapp/beet-certs/master/beet.cert')
                     .then(res => res.text());
    } catch (error) {
        console.log(error);
    }

    return {key, cert};
  });

  /*
  * Handling front end blockchain requests
  */
  ipcMain.handle('blockchainRequest', async (event, arg) => {
    const { methods, account, chain } = arg;

    let blockchain;
    try {
        blockchain = getBlockchainAPI(chain);
    } catch (error) {
        console.log(error);
        return;
    }

    if (!blockchain) {
        return;
    }

    let blockchainActions = [
        Actions.TRANSFER,
        Actions.VOTE_FOR,
        Actions.INJECTED_CALL
    ];

    let responses = {
      chain
    };

    if (methods.includes("supportsLocal")) {
        responses['supportsLocal'] = blockchain.supportsLocal();
    }

    if (methods.includes("supportsTOTP")) {
        responses['supportsTOTP'] = blockchain.supportsTOTP();
    }

    if (methods.includes("supportsQR")) {
        responses['supportsQR'] = blockchain.supportsQR();
    }

    if (methods.includes("supportsWeb")) {
        responses['supportsWeb'] = blockchain.supportsWeb();
    }

    if (methods.includes("getBalances")) {
        const _usr = account.name ? account.name : account.accountName;
        let _balances;
        try {
            _balances = await blockchain.getBalances(_usr);
        } catch (error) {
            console.log({error, location: "getBalances", user: _usr});
        }

        if (_balances) {
            responses['getBalances'] = JSON.stringify(_balances);
        }
    }

    if (methods.includes("verifyMessage")) {
        const { request } = arg;
        let _verifyMessage;
        try {
            _verifyMessage = await blockchain.verifyMessage(request);
        } catch (error) {
            console.log({error, location: "verifyMessage"});
        }
        if (_verifyMessage) {
            responses['verifyMessage'] = _verifyMessage;
        }
    }

    if (methods.includes("getExplorer")) {
        let _explorer;
        try {
            _explorer = await blockchain.getExplorer({
                accountName: account.name ? account.name : account.accountName
            });
        } catch (error) {
            console.log({error, location: "getExplorer"});
        }

        if (_explorer) {
            responses['getExplorer'] = _explorer;
        }
    }

    if (methods.includes("getAccessType")) {
        responses['getAccessType'] = blockchain.getAccessType();
    }

    if (methods.includes("getImportOptions")) {
        responses['getImportOptions'] = blockchain.getImportOptions();
    }

    if (methods.includes("getOperationTypes")) {
        let _opTypes;
        try {
            _opTypes = await blockchain.getOperationTypes();
        } catch (error) {
            console.log({error, location: "getOperationTypes"});
        }
        responses['getOperationTypes'] = _opTypes;
    }

    if (methods.includes("totpCode")) {
      const { timestamp } = arg;
      const msg = uuidv4();
      let shaMSG = sha512(msg + timestamp).toString().substring(0, 15);
      responses['code'] = shaMSG;
    }

    if (methods.includes("totpDeeplink")) {
      const { requestContent, currentCode, allowedOperations } = arg;

      let apiobj;
      try {
        apiobj = _parseDeeplink(
            requestContent,
            chain,
            blockchain,
            blockchainActions,
            allowedOperations,
            currentCode
        );
      } catch (error) {
        console.log(error);
        return;
      }

      if (!apiobj) {
        return;
      }

      let status;
      try {
          if (apiobj.type === Actions.INJECTED_CALL) {
              status = await injectedCall(apiobj, blockchain);
          } else if (apiobj.type === Actions.VOTE_FOR) {
              status = await voteFor(apiobj, blockchain);
          } else if (apiobj.type === Actions.TRANSFER) {
              status = await transfer(apiobj, blockchain);
          }
      } catch (error) {
          console.log({error: error || "No status"});
          return;
      }

      if (!status || !status.result || status.result.isError || status.result.canceled) {
          console.log("Issue occurred in approved prompt");
          return;
      }

      responses['getRawLink'] = status;
    }

    if (methods.includes("getRawLink")) {
        const { requestBody, allowedOperations } = arg;

        let apiobj;
        try {
            apiobj = _parseDeeplink(
                requestBody,
                chain,
                blockchain,
                blockchainActions,
                allowedOperations
            );
        } catch (error) {
            console.log(error);
            return;
        }

        let status;
        try {
            if (apiobj.type === Actions.INJECTED_CALL) {
                status = await injectedCall(apiobj, blockchain);
            } else if (apiobj.type === Actions.VOTE_FOR) {
                status = await voteFor(apiobj, blockchain);
            } else if (apiobj.type === Actions.TRANSFER) {
                status = await transfer(apiobj, blockchain);
            }
        } catch (error) {
            console.log(error || "No status")
            return;
        }

        if (!status || !status.result || status.result.isError || status.result.canceled) {
            console.log("Issue occurred in approved prompt");
            return;
        }

        responses['getRawLink'] = status;
    }

    if (methods.includes("localFileUpload")) {
      const {allowedOperations, filePath} = arg;
      fs.readFile(filePath, 'utf-8', async (error, data) => {
        if (error) {
          console.log({error})
          return;
        }

        const { requestBody } = data;

        let apiobj;
        try {
            apiobj = _parseDeeplink(
                requestBody,
                chain,
                blockchain,
                blockchainActions,
                allowedOperations
            );
        } catch (error) {
            console.log(error);
            return;
        }

        let status;
        try {
            if (apiobj.type === Actions.INJECTED_CALL) {
                status = await injectedCall(apiobj, blockchain);
            } else if (apiobj.type === Actions.VOTE_FOR) {
                status = await voteFor(apiobj, blockchain);
            } else if (apiobj.type === Actions.TRANSFER) {
                status = await transfer(apiobj, blockchain);
            }
        } catch (error) {
            console.log(error || "No status")
            return;
        }

        if (!status || !status.result || status.result.isError || status.result.canceled) {
            console.log("Issue occurred in approved prompt");
            return;
        }

        responses['localFileUpload'] = status;
      });
    }

    if (methods.includes("processQR")) {
      const { qrChoice, qrData, allowedOperations } = arg;
      let qrTX;
      try {
          qrTX = ["BTS", "BTS_TEST", "TUSC"].includes(chain)
            ? await blockchain.handleQR(qrData)
            : JSON.parse(qrData);
      } catch (error) {
          console.log(error);
          return;
      }

      if (!qrTX) {
          console.log("Couldn't process scanned QR code, sorry.")
          return;
      }

      let authorizedUse = false;
      if (["BTS", "BTS_TEST", "TUSC"].includes(chain)) {
          for (let i = 0; i < qrTX.operations.length; i++) {
              let operation = qrTX.operations[i];
              if (allowedOperations && allowedOperations.includes(operation[0])) {
                  authorizedUse = true;
                  break;
              }
          }
      } else if (
          ["EOS", "BEOS", "TLOS"].includes(chain)
      ) {
          for (let i = 0; i < qrTX.actions.length; i++) {
              let operation = qrTX.actions[i];
              if (allowedOperations && allowedOperations.includes(operation.name)) {
                  authorizedUse = true;
                  break;
              }
          }
      }

      if (!authorizedUse) {
          console.log(`Unauthorized QR use of ${chain} blockchain operation`);
          return;
      }

      console.log('Authorized use of QR codes');

      let apiobj = {
          type: Actions.INJECTED_CALL,
          id: await uuidv4(),
          payload: {
              origin: 'localhost',
              appName: 'qr',
              browser: qrChoice,
              params: ["BTS", "BTS_TEST", "TUSC"].includes(chain)
                ? qrTX.toObject()
                : qrTX,
              chain: chain
          }
      }

      let status;
      try {
          status = await injectedCall(apiobj, blockchain);
      } catch (error) {
          console.log(error);
          return;
      }

      if (!status || !status.result || status.result.isError || status.result.canceled) {
          console.log("Issue occurred in approved prompt");
          return;
      }

      responses['qrData'] = status;
    }

    if (methods.includes("verifyAccount")) {
      const { accountname, authorities } = arg;
      let account;
      try {
          account = await blockchain.verifyAccount(accountname, authorities, chain);
      } catch (error) {
          console.log(error);
          return;
      }

      if (!account) {
          console.log("Couldn't verify account, sorry.")
          return;
      }

      responses['verifyAccount'] = {account, authorities};
    }

    if (methods.includes("verifyCloudAccount")) {
        const { accountname, pass, legacy } = arg;

        const active_seed = accountname + 'active' + pass;
        const owner_seed = accountname + 'owner' + pass;
        const memo_seed = accountname + 'memo' + pass;
        
        let authorities;
        try {
            authorities = legacy
                ? {
                    active: PrivateKey.fromSeed(active_seed).toWif(),
                    memo: PrivateKey.fromSeed(active_seed).toWif(), // legacy wallets improperly used active key for memo
                    owner: PrivateKey.fromSeed(owner_seed).toWif()
                }
                : {
                    active: PrivateKey.fromSeed(active_seed).toWif(),
                    memo: PrivateKey.fromSeed(memo_seed).toWif(),
                    owner: PrivateKey.fromSeed(owner_seed).toWif()
                };
        } catch (error) {
            console.log(error);
            return;
        }

        let account;
        try {
            account = await blockchain.verifyAccount(accountname, authorities);
        } catch (error) {
            console.log(error);
            return;
        }

        if (!account) {
            console.log("Couldn't verify account, sorry.")
            return;
        }

        responses['verifyCloudAccount'] = {account, authorities};
    }

    if (methods.includes("decryptBackup")) {
        const { filePath, pass } = arg;
        fs.readFile(filePath, async (err, data) => {
            if (err) {
                console.log({err});
                return;
            }
    
            let wh = new BTSWalletHandler(data);
            let unlocked;
            try {
                unlocked = await wh.unlock(pass);
            } catch (error) {
                console.log({error});
                return;
            }

            if (!unlocked) {
                console.log("Wallet could not be unlocked");
                return;
            }
    
            let retrievedAccounts;
            try{
                retrievedAccounts = await wh.lookupAccounts();
            } catch (error) {
                console.log({error});
                return;
            }

            responses['decryptBackup'] = retrievedAccounts;
        });
    }

    return responses;
  });

  ipcMain.handle('restore', async (event, arg) => {
    const { file, seed } = arg;

    fs.readFile(file, 'utf-8', async (error, data) => {
        if (error) {
            console.log("Error reading file");
            return;
        }

        let decryptedData;
        try {
            decryptedData = await aes.decrypt(data, seed);
        } catch (error) {
            console.log(error);
            return;
        }

        if (!decryptedData) {
            console.log("Wallet restore failed");
            return;
        }

        return decryptedData;
    });

  });

  const safeDomains = [
    "bloks.io",
    "explore.beos.world",
    "blocksights.info",
    "telos.eosx.io",
    "wallet.tusc.network",
  ];
  ipcMain.on('openURL', (event, arg) => {
    try {
      const parsedUrl = new url.URL(arg);
      const domain = parsedUrl.hostname;
      if (safeDomains.includes(domain)) {
        shell.openExternal(arg);
      } else {
        console.error(`Rejected opening URL with unsafe domain: ${domain}`);
      }
    } catch (err) {
      console.error(`Failed to open URL: ${err.message}`);
    }
  });

  /*
   * Create modal popup & wait for user response
   */
  ipcMain.on('createPopup', async (event, arg) => {
      try {
        await createModal(arg, event);
      } catch (error) {
        console.log(error);
      }
  })

    /*
   * Create receipt popup & wait for user response
   */
    ipcMain.on('createReceipt', async (event, arg) => {
        try {
          await createReceipt(arg, event);
        } catch (error) {
          console.log(error);
        }
    })

  ipcMain.on('notify', (event, arg) => {
      logger.debug("notify");
      const NOTIFICATION_TITLE = 'Beet wallet notification';
      const NOTIFICATION_BODY = arg == 'request' ? "Beet has received a new request." : arg;

      if (os.platform === 'win32')
      {
          app.setAppUserModelId(app.name);
      }

      function showNotification () {
        new Notification({
          title: NOTIFICATION_TITLE,
          subtitle: 'subtitle',
          body: NOTIFICATION_BODY,
          icon: __dirname + '/img/beet-tray.png',
        }).show()
      }

      showNotification();
  });

  ipcMain.handle('aesEncrypt', async (event, arg) => {
    const { data, seed } = arg;

    let encryptedData;
    try {
        encryptedData = aes.encrypt(data, seed).toString();
    } catch (error) {
        console.log(error);
        return;
    }

    return encryptedData;
  });

    ipcMain.handle('aesDecrypt', async (event, arg) => {
        const { data, seed } = arg;

        let decryptedData;
        try {
            decryptedData = await aes.decrypt(data, seed);
        } catch (error) {
            console.log(error);
            return;
        }

        let decryptedString;
        try {
            decryptedString = JSON.parse(decryptedData.toString(ENC));
        } catch (error) {
            console.log(error);
            return;
        }
    
        return decryptedString;
    });

  ipcMain.handle('sha512', async (event, arg) => {
    const { data } = arg;

    let hash;
    try {
        hash = sha512(data).toString();
    } catch (error) {
        console.log(error);
        return;
    }

    return hash;
  });

  ipcMain.handle('id', (event, arg) => {
    const id = uuidv4();
    return id;
  });

  ipcMain.handle('encParse', (event, arg) => {
    const {data} = arg;
    console.log({data});
    return JSON.parse(data.toString(ENC))
  });

  ipcMain.on('decrypt', async (event, arg) => {
      const {data, seed} = arg;

      let decryptedData;
      try {
        decryptedData = await aes.decrypt(data, seed).toString(ENC);
      } catch (error) {
        console.log(error);
      }

      if (event && event.sender) {
        event.sender.send(
          decryptedData ? 'decrypt_success' : 'decrypt_fail',
          decryptedData ?? 'decryption failure'
        );
      } else {
        console.log("No event || event.sender")
      }
  });

  ipcMain.on('downloadBackup', async (event, arg) => {
    const { walletName, accounts, seed } = arg;
    let toLocalPath = path.resolve(
      app.getPath("desktop"),
      `BeetBackup-${walletName}-${new Date().toISOString().slice(0,10)}.beet`
    );
    dialog.showSaveDialog({ defaultPath: toLocalPath })
          .then(async (result) => {
            if (result.canceled) {
              console.log("Cancelled saving backup.")
              return;
            }

            let response = await getSignature('backup');
            if (!response) {
              console.log("Error: No signature");
              return;
            }

            let isValid;
            try {
              isValid = await secp.verify(
                response.signedMessage,
                response.msgHash,
                response.pubk
              );
            } catch (error) {
              console.log(error);
              return;
            }

            if (!isValid) {
              console.log("Failed to backup wallet (validation)");
              return;
            }

            let encrypted;
            try {
              encrypted = await aes.encrypt(
                JSON.stringify({
                    wallet: walletName,
                    accounts: JSON.parse(accounts)
                }),
                seed
              ).toString();
            } catch (error) {
              console.log(`encrypt: ${error}`);
              return;
            }

            if (!encrypted) {
              console.log("Failed to backup wallet (encryption)");
              return;
            }

            if (encrypted) {
              fs.writeFileSync(result.filePath, encrypted);
            }

          }).catch((error) => {
            console.log(error)
          });

  });

  ipcMain.on('log', (event, arg) => {
      logger[arg.level](arg.data);
  });

  tray.on('click', () => {
      mainWindow.setAlwaysOnTop(true);
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(false);
  });

  tray.on('balloon-click', () => {
      mainWindow.setAlwaysOnTop(true);
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(false);
  });
};

app.disableHardwareAcceleration();

let currentOS = os.platform();
if (currentOS == 'win32') {
    // windows specific steps
    const gotTheLock = app.requestSingleInstanceLock()

    if (!gotTheLock) {
        app.quit()
    } else {
        // Handle the protocol. In this case, we choose to show an Error Box.
        app.on('second-instance', (event, args) => {
            // Someone tried to run a second instance, we should focus our window.
            if (mainWindow) {
                if (mainWindow.isMinimized()) {
                    mainWindow.restore()
                }
                mainWindow.focus()
                
                if (process.platform == 'win32' && args.length > 2) {
                    let urlType = args[3].includes('raw') ? 'rawdeeplink' : 'deeplink';

                    let deeplinkingUrl = args[3].replace(
                        urlType === 'deeplink' ? 'beeteos://api/' : 'rawbeeteos://api/',
                        ''
                    );

                    let qs;
                    try {
                        qs = queryString.parse(deeplinkingUrl);
                    } catch (error) {
                        console.log(error);
                        return;
                    }

                    if (qs) {
                        mainWindow.webContents.send(urlType, qs);
                    }
                }

            }
        })
    
        let defaultPath;
        try {
            defaultPath = path.resolve(process.argv[1]);
        } catch (error) {
            console.log(error)
        }
        
        app.setAsDefaultProtocolClient('beeteos', process.execPath, [defaultPath])
        app.setAsDefaultProtocolClient('rawbeeteos', process.execPath, [defaultPath])

        app.whenReady().then(() => {
            createWindow();
        });       
    }
} else {
    app.setAsDefaultProtocolClient('beeteos')
    app.setAsDefaultProtocolClient('rawbeeteos')
    
    // mac or linux
    app.whenReady().then(() => {
        createWindow()
    })
    
    // Handle the protocol. In this case, we choose to show an Error Box.
    app.on('open-url', (event, urlString) => {
        let urlType = urlString.contains('raw') ? 'rawdeeplink' : 'deeplink';

        let deeplinkingUrl = urlString.replace(
            urlType === 'deeplink' ? 'beeteos://api/' : 'rawbeeteos://api/',
            ''
        );

        let qs;
        try {
            qs = queryString.parse(deeplinkingUrl);
        } catch (error) {
            console.log(error);
            return;
        }

        if (qs) {
            mainWindow.webContents.send(urlType, qs);
        }
    })

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    // Quit when all windows are closed.
    app.on('window-all-closed', () => {
        // On OS X it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
    
    app.on('activate', () => {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (mainWindow === null) {
            createWindow();
        }
    });
}

