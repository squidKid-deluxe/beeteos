import { ipcMain } from "electron";
import * as OTPAuth from "otpauth";

import sha256 from "crypto-js/sha256.js";
import aes from "crypto-js/aes.js";
import ENC from 'crypto-js/enc-utf8.js';
import * as ed from '@noble/ed25519';

import https from 'node:https';
import http from 'node:http';
import {
  createHttpTerminator,
} from 'http-terminator';
import { Server } from "socket.io";

import getBlockchainAPI from "./blockchains/blockchainFactory.js";

import * as Actions from './Actions.js';

/**
 * Create beet link
 * @parameter {socket} socket
 * @parameter {object} target
 */
async function _establishLink(socket, target) {
    socket.isLinked = true;
    socket.identityhash = target.identityhash;
    socket.account_id = target.app.account_id;
    socket.chain = target.app.chain;
    socket.next_hash = target.app.next_hash;
    socket.otp = new OTPAuth.HOTP({
        issuer: "Beet",
        label: "BeetAuth",
        algorithm: "SHA1",
        digits: 32,
        counter: 0,
        secret: OTPAuth.Secret.fromHex(target.app.secret)
    });
}

/**
 * Create beet link
 * @parameter {object} result
 * @returns {object}
 */
function _getLinkResponse(result) {
    if (!result.isLinked == true && !result.link == true) {
      return {
          id: result.id,
          error: true,
          payload: {
              code: 6,
              message: "Could not link to Beet"
          }
      };
    }

    let response = {
        id: result.id,
        error: false,
        payload: {
            authenticate: true,
            link: true,
            chain: result.app ? result.chain : result.identity.chain,
            existing: result.existing,
            identityhash: result.identityhash,
            requested: {
                account: {
                    name: result.app
                            ? result.app.account_name
                            : result.identity.name,
                    id: result.app
                            ? result.app.account_id
                            : result.identity.id
                }
            }
        }
    };

    /*
    // todo: analyze why the account name is not set and treat the cause not the sympton
    if (!response.payload.requested.account.name) {
        response.payload.requested.account.name = store.state.AccountStore.accountlist.find(
            x => x.accountID == response.payload.requested.account.id
        ).accountName;
    }
    */

    return response;
}

const rejectRequest = (req, reject, error) => {
  console.log(error)
  return reject({
      id: req.id,
      result: {
          isError: true,
          error: error
      }
  });
}

export default class BeetServer {
    static httpSocket;
    static httpsSocket;
    static webContents;

