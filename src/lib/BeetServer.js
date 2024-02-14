import { ipcMain, webContents } from "electron";
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

import {
  linkRequest,
  relinkRequest,
  getAccount,
  requestSignature,
  injectedCall,
  voteFor,
  signMessage,
  signNFT,
  messageVerification,
  transfer
} from './apiUtils.js';
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

const rejectRequest = (req, error) => {
  console.log(error)
  return {
      id: req.id,
      result: {
          isError: true,
          error: error
      }
  };
}

/*
 * Show the link/relink modal
 * @returns {bool}
 */
const linkHandler = async (req, webContents) => {
    let userResponse;
    try {
      if (req.type == 'link') {
        userResponse = await linkRequest(Object.assign(req, {}));
      } else {
        userResponse = await relinkRequest(Object.assign(req, {}));
      }
    } catch (error) {
      return rejectRequest(req, 'User rejected request');
    }

    if (!userResponse || !userResponse.result) {
      return rejectRequest(req, 'User rejected request');
    }

    let identityhash;
    if (req.type == 'link') {
        let hashContents = `${req.browser} ${req.origin} ${req.appName} ${userResponse.result.chain} ${userResponse.result.id}`;
        try {
          identityhash = sha256(hashContents).toString();
        } catch (error) {
          return rejectRequest(req, error);
        }

        let tempSecret;
        try {
            tempSecret = await ed.getSharedSecret(req.key, req.payload.pubkey);
        } catch (error) {
            return rejectRequest(req, error);
        }
        let secret = ed.utils.bytesToHex(tempSecret)

        webContents.send('addLinkApp', {
            appName: req.appName,
            identityhash: identityhash,
            origin: req.origin,
            account_id: userResponse.result.id,
            chain: userResponse.result.chain,
            injectables: req.injectables ?? [],
            secret: secret,
            next_hash: req.payload.next_hash
        });
    } else {
        identityhash = userResponse.result.identityhash
        webContents.send('getLinkApp', {payload: {identityhash: identityhash}});
    }

    ipcMain.once('getLinkResponse', (event, response) => {
        const { app, error } = response;
        if (error) {
            return rejectRequest(req, error);
        }
        return Object.assign(req, {
            isLinked: true,
            identityhash: identityhash,
            app: app,
            existing: false
        });
    })

};

/**
 * Apply appropriate auth fields to the user request payload
 *
 * @param {Object} req
 * @returns {Object}
 */
const authHandler = function (req) {
    if (!req.payload.identityhash) {
      // Comms authed but app not linked
      return Object.assign(req.payload, {authenticate: true, link: false});
    }

    webContents.send('getAuthApp', {payload: {identityhash: req.payload.identityhash}});

    ipcMain.once('getAuthResponse', (event, response) => {
        const { app, error } = response;
        if (error) {
            return rejectRequest(req, error);
        }

        if (
            !app ||
            !app.length ||
            (!req.payload.origin === app.origin && !req.payload.appName === app.appName)
        ) {
          // Reject authentication!
          return Object.assign(req.payload, {authenticate: false, link: false});
        }

        return Object.assign(req.payload, {
            authenticate: true,
            link: true,
            app: app
        });
    });
};

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

      if (!hash == socket.next_hash) {
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
        Actions.TRANSFER,
        Actions.VOTE_FOR,
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
        let app = store.getters['OriginStore/getBeetApp'](apiobj);
        if (!app || (!apiobj.payload.origin == app.origin && !apiobj.payload.appName == app.appName)) {
            socket.emit("api", {id: data.id, error: true, payload: {code: 3, message: "Request format issue."}});
            return;
        }
        
        let authorizedUse = true;
        if (app.injectables.length) {
            // request.payload.params
            let tr = blockchain._parseTransactionBuilder(msg.params);
            for (let i = 0; i < tr.operations.length; i++) {
                let operation = tr.operations[i];
                if (!app.injectables.includes(operation[0])) {
                    authorizedUse = false;
                    break;
                }
            }

            // TODO: Support EOS based chains here

            if (!authorizedUse) {
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
          status = await getAccount(apiobj);
        } else if (apiobj.type === Actions.REQUEST_SIGNATURE) {
          status = await requestSignature(apiobj, blockchain);
        } else if (apiobj.type === Actions.INJECTED_CALL) {
          status = await injectedCall(apiobj, blockchain);
        } else if (apiobj.type === Actions.VOTE_FOR) {
          status = await voteFor(apiobj, blockchain);
        } else if (apiobj.type === Actions.SIGN_MESSAGE) {
          status = await signMessage(apiobj, blockchain);
        } else if (apiobj.type === Actions.SIGN_NFT) {
          status = await signNFT(apiobj, blockchain);
        } else if (apiobj.type === Actions.VERIFY_MESSAGE) {
          status = await messageVerification(apiobj, blockchain);
        } else if (apiobj.type === Actions.TRANSFER) {
          status = await transfer(apiobj, blockchain);
        }
      } catch (error) {
        console.log(error || "No status")
        socket.emit("api", {id: data.id, error: true, payload: {code: 4, message: "Negative user response"}})
        return;
      }

      if (!status.result || status.result.isError || status.result.canceled) {
        console.log("Issue occurred in approved prompt");
        socket.emit("api", {id: data.id, error: true, payload: {code: 7, message: "API request unsuccessful"}});
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
        });
      } catch (error) {
        console.log(error)
        socket.emit("api", {id: data.id, error: true, payload: {code: 7, message: "API request unsuccessful"}});
        return;
      }

      if (!status || status.result && status.result.isError) {
        console.log("No linkhandler status");
        socket.emit("api", {id: data.id, error: true, payload: {code: 7, message: "API request unsuccessful"}});
        return;
      }

      if (status.isLinked == true) {
          // link has successfully established
          await _establishLink(socket, status);
      }

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
                let status;
                try {
                  status = await authHandler({
                    id: data.id,
                    client: socket.id,
                    payload: data.payload
                  });
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
                if (!socket.isAuthenticated) {
                  socket.emit("api", {id: data.id, error: true, payload: {code: 5, message: "Beet wallet authentication error."}});
                  return;
                }
    
                if (!socket.isLinked) {
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
