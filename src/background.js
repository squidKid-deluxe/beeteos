// This is main process of Electron, started as first thing when your
// app starts. It runs through entire life of your application.
// It doesn't have any windows which you can see on screen, but we can open
// window from here.
import path from "path";
import url from "url";
import fs from 'fs';
import os from 'os';
import { argv } from 'node:process';
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
  Notification
} from 'electron';

import Logger from '~/lib/Logger';
import {initApplicationMenu} from '~/lib/applicationMenu';
import { getSignature } from "./lib/SecureRemote";
import * as Actions from './lib/Actions';
import getBlockchainAPI from "./lib/blockchains/blockchainFactory";
import BTSWalletHandler from "./lib/blockchains/bitshares/BTSWalletHandler";

import { injectedCall, voteFor, transfer } from './lib/apiUtils.js';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let modalWindows = {};
let modalRequests = {};

let receiptWindows = {};
var timeout;

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
        title: 'Beet prompt',
        width: modalWidth,
        height: modalHeight,
        minWidth: modalWidth,
        minHeight: modalHeight,
        maxWidth: modalWidth,
        maximizable: true,
        maxHeight: modalHeight,
        useContentSize: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
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
        title: 'Beet receipt',
        width: modalWidth,
        height: modalHeight,
        minWidth: modalWidth,
        minHeight: modalHeight,
        maxWidth: modalWidth,
        maximizable: true,
        maxHeight: modalHeight,
        useContentSize: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
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
          nodeIntegration: true,
          contextIsolation: false,
          enableRemoteModule: true
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

  /*
  * Handling front end blockchain requests
  */
  ipcMain.on('blockchainRequest', async (event, arg) => {
    const { method, account, chain, location } = arg;

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

    if (method.includes("getBalances")) {
        blockchain.getBalances(account.name)
        .then(result => {
            responses['getBalances'] = result;
            return result;
        })
        .catch(error => {
            console.log(error);
        });
    }

    if (method.includes("getExplorer")) {
        responses['getExplorer'] = blockchain.getExplorer(account.name);
    }

    if (method.includes("getAccessType")) {
        responses['getAccessType'] = blockchain.getAccessType();
    }

    if (method.includes("getImportOptions")) {
        responses['getImportOptions'] = blockchain.getImportOptions();
    }

    if (method.includes("getOperationTypes")) {
        responses['getOperationTypes'] = blockchain.getOperationTypes();
    }

    if (method.includes("totpCode")) {
      const { timestamp } = arg;
      const msg = uuidv4();
      let shaMSG = sha512(msg + timestamp).toString().substring(0, 15);
      responses['code'] = shaMSG;
    }

    if (method.includes("totpDeeplink")) {
      const { requestContent, currentCode } = args;

      let processedRequest;
      try {
          processedRequest = decodeURIComponent(requestContent);
      } catch (error) {
          console.log('Processing request failed');
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
      }
      
      let parsedRequest;
      try {
          parsedRequest = Base64.parse(processedRequest).toString(ENC)
      } catch (error) {
          console.log('Parsing request failed');
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
      }

      let decryptedBytes;
      try {
          decryptedBytes = aes.decrypt(parsedRequest, currentCode.value);
      } catch (error) {
          console.log(error);
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
      }

      let decryptedData;
      try {
          decryptedData = decryptedBytes.toString(ENC);
      } catch (error) {
          console.log(error);
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
      }

      let request;
      try {
          request = JSON.parse(decryptedData);
      } catch (error) {
          console.log(error);
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
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
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
      }
      
      let requestedChain = request.payload.chain;
      if (!requestedChain || chain !== requestedChain) {
          console.log("Incoming deeplink request for wrong chain");
          mainWindow.webContents.send(`blockchainResponse:${location}:fail`);
          return;
      }

      if (!Object.keys(Actions).map(key => Actions[key]).includes(request.payload.method)) {
          console.log("Unsupported request type rejected");
          mainWindow.webContents.send(`blockchainResponse:${location}:fail`);
          return;
      }

      let apiobj = {
          id: request.id,
          type: request.payload.method,
          payload: request.payload
      };

      if (!blockchainActions.includes(apiobj.type)) {
          console.log({
              msg: "Unsupported request type rejected",
              apiobj
          });
          mainWindow.webContents.send(`blockchainResponse:${location}:fail`);
      }


      if (!settingsRows.value.includes(apiobj.type)) {
          console.log("Unauthorized beet operation");
          mainWindow.webContents.send(`blockchainResponse:${location}:fail`);
          return;
      }

      if (apiobj.type === Actions.INJECTED_CALL) {
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
                  if (settingsRows.value && settingsRows.value.includes(operation[0])) {
                      authorizedUse = true;
                      break;
                  }
              }
          } else if (tr && ["EOS", "BEOS", "TLOS"].includes(chain)) {
              for (let i = 0; i < tr.actions.length; i++) {
                  let operation = tr.actions[i];
                  if (settingsRows.value && settingsRows.value.includes(operation.name)) {
                      authorizedUse = true;
                      break;
                  }
              }
          }

          if (!authorizedUse) {
              console.log(`Unauthorized use of deeplinked ${chain} blockchain operation`);
              mainWindow.webContents.send(`blockchainResponse:${location}:fail`);
              return;
          }
          console.log("Authorized use of deeplinks")
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
          mainWindow.webContents.send(`blockchainResponse:${location}:fail`);
          return;
      }

      if (!status || !status.result || status.result.isError || status.result.canceled) {
          console.log("Issue occurred in approved prompt");
          mainWindow.webContents.send(`blockchainResponse:${location}:fail`);
          return;
      }

      mainWindow.webContents.send(`blockchainResponse:${location}`, {status});
    }

    if (method.includes("getRawLink")) {
       
      let processedRequest;
      try {
          processedRequest = decodeURIComponent(args.request);
      } catch (error) {
          console.log('Processing request failed');
          deepLinkInProgress.value = false;
          ipcRenderer.send("notify", t("common.raw.promptFailure"));
          return;
      }

      let request;
      try {
          request = JSON.parse(processedRequest);
      } catch (error) {
          console.log(error);
          deepLinkInProgress.value = false;
          ipcRenderer.send("notify", t("common.raw.promptFailure"));
          return;
      }

      if (
          !request
          || !request.id
          || !request.payload
          || !request.payload.chain
          || !request.payload.method
          || request.payload.method === Actions.INJECTED_CALL && !request.payload.params
      ) {
          console.log('invalid request format')
          deepLinkInProgress.value = false;
          ipcRenderer.send("notify", t("common.raw.promptFailure"));
          return;
      }

      let requestedChain = args.chain || request.payload.chain;
      if (!requestedChain || chain.value !== requestedChain) {
          console.log("Incoming deeplink request for wrong chain");
          ipcRenderer.send("notify", t("common.raw.failed"));
          deepLinkInProgress.value = false;
          return;
      }

      if (!Object.keys(Actions).map(key => Actions[key]).includes(request.payload.method)) {
          console.log("Unsupported request type rejected");
          return;
      }

      let apiobj = {
          id: request.id,
          type: request.payload.method,
          payload: request.payload
      };

      let blockchain;
      if (blockchainActions.includes(apiobj.type)) {
          try {
              blockchain = await getBlockchainAPI(chain);
          } catch (error) {
              console.log(error);
              deepLinkInProgress.value = false;
              return;
          }
      }

      if (!blockchain) {
          console.log('no blockchain')
          deepLinkInProgress.value = false;
          return;
      }

      if (!settingsRows.value.includes(apiobj.type)) {
          console.log("Unauthorized beet operation")
          deepLinkInProgress.value = false;
          return;
      }

      if (apiobj.type === Actions.INJECTED_CALL) {
          let tr;
          try {
              if (["BTS", "BTS_TEST", "TUSC"].includes(chain)) {
                  tr = blockchain._parseTransactionBuilder(request.payload.params);
              } else if (["EOS", "BEOS", "TLOS"].includes(chain)) {
                  tr = JSON.parse(request.payload.params[1]);
              }                
          } catch (error) {
              console.log(error)
          }

          let authorizedUse = false;
          if (["BTS", "BTS_TEST", "TUSC"].includes(chain)) {
              for (let i = 0; i < tr.operations.length; i++) {
                  let operation = tr.operations[i];
                  if (settingsRows.value && settingsRows.value.includes(operation[0])) {
                      authorizedUse = true;
                      break;
                  }
              }
          } else if (["EOS", "BEOS", "TLOS"].includes(chain)) {
              for (let i = 0; i < tr.actions.length; i++) {
                  let operation = tr.actions[i];
                  if (settingsRows.value && settingsRows.value.includes(operation.name)) {
                      authorizedUse = true;
                      break;
                  }
              }
          }

          if (!authorizedUse) {
              console.log(`Unauthorized use of raw deeplinked ${chain.value} blockchain operation`);              
              deepLinkInProgress.value = false;
              return;
          }
          console.log("Authorized use of raw deeplinks")
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
          deepLinkInProgress.value = false;
          return;
      }

      if (!status || !status.result || status.result.isError || status.result.canceled) {
          console.log("Issue occurred in approved prompt");
          deepLinkInProgress.value = false;
          return;
      }

      console.log(status);
      deepLinkInProgress.value = false;
    }

    if (method.includes("localFileUpload")) {
      const {settingsRows, filePath} = arg;
      fs.readFile(filePath, 'utf-8', async (error, data) => {
        if (error) {
          console.log({error})
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
        }

        const { requestBody } = data;

        let request;
        try {
          request = JSON.parse(requestBody);
        } catch (error) {
          console.log(error);
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
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
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
        }

        let requestedChain = request.payload.chain;
        if (!requestedChain || chain !== requestedChain) {
          console.log("Incoming uploaded request for wrong chain");
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
        }

        if (!Object.keys(Actions).map(key => Actions[key]).includes(request.payload.method)) {
          console.log("Unsupported request type rejected");
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
        }

        if (!blockchainActions.includes(request.payload.method)) {
          console.log("Unsupported request type rejected");
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
        }

        if (!settingsRows.includes(request.payload.method)) {
          console.log("Unauthorized beet operation");
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
        }

        if (request.payload.method === Actions.INJECTED_CALL) {
            let tr;
            try {
                tr = blockchain._parseTransactionBuilder(request.payload.params);
            } catch (error) {
                console.log(error);
                mainWindow.webContents.send(`blockchainResponse:${location}:error`);
                return;
            }

            let authorizedUse = false;
            for (let i = 0; i < tr.operations.length; i++) {
                let operation = tr.operations[i];
                if (settingsRows && settingsRows.includes(operation[0])) {
                    authorizedUse = true;
                    break;
                }
            }

            if (!authorizedUse) {
                console.log(`Unauthorized use of local ${chain.value} blockchain operation`);              
                mainWindow.webContents.send(`blockchainResponse:${location}:error`);
                return;
            }
            console.log("Authorized use of local json upload")
        }

        let apiobj = {
            id: request.id,
            type: request.payload.method,
            payload: request.payload
        };

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
            mainWindow.webContents.send(`blockchainResponse:${location}:error`);
            return;
        }

        if (!status || !status.result || status.result.isError || status.result.canceled) {
            console.log("Issue occurred in approved prompt");
            mainWindow.webContents.send(`blockchainResponse:${location}:error`);
            return;
        }

        responses['localFileUpload'] = status;
      });
    }

    if (method.includes("processQR")) {
      const { qrChoice, qrData, settingsRows } = arg;
      let qrTX;
      try {
          qrTX = ["BTS", "BTS_TEST", "TUSC"].includes(chain)
            ? await blockchain.handleQR(qrData)
            : JSON.parse(qrData);
      } catch (error) {
          console.log(error);
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
      }

      if (!qrTX) {
          console.log("Couldn't process scanned QR code, sorry.")
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
      }

      let authorizedUse = false;
      if (["BTS", "BTS_TEST", "TUSC"].includes(chain)) {
          for (let i = 0; i < qrTX.operations.length; i++) {
              let operation = qrTX.operations[i];
              if (settingsRows && settingsRows.includes(operation[0])) {
                  authorizedUse = true;
                  break;
              }
          }
      } else if (
          ["EOS", "BEOS", "TLOS"].includes(chain)
      ) {
          for (let i = 0; i < qrTX.actions.length; i++) {
              let operation = qrTX.actions[i];
              if (settingsRows && settingsRows.includes(operation.name)) {
                  authorizedUse = true;
                  break;
              }
          }
      }

      if (!authorizedUse) {
          console.log(`Unauthorized QR use of ${chain} blockchain operation`);
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
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
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
      }

      if (!status || !status.result || status.result.isError || status.result.canceled) {
          console.log("Issue occurred in approved prompt");
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
      }

      responses['qrData'] = status;
    }

    if (method.includes("verifyAccount")) {
      const { accountname, authorities } = arg;
      let account;
      try {
          account = await blockchain.verifyAccount(accountname, authorities, chain);
      } catch (error) {
          console.log(error);
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
      }

      if (!account) {
          console.log("Couldn't verify account, sorry.")
          mainWindow.webContents.send(`blockchainResponse:${location}:error`);
          return;
      }

      responses['verifyAccount'] = {account, authorities};
    }

    if (method.includes("verifyCloudAccount")) {
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
            mainWindow.webContents.send(`blockchainResponse:${location}:error`);
            return;
        }

        let account;
        try {
            account = await blockchain.verifyAccount(accountname, authorities);
        } catch (error) {
            console.log(error);
            mainWindow.webContents.send(`blockchainResponse:${location}:error`);
            return;
        }

        if (!account) {
            console.log("Couldn't verify account, sorry.")
            mainWindow.webContents.send(`blockchainResponse:${location}:error`);
            return;
        }

        responses['verifyCloudAccount'] = {account, authorities};
    }

    if (method.includes("decryptBackup")) {
        const { filePath, pass } = arg;
        fs.readFile(filePath, async (err, data) => {
            if (err) {
                console.log({err});
                mainWindow.webContents.send(`blockchainResponse:${location}:error`);
                return;
            }
    
            let wh = new BTSWalletHandler(data);
            let unlocked;
            try {
                unlocked = await wh.unlock(pass);
            } catch (error) {
                console.log({error});
                mainWindow.webContents.send(`blockchainResponse:${location}:error`);
                return;
            }

            if (!unlocked) {
                console.log("Wallet could not be unlocked");
                mainWindow.webContents.send(`blockchainResponse:${location}:error`);
                return;
            }
    
            let retrievedAccounts;
            try{
                retrievedAccounts = await wh.lookupAccounts();
            } catch (error) {
                console.log({error});
                mainWindow.webContents.send(`blockchainResponse:${location}:error`);
                return;
            }

            responses['decryptBackup'] = retrievedAccounts;
        });
    }

    mainWindow.webContents.send(`blockchainResponse:${location}`, responses);
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

  let seed;
  function timeoutHandler() {
      seed = null;
      try {
        mainWindow.webContents.send('timeout', 'logout');
      } catch (error) {
        console.log(error);
      }
      clearTimeout(timeout);
  }

  ipcMain.on('seeding', (event, arg) => {
      if (timeout) {
          clearTimeout(timeout);
      }
      if (arg != '') {
          timeout = setTimeout(timeoutHandler, 300000);
      }
      seed = arg;
  });

  ipcMain.on('decrypt', async (event, arg) => {
      if (timeout) {
          clearTimeout(timeout);
      }
      timeout = setTimeout(timeoutHandler, 300000);

      let dataToDecrypt = arg.data;

      let decryptedData;
      try {
        decryptedData = await aes.decrypt(dataToDecrypt, seed).toString(ENC);
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
    let walletName = arg.walletName;
    let accounts = JSON.parse(arg.accounts);
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
                JSON.stringify({wallet: walletName, accounts: accounts}),
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
            defaultPath = path.resolve(argv[1]);
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