    /**
     * Responding to multiple API query types
     * @parameter {socket} socket
     * @parameter {request} data
     */
    static async respondAPI(socket, data) {
        let hash = await sha256('' + data.id).toString();

        if (!hash === socket.next_hash) {
            console.log("Unexpected request hash")
            socket.emit("api", {id: data.id, error: true, payload: {code: 2, message: "Unexpected request hash. Please relink then resubmit api request."}})
            return;
        }

        var key = socket.otp.generate();

        let decryptedValue;
        try {
            decryptedValue = aes.decrypt((data.payload).toString(), key).toString(ENC);
        } catch (error) {
            console.log(error);
        }

        if (!decryptedValue) {
            console.log("Could not decrypt message");
            socket.emit("api", {id: data.id, error: true, payload: {code: 3, message: "Could not decrypt message"}});
            return;
        }

        let msg = JSON.parse(decryptedValue);
        if (!Object.keys(Actions).map(key => Actions[key]).includes(msg.method)) {
            console.log("Unauthorized use of injected operation");
            socket.emit("api", {id: data.id, error: true, payload: {code: 3, message: "Request type not supported."}});
            return;
        }

        socket.next_hash = msg.next_hash;
        msg.origin = socket.origin;
        msg.appName = socket.appName;
        msg.identityhash = socket.identityhash;
        msg.chain = socket.chain;
        msg.account_id = socket.account_id;

        let apiobj = {
            client: socket.id,
            id: data.id,
            type: msg.method,
            payload: msg
        };

        let blockchainActions = [
            Actions.SIGN_MESSAGE,
            Actions.SIGN_NFT,
            Actions.VERIFY_MESSAGE,
            Actions.INJECTED_CALL,
            Actions.REQUEST_SIGNATURE
        ];

        let blockchain;
        if (blockchainActions.includes(apiobj.type)) {
            try {
                blockchain = await getBlockchainAPI(apiobj.payload.chain);
            } catch (error) {
                console.log(error);
                socket.emit("api", {id: data.id, error: true, payload: {code: 3, message: "Blockchain API failure"}});
                return;
            }
        }

        if (blockchain && blockchain.getOperationTypes().length) {
            // Check injected operation types are allowed
            console.log("CHECKING INJECTED OPERATION")
            let app;
            try {
                app = await new Promise((resolve, reject) => {
                    this.webContents.send('getApiApp', apiobj);
                    ipcMain.once('getApiResponse', (event, response) => {
                        const { app, error } = response;
                        if (error) {
                            reject(error);
                        } else {
                            resolve(app);
                        }
                    });
                });
            } catch (error) {
                console.log(error);
                socket.emit("api", {id: data.id, error: true, payload: {code: 3, message: "Could not fetch app from store."}});
                return;
            }

            if (
                !app ||
                !apiobj ||
                !apiobj.payload ||
                (!apiobj.payload.origin == app.origin && !apiobj.payload.appName == app.appName)
            ) {
                console.log("Unauthorized use of injected operation");
                socket.emit("api", {id: data.id, error: true, payload: {code: 3, message: "Request format issue."}});
                return;
            }
            
            let authorizedUse = true;
            if (app.injectables.length) {
                if (["BTS", "BTS_TEST"].includes(blockchain._config.identifier)) {
                    let tr = blockchain._parseTransactionBuilder(msg.params);
                    for (let i = 0; i < tr.operations.length; i++) {
                        let operation = tr.operations[i];
                        if (!app.injectables.includes(operation[0])) {
                            authorizedUse = false;
                            break;
                        }
                    }
                } else if (["EOS", "BEOS", "TLOS"].includes(blockchain._config.identifier)) {
                    const params = msg.params;
                    if (!params || !params.length) {
                        socket.emit("api", {id: data.id, error: true, payload: {code: 3, message: "Request format issue."}});
                        return;
                    }                    
                    const request = JSON.parse(params[1]);

                    for (let i = 0; i < request.actions.length; i++) {
                        let action = request.actions[i];
                        if (!app.injectables.includes(action.name)) {
                            authorizedUse = false;
                            break;
                        }
                    }
                }

                if (!authorizedUse) {
                    console.log("Unauthorized use of injected operation (2)");
                    socket.emit("api", {id: data.id, error: true, payload: {code: 3, message: "Unauthorized blockchain operations detected."}});
                    return;
                }
            }
        }

        this.webContents.send('newRequest', {
            identityhash: apiobj.payload.identityhash,
            next_hash: apiobj.payload.next_hash
        });

        let status;
        try {
            if (apiobj.type === Actions.GET_ACCOUNT) {

                const _getAccount = (apiobj) => {
                return new Promise((resolve, reject) => {
                    this.webContents.send('getAccount', apiobj);
                    ipcMain.once('getAccountResponse', (event, arg) => {
                        resolve(arg);
                    });
                    ipcMain.once('getAccountError', (event, error) => {
                        reject(error);
                    });
                });
                }

                status = await _getAccount(apiobj);
            } else if (apiobj.type === Actions.REQUEST_SIGNATURE) {

                let visualizedParams;
                try {
                    visualizedParams = await blockchain.visualize(apiobj.payload.params);
                } catch (error) {
                    console.log(error);
                    socket.emit("api", {id: data.id, error: true, payload: {code: 7, message: "parameter visualization failure"}});
                    return;
                }
            
                let visualizedAccount;
                if (["BTS", "BTS_TEST"].includes(blockchain._config.identifier)) {
                    try {
                        visualizedAccount = await blockchain.visualize(apiobj.payload.account_id);
                    } catch (error) {
                        console.log(error);
                        socket.emit("api", {id: data.id, error: true, payload: {code: 7, message: "Visualization failure"}});
                        return;
                    }
                } else if (["EOS", "BEOS", "TLOS"].includes(blockchain._config.identifier)) {
                    visualizedAccount = apiobj.payload.authorization && apiobj.payload.authorization.length
                        ? apiobj.payload.authorization[0].actor
                        : "";
                }

                const _requestSignature = (_apiobj, _visualizedParams, _visualizedAccount) => {
                    return new Promise((resolve, reject) => {
                        this.webContents.send('requestSignature', _apiobj, _visualizedParams, _visualizedAccount);
                        ipcMain.once('requestSignatureResponse', (event, arg) => {
                            resolve(arg);
                        });
                        ipcMain.once('requestSignatureError', (event, error) => {
                            reject(error);
                        });
                    });
                }

                status = await _requestSignature(apiobj, visualizedParams, visualizedAccount);
            } else if (apiobj.type === Actions.INJECTED_CALL) {
                let regexBTS = /1.2.\d+/g
                let isBlocked = false;
                let blockedAccounts;
                let foundIDs = [];
            
                if (blockchain._config.identifier === "BTS") {
                    // Decentralized warn list
                    let stringifiedPayload = JSON.stringify(apiobj.payload.params);
                    let regexMatches = stringifiedPayload.matchAll(regexBTS);
                    for (const match of regexMatches) {
                        foundIDs.push(match[0]);
                    }
            
                    if (foundIDs.length) {
                        // Won't catch account names, only account IDs
                        try {
                            blockedAccounts = await blockchain.getBlockedAccounts();
                        } catch (error) {
                            console.log(error);
                        }
            
                        if (blockedAccounts) {
                            const isBadActor = (actor) => blockedAccounts.find(x => x === actor) ? true : false;
                            isBlocked = foundIDs.some(isBadActor);
                        }
                    }
                }
            
                let visualizedParams;
                try {
                    visualizedParams = await blockchain.visualize(apiobj.payload.params);
                } catch (error) {
                    console.log(error);
                    socket.emit("api", {id: data.id, error: true, payload: {code: 7, message: "Visualization failure"}});
                    return;
                }

                if (blockchain._config.identifier === "BTS") {
                    if (!isBlocked && visualizedParams) {
                        // account names will have 1.2.x in parenthesis now - check again
                        if (!blockedAccounts) {
                            try {
                                blockedAccounts = await blockchain.getBlockedAccounts();
                            } catch (error) {
                                console.log(error);
                            }
                        }
            
                        let strVirtParams = JSON.stringify(visualizedParams);
                        let regexMatches = strVirtParams.matchAll(regexBTS);
            
                        for (const match of regexMatches) {
                            foundIDs.push(match[0]);
                        }
            
                        if (blockedAccounts) {
                            const isBadActor = (actor) => blockedAccounts.find(x => x === actor) ? true : false;
                            isBlocked = foundIDs.some(isBadActor);
                        }
                    }
                }
            
                let types = blockchain.getOperationTypes();
            
                let account = "";
                let visualizedAccount;
                if (["BTS", "BTS_TEST"].includes(blockchain._config.identifier)) {
                    let fromField = types.find(type => type.method === apiobj.type).from;
                    if (!fromField || !fromField.length) {
                        const _account = () => {
                            return new Promise((resolve, reject) => {
                                this.webContents.send('getSafeAccount', true);
                                ipcMain.once('getSafeAccountResponse', (event, arg) => {
                                    return resolve(arg);
                                });
                            });
                        }
                        
                        try {
                            account = await _account();
                        } catch (error) {
                            console.log({error});
                        }
                    } else {
                        let visualizeContents = apiobj.payload[fromField];
                        try {
                            visualizedAccount = await blockchain.visualize(visualizeContents);
                        } catch (error) {
                            console.log({error});
                            socket.emit("api", {id: data.id, error: true, payload: {code: 7, message: "Visualization failure"}});
                            return;
                        }
                    }
                } else if (["EOS", "BEOS", "TLOS"].includes(blockchain._config.identifier)) {
                    const _actions = JSON.parse(apiobj.payload.params[1]).actions;
                    visualizedAccount = _actions[0].authorization[0].actor; 
                }

                const _injectedCall = (_apiobj, _chain, _account, _visualizedAccount, _visualizedParams, _isBlocked, _blockedAccounts, _foundIDs) => {
                    return new Promise((resolve, reject) => {
                        this.webContents.send(
                            'injectedCall',
                            {
                                request: _apiobj,
                                chain: _chain,
                                account: _account,
                                visualizedAccount: _visualizedAccount,
                                visualizedParams: _visualizedParams,
                                isBlocked: _isBlocked,
                                blockedAccounts: _blockedAccounts,
                                foundIDs: _foundIDs
                            }
                        );
                        ipcMain.once('injectedCallResponse', (event, arg) => {
                            return resolve(arg);
                        });
                        ipcMain.once('injectedCallError', (event, error) => {
                            return reject(error);
                        });
                    });
                }

                try {
                    status = await _injectedCall(
                        apiobj,
                        blockchain._config.identifier,
                        account,
                        visualizedAccount,
                        visualizedParams,
                        isBlocked,
                        blockedAccounts,
                        foundIDs
                    );
                } catch (error) {
                    console.log(error);
                    socket.emit("api", {id: data.id, error: true, payload: {code: 7, message: "API request injectedcall failure"}});
                    return;
                }
            } else if (apiobj.type === Actions.SIGN_MESSAGE) {
                const _signMessage = (apiobj) => {
                    return new Promise((resolve, reject) => {
                        this.webContents.send('signMessage', apiobj);
                        ipcMain.once('signMessageResponse', (event, arg) => {
                            resolve(arg);
                        });
                        ipcMain.once('signMessageError', (event, error) => {
                            reject(error);
                        });
                    });
                };

                status = await _signMessage(apiobj);
            } else if (apiobj.type === Actions.SIGN_NFT) {

                const _signNFT = (_apiobj) => {
                return new Promise((resolve, reject) => {
                    this.webContents.send('signNFT', _apiobj);
                    ipcMain.once('signNFTResponse', (event, arg) => {
                        return resolve(arg);
                    });
                    ipcMain.once('signNFTError', (event, error) => {
                        return reject(error);
                    });
                });
                }
                status = await _signNFT(apiobj);

            } else if (apiobj.type === Actions.VERIFY_MESSAGE) {

                const _getVerified = (apiobj) => {
                return new Promise((resolve, reject) => {
                    this.webContents.send('verifyMessage', apiobj);
                    ipcMain.once('verifyMessageResponse', async (event, arg) => {
                    let _verifiedMessage;
                    try {
                        _verifiedMessage = await blockchain.verifyMessage(apiobj);
                    } catch (error) {
                        console.log(error);
                        return;
                    }

                    if (_verifiedMessage) {
                        return resolve({result: _verifiedMessage});
                    }
                    });

                    ipcMain.once('verifyMessageError', (event, error) => {
                    return reject(error);
                    });
                });
                }

                status = await _getVerified(apiobj);
            }
        } catch (error) {
            console.log(error || "No status")
            socket.emit("api", {id: data.id, error: true, payload: {code: 4, message: "Negative user response"}})
            return;
        }

        if (!status.result || status.result.isError || status.result.canceled) {
            console.log("Issue occurred in approved prompt");
            socket.emit("api", {id: data.id, error: true, payload: {code: 7, message: "API request unsuccessful: prompt"}});
            return;
        }

        status.id = data.id;
        socket.otp.counter = status.id;

        let payload;
        try {
            payload = aes.encrypt(JSON.stringify(status.result), key).toString();
        } catch (error) {
            console.log(error);
            socket.emit("api", {id: data.id, error: true, payload: {code: 3, message: "Could not encrypt api response"}});
            return;
        }

        socket.emit(
            'api',
            {
                id: status.id,
                error: !!status.result.isError,
                encrypted: true,
                payload: payload
            }
        );
        return;
    }

    /**
     * Handle user link/relink attempts
     *
     * @parameter {string} linkType
     * @parameter {socket} socket
     * @parameter {request} data
     */
    static async respondLink(linkType, socket, data) {
        /*
        * Show the link/relink modal
        * @returns {bool}
        */
        const linkHandler = async (req) => {
            return new Promise((resolve, reject) => {
                this.webContents.send(
                    req.type == 'link' ? 'link' : 'relink',
                    Object.assign(req, {})
                );
    
                ipcMain.once('linkError', (event, error) => {
                    return rejectRequest(req, reject, error);
                });

                ipcMain.once('relinkError', (event, error) => {
                    return rejectRequest(req, reject, error);
                });

                ipcMain.once('linkResponse', async (event, response) => {
                    if (!response || !response.result) {
                        return rejectRequest(req, reject, 'User rejected request');
                    }
                
                    let identityhash;
                    if (req.type == 'link') {
                        let hashContents = `${req.browser} ${req.origin} ${req.appName} ${response.result.chain} ${response.result.id}`;
                        try {
                            identityhash = sha256(hashContents).toString();
                        } catch (error) {
                            return rejectRequest(req, reject, error);
                        }
                
                        let tempSecret;
                        try {
                            tempSecret = await ed.getSharedSecret(req.key, req.payload.pubkey);
                        } catch (error) {
                            return rejectRequest(req, reject, error);
                        }
                        let secret = ed.utils.bytesToHex(tempSecret)
                
                        this.webContents.send('addLinkApp', {
                            appName: req.appName,
                            identityhash: identityhash,
                            origin: req.origin,
                            account_id: response.result.id,
                            chain: response.result.chain,
                            injectables: req.injectables ?? [],
                            secret: secret,
                            next_hash: req.payload.next_hash
                        });
                    } else {
                        identityhash = response.result.identityhash
                        this.webContents.send('getLinkApp', {payload: {identityhash: identityhash}});
                    }
                
                    ipcMain.once('getLinkAppResponse', (event, response) => {
                        const { app, error } = response;
                        if (error) {
                            return rejectRequest(req, reject, error);
                        }
                        return resolve(Object.assign(req, {
                            isLinked: true,
                            identityhash: identityhash,
                            app: app,
                            existing: false
                        }));
                    })
                });
            });
        };

      if (linkType == "relink") {
        socket.isLinked = false;
      }

      let status;
      try {
        status = await linkHandler({
            id: data.id,
            client: socket.id,
            payload: data.payload,
            chain: data.payload.chain,
            origin: socket.origin,
            appName: socket.appName,
            browser: socket.browser,
            key: socket.keypair ?? null,
            type: linkType
        }, this.webContents);
      } catch (error) {
        console.log(error)
        socket.emit("api", {id: data.id, error: true, payload: {code: 7, message: "API request unsuccessful: linkHandler1"}});
        return;
      }

      if (!status || status.result && status.result.isError) {
        console.log("No linkhandler status");
        socket.emit("api", {id: data.id, error: true, payload: {code: 7, message: "API request unsuccessful: linkHandler2"}});
        return;
      }

      if (status.isLinked == true) {
          // link has successfully established
          await _establishLink(socket, status);
      }

      console.log("Link established");
      socket.emit("link", _getLinkResponse(status));
      return;
    }

    /**
     * Use a http|https server to create a new socketio server instance 
     * @param {Server} chosenServer 
     */
    static async newSocket(chosenServer) {
        return new Promise((resolve, reject) => {
            let io;
            try {
                io = new Server(
                    chosenServer,
                    {cors: {origin: "*", methods: ["GET", "POST"]}}
                );
            } catch (error) {
                console.log(error);
                return reject(error);
            }
    
            io.on("connection_error", (error) => {
                console.log(`io connection_error: ${error}`);
                io.close();
            });
    
            io.on("connection", async (socket) => {
              socket.isAuthenticated = false;
    
              socket.on("ping", (data) => {
                socket.emit("pong", chosenServer.cert ? 'HTTPS' : 'HTTP');
              });
    
              socket.on("connection_error", (error) => {
                console.log(`socket connection_error: ${error}`)
                socket.disconnect();
              });
    
              /*
               * Wallet handshake with client.
               */
              socket.on("authenticate", async (data) => {

                /**
                 * Apply appropriate auth fields to the user request payload
                 *
                 * @param {Object} req
                 * @returns {Object}
                 */
                const authHandler = function (req, webContents) {
                    return new Promise((resolve, reject) => {
                        if (!req.payload.identityhash) {
                            // Comms authed but app not linked
                            return resolve(Object.assign(req.payload, {authenticate: true, link: false}));
                        }
    
                        webContents.send('getAuthApp', {payload: {identityhash: req.payload.identityhash}});
    
                        ipcMain.once('getAuthResponse', (event, response) => {
                            const { app, error } = response;
                            if (error) {
                                return rejectRequest(req, reject, error);
                            }
    
                            if (
                                !app ||
                                (
                                    !req.payload.origin === app.origin &&
                                    !req.payload.appName === app.appName
                                )
                            ) {
                                // Reject authentication!
                                return resolve(Object.assign(req.payload, {authenticate: false, link: false}));
                            }
    
                            return resolve(Object.assign(req.payload, {
                                authenticate: true,
                                link: true,
                                app: app
                            }));
                        });
                    });
                };

                let status;
                try {
                  status = await authHandler({
                    id: data.id,
                    client: socket.id,
                    payload: data.payload
                  }, this.webContents);
                } catch (error) {
                  console.log(error)
                }
    
                status.id = data.id; // necessary or not?
    
                if (!status.authenticate) {
                  socket.emit(
                    "api",
                    {
                        id: status.id,
                        error: true,
                        payload: {
                            code: 7,
                            message: "Could not authenticate"
                        }
                    }
                  );
                  socket.isAuthenticated = false;
                  return;
                }
    
                socket.isAuthenticated = true;
                socket.origin = status.origin;
                socket.appName = status.appName;
                socket.browser = status.browser;
    
                if (status.link == true) { 
                  await _establishLink(socket, status);
                  let linkResponse = _getLinkResponse(status);
                  console.log("Existing link");
                  socket.emit('authenticated', linkResponse);
                  return;
                }
    
                const privk = ed.utils.randomPrivateKey();
                socket.keypair = privk;
    
                let pubk;
                try {
                  pubk = await ed.getPublicKey(privk);
                } catch (error) {
                  console.error(error);
                  return;
                }
    
                socket.emit(
                    'authenticated',
                    {
                        id: status.id,
                        error: false,
                        payload: {
                            authenticate: true,
                            link: false,
                            pub_key: ed.utils.bytesToHex(pubk),
                        }
                    }
                )
              });
    
              /*
               * An authenticated client requests to link with Beet wallet.
               */
              socket.on("linkRequest", async (data) => {
                console.log("LINK IN PROGRESS")
                if (!socket.isAuthenticated) {
                  socket.emit("api", {id: data.id, error: true, payload: {code: 5, message: "Beet wallet authentication error."}});
                  return;
                }
                try {
                  await this.respondLink("link", socket, data);
                } catch (error) {
                  console.log(error);
                  if (socket) {
                    socket.emit("api", {id: data.id, error: true, payload: {code: 7, message: "Link request unsuccessful."}});
                  }
                }
              });
    
              /*
               * An authenticated client requests to relink with Beet wallet.
               */
              socket.on("relinkRequest", async (data) => {
                console.log("RELINK IN PROGRESS")
                if (!socket.isAuthenticated) {
                  socket.emit("api", {id: data.id, error: true, payload: {code: 5, message: "Beet wallet authentication error."}});
                  return;
                }
                try {
                  await this.respondLink("relink", socket, data);
                } catch (error) {
                  console.log(error);
                  if (socket) {
                    socket.emit("api", {id: data.id, error: true, payload: {code: 7, message: "Relink request unsuccessful."}});
                  }
                }
              });
    
              /*
               * An authenticated & linked client requests an api call.
               */
              socket.on("api", async (data) => {
                console.log("API IN PROGRESS")
                if (!socket.isAuthenticated) {
                  console.log("Not authenticated");
                  socket.emit("api", {id: data.id, error: true, payload: {code: 5, message: "Beet wallet authentication error."}});
                  return;
                }
    
                if (!socket.isLinked) {
                  console.log("Not linked");
                  socket.emit("api", {id: data.id, error: true, payload: {code: 4, message: "This app is not yet linked. Link then try again."}})
                  return;
                }
    
                try {
                  await this.respondAPI(socket, data);
                } catch (error) {
                  console.log(error);
                  if (socket) {
                    socket.emit("api", {id: data.id, error: true, payload: {code: 7, message: "API request unsuccessful."}});
                  }
                }
              });
    
            });

            return resolve(io);
        });
    }

    /**
     * @parameter {number} httpPort
     * @parameter {number} httpsPort
     * @parameter {string} key
     * @parameter {string} cert
     * @parameter {WebContents} webContents
     * @returns {BeetServer}
     */
    static async initialize(
        httpsPort = 60554,
        httpPort = 60555,
        key,
        cert,
        webContents
    ) {
        this.webContents = webContents;

        let httpServer;
        try {
            httpServer = await http.createServer();
        } catch (error) {
            console.log(error);
        }

        if (httpServer) {
            let httpTerminator = createHttpTerminator({
                server: httpServer,
            });
    
            httpServer.listen(httpPort, () => {
                console.log(`HTTP server listening on port: ${httpPort}`);
            });
    
            this.httpSocket = await this.newSocket(httpServer);
            this.httpTerminator = httpTerminator;

        }

        if (key && cert) {
            let httpsServer;

            try {
                httpsServer = https.createServer({
                                key: key,
                                cert: cert,
                                rejectUnauthorized: false
                              })
            } catch (error) {
                console.log(error);
            }

            if (httpsServer) {
                let httpsTerminator = createHttpTerminator({
                    server: httpsServer,
                });
    
                httpsServer.listen(httpsPort, ()=> {
                    console.log(`HTTPS server listening on port: ${httpsPort}`);
                });
    
                this.httpsSocket = await this.newSocket(httpsServer);
                this.httpsTerminator = httpsTerminator;
            }
        }
    }
    
    static async close() {
        return new Promise(async (resolve, reject) => {
            if (this.httpTerminator) {
                try {
                    await this.httpTerminator.terminate();
                } catch (error) {
                    console.log(error);
                }
            }

            if (this.httpSocket) {
                this.httpSocket.close(() => {
                    console.log('Socket.IO HTTP server has been shut down');
                });
            }
    
            if (this.httpsTerminator) {
                try {
                    await this.httpsTerminator.terminate();
                } catch (error) {
                    console.log(error);
                }
            }

            if (this.httpsSocket) {
                this.httpsSocket.close(() => {
                    console.log('Socket.IO HTTPS server has been shut down');
                });
            }

            return resolve("BeetServer has been shut down");
        });
    }
}
