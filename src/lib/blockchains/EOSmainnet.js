import BlockchainAPI from "./BlockchainAPI.js";

import { Api, JsonRpc, RpcError } from 'eosjs';
import { JsSignatureProvider } from "eosjs/dist/eosjs-jssig";

import * as ecc from "eosjs-ecc";
import { TextEncoder, TextDecoder } from "util";

import beautify from "./EOS/beautify.js";
import * as Actions from '../Actions.js';

const operations = [
    Actions.GET_ACCOUNT,
    Actions.REQUEST_SIGNATURE,
    Actions.INJECTED_CALL,
    Actions.VOTE_FOR,
    Actions.SIGN_MESSAGE,
    Actions.VERIFY_MESSAGE,
    Actions.TRANSFER,
    "setalimits",
    "setacctram",
    "setacctnet",
    "setacctcpu",
    "activate",
    "delegatebw",
    "setrex",
    "deposit",
    "withdraw",
    "buyrex",
    "unstaketorex",
    "sellrex",
    "cnclrexorder",
    "rentcpu",
    "rentnet",
    "fundcpuloan",
    "fundnetloan",
    "defcpuloan",
    "defnetloan",
    "updaterex",
    "rexexec",
    "consolidate",
    "mvtosavings",
    "mvfrsavings",
    "closerex",
    "undelegatebw",
    "buyram",
    "buyrambytes",
    "sellram",
    "refund",
    "regproducer",
    "unregprod",
    "setram",
    "setramrate",
    "voteproducer",
    "regproxy",
    "setparams",
    "claimrewards",
    "setpriv",
    "rmvproducer",
    "updtrevision",
    "bidname",
    "bidrefund"
];

export default class EOS extends BlockchainAPI {

    /*
     * Establish a connection
     * @param {String} nodeToConnect
     * @param {Promise} resolve
     * @param {Promise} reject
     * @returns {String}
     */
    async _establishConnection(nodeToConnect, resolve, reject) {   
        let chosenNode = nodeToConnect ? nodeToConnect : this.getNodes()[0].url;

        this.rpc = new JsonRpc(chosenNode, {fetch});
        try {
            await this.rpc.get_info();
            this._connectionEstablished(resolve, chosenNode);
        } catch (error) {
            this._connectionFailed(reject, chosenNode, error.message);
        }
    }

    /**
     * Returning the list of injectable operations
     * @returns {Array}
     */
    getOperationTypes() {
        // No virtual operations included
        return operations.map((op) => {
            return {
                id: op,
                method: op
            }
        });
    }

    /*
     * Connect to the Bitshares blockchain. (placeholder replacement)
     * @param {String||null} nodeToConnect
     * @returns {String}
     */
    _connect(nodeToConnect = null) {
        return new Promise((resolve, reject) => {

            if (nodeToConnect) {
                //console.log(`nodetoconnect: ${nodeToConnect}`)
                return this._establishConnection(nodeToConnect, resolve, reject);
            }

            if (this._isConnected && this._isConnectedToNode && !nodeToConnect) {
                //console.log(`isConnected: ${this._isConnectedToNode}`)
                return this._connectionEstablished(resolve, this._isConnectedToNode);
            }

            let diff;
            if (this._nodeCheckTime) {
                let now = new Date();
                let nowTS = now.getTime();
                diff = Math.abs(Math.round((nowTS - this._nodeCheckTime) / 1000));
            }

            if (!nodeToConnect && (!this._nodeLatencies || diff && diff > 360)) {
                // initializing the blockchain
                return this._testNodes().then((res) => {
                    this._node = res.node;
                    this._nodeLatencies = res.latencies;
                    this._nodeCheckTime = res.timestamp;
                    console.log(`Establishing connection to ${res.node}`);
                    return this._establishConnection(res.node, resolve, reject);
                })
                .catch(error => {
                    console.log(error);
                    return this._connectionFailed(reject, '', 'Node test fail');
                })
            } else if (!nodeToConnect && this._nodeLatencies) {
                // blockchain has previously been initialized
                let filteredNodes = this._nodeLatencies
                                    .filter(item => {
                                    if (!this._tempBanned.includes(item.url)) {
                                        return true;
                                    }
                                    });

                this._nodeLatencies = filteredNodes;
                if (!filteredNodes || !filteredNodes.length) {
                return this._connectionFailed(reject, '', 'No working nodes');
                }

                this._node = filteredNodes[0].url;
                return this._establishConnection(filteredNodes[0].url, resolve, reject);
            }

        });
    }

    /**
     * Test a wss url for successful connection.
     * @param {String} url
     * @returns {Object}
     */
    _testConnection(url) {
        let timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                resolve(null);
            }, 2000);
        });

        let connectionPromise = new Promise(async (resolve, reject) => {
            //console.log(`Testing: ${url}`);
            let before = new Date();
            let beforeTS = before.getTime();

            let socket = new Socket(url);
            socket.on('connect', () => {
                let now = new Date();
                let nowTS = now.getTime();
                socket.destroy();
                //console.log(`Success: ${url} (${nowTS - beforeTS}ms)`);
                return resolve({ url: url, lag: nowTS - beforeTS });
            });

            socket.on('error', (error) => {
                //console.log(`Failure: ${url}`);
                socket.destroy();
                return resolve(null);
            });
        });

        const fastestPromise = Promise.race([connectionPromise, timeoutPromise]).catch(
            (error) => {
                return null;
            }
        );

        return fastestPromise;
    }

  /**
   * Test the wss nodes, return latencies and fastest url.
   * @returns {Promise}
   */
    async _testNodes() {
      return new Promise(async (resolve, reject) => {
          let urls = this.getNodes().map(node => node.url);

          let filteredURLS = urls.filter(url => {
            if (!this._tempBanned || !this._tempBanned.includes(url)) {
              return true;
            }
          });

          return Promise.all(filteredURLS.map(url => this._testConnection(url)))
          .then((validNodes) => {
            let filteredNodes = validNodes.filter(x => x);
            if (filteredNodes.length) {
              let sortedNodes = filteredNodes.sort((a, b) => a.lag - b.lag);
              let now = new Date();
              return resolve({
                node: sortedNodes[0].url,
                latencies: sortedNodes,
                timestamp: now.getTime()
              });
            } else {
              console.error("No valid BTS WSS connections established; Please check your internet connection.")
              return reject();
            }
          })
          .catch(error => {
            console.log(error);
          })


      });

    }

    
    /*
     * Check if the connection needs reestablished (placeholder replacement)
     * @returns {Boolean}
     */
    async _needsNewConnection() {
        return new Promise(async (resolve, reject) => {
            if (
                !this._isConnected ||
                !this._isConnectedToNode ||
                !this._nodeLatencies
            ) {
                return resolve(true);
            }
    
            let testConnection = await this._testConnection(this._isConnectedToNode);
            let connectionResult = testConnection && testConnection.url ? false : true;
            return resolve(connectionResult);
        });
    }

    /**
     * Verify the private key for an EOS blockchain L1 account
     * @param {string} accountName 
     * @param {string} privateKey 
     * @param {string} chain // EOS, TLOS, BEOS
     */
    async verifyAccount(accountName, privateKey, chain = "EOS") {

        let fetchedAccount;
        try {
            fetchedAccount = await this.getAccount(accountName);
            // Keys must resolve to one of these types of permissions
          } catch (err) {
            console.log(err);
            return;
          }

          if (!fetchedAccount) {
            console.log("Account not found");
            return;
          }

          let publicKey;
          try {
            // Derive the public key from the private key provided
            publicKey = ecc.privateToPublic(privateKey, chain);
          } catch (err) {
            // key is likely invalid, an exception was thrown
            console.log(err)
            return;
          }

          if (!publicKey) {
            console.log("Public key not found");
            return;
          }

          const validPermissions = fetchedAccount.permissions.filter((perm) => {
            // Get the threshold a key needs to perform operations
            const { threshold } = perm.required_auth;
            // finally determine if any keys match
            const matches = perm.required_auth.keys.filter((auth) =>
              (auth.key === publicKey) && (auth.weight >= threshold));
            // this is a valid permission should any of the keys and thresholds match
            return (matches.length > 0);
          });

          if (validPermissions.length > 0) {
            console.log("Key is valid");
            return {
              fetchedAccount,
              publicKey,
            }
          }
    }

    getAccount(accountname) {
        return new Promise((resolve, reject) => {
            this._establishConnection().then(result => {
                this.rpc.get_account(accountname).then(account => {
                    account.active = {}
                    account.owner = {}
                    account.active.public_keys = account.permissions.find(
                        res => { return res.perm_name == "active" }).required_auth.keys.map(item => [item.key, item.weight]);
                    account.owner.public_keys = account.permissions.find(
                        res => { return res.perm_name == "owner" }).required_auth.keys.map(item => [item.key, item.weight]);
                    account.memo = {public_key: account.active.public_keys[0][0]};
                    account.id = account.account_name;
                    resolve(account);
                }).catch(reject);
            }).catch(reject);
        });
    }

    getPublicKey(privateKey) { // convertLegacyPublicKey
        return ecc.PrivateKey.fromString(privateKey).toPublic().toString();
    }

    getBalances(accountName) {
        return new Promise((resolve, reject) => {
            this.getAccount(accountName).then((account) => {
                let balances = [];
                balances.push({
                    asset_type: "Core",
                    asset_name: this._getCoreSymbol(),
                    balance: parseFloat(account.core_liquid_balance),
                    owner: "-",
                    prefix: ""
                });
                balances.push({
                    asset_type: "UIA",
                    asset_name: "CPU Stake",
                    balance: parseFloat(account.cpu_weight),
                    owner: "-",
                    prefix: ""
                });
                balances.push({
                    asset_type: "UIA",
                    asset_name: "Bandwith Stake",
                    balance: parseFloat(account.net_weight),
                    owner: "-",
                    prefix: ""
                });
                balances.push({
                    asset_type: "UIA",
                    asset_name: `RAM Stake (-${account.ram_usage} bytes)`,
                    balance : parseFloat(account.ram_quota),
                    owner: "-",
                    prefix: ""
                })
                resolve(balances);
            });
        });
    }

    /**
     * Placeholder for blockchain TOTP implementation
     * @returns Boolean
     */
    supportsTOTP() {
        return true;
    }

    /**
     * Placeholder for blockchain QR implementation
     * @returns Boolean
     */
    supportsQR() {
        return true;
    }
    
    /**
     * Placeholder for local file processing
     * @returns Boolean
     */
    supportsLocal() {
        return true;
    }

    sign(transaction, key) {
        return new Promise((resolve, reject) => {
            transaction.signatureProvider = new JsSignatureProvider([key]);
            resolve(transaction);
        });
    }

    broadcast(transaction) {
        return new Promise((resolve, reject) => {
            const api = new Api({
                rpc: this.rpc,
                signatureProvider: transaction.signatureProvider,
                textDecoder: new TextDecoder(),
                textEncoder: new TextEncoder()
            });

            api.transact(
                {
                    actions: transaction.actions
                },
                {
                    blocksBehind: 3,
                    expireSeconds: 30
                }
            ).then((result) => {
                resolve(result);
            }).catch((error) => {
                console.log({error});
                reject();
            });
        });
    }

    getOperation(data, account) {
        // https://eosio.stackexchange.com/questions/212/where-is-the-api-for-block-producer-voting-in-eosjs
        return new Promise((resolve, reject) => {
            reject("Not supported");
        });
    }

    mapOperationData(incoming) {
        return new Promise((resolve, reject) => {
            reject("Not supported");
        });
    }

    _signString(key, string) {
        return ecc.Signature.sign(Buffer.from(string), key).toHex();
    }

    _verifyString(signature, publicKey, string) {
        return ecc.Signature.fromHex(signature).verify(
            string,
            ecc.PublicKey.fromString(publicKey)
        );
    }

    async transfer(key, from, to, amount, memo = null) {
        if (!amount.amount || !amount.asset_id) {
            throw "Amount must be a dict with amount and asset_id as keys"
        }
        from = await this.getAccount(from);
        to = await this.getAccount(to);

        if (memo == null) {
            memo = "";
        }

        let actions = [{
            account: 'eosio.token',
            name: 'transfer',
            authorization: [{
                actor: from.id,
                permission: 'active',
            }],
            data: {
                from: from.id,
                to: to.id,
                quantity: (amount.amount/10000).toFixed(4) + " " + amount.asset_id,
                memo: memo,
            },
        }];

        let transaction = {
            actions
        };
        let signedTransaction = await this.sign(transaction, key);
        let result = await this.broadcast(signedTransaction);
        return result;
    }

    getExplorer(object) {
        if (object.accountName) {
            return "https://bloks.io/account/" + object.accountName;
        } else if (object.txid) {
            // 4e0d513db2b03e7a5cdee0c4b5b8096af33fba08fcf2b7c4b05ab8980ae4ffc6
            return "https://bloks.io/transaction/" + object.txid;
        } else {
            return false;
        }
    }

    /*
     * Returns an array of default import options. (placeholder replacement)
     * @returns {Array}
     */
    getImportOptions() {
        return [
            {
                type: "ImportKeys",
                translate_key: "import_keys"
            }
        ];
    }

    /**
     * Processing and localizing operations in the transaction
     * @param {Object[]} trx 
     * @returns 
     */
    async visualize(trx) {
        const _trx = JSON.parse(trx[1]);
        let beautifiedOpPromises = [];
        for (let i = 0; i < _trx.actions.length; i++) {
            let operation = _trx.actions[i];
            beautifiedOpPromises.push(
                beautify(operation)
            );
        }

        return Promise.all(beautifiedOpPromises)
            .then((operations) => {
                if (
                    operations.some(
                        (op) =>
                            !Object.prototype.hasOwnProperty.call(op, "rows")
                    )
                ) {
                    throw new Error(
                        "There's an issue with the format of an operation!"
                    );
                }
                return operations;
            })
            .catch((error) => {
                console.log(error);
            });
    }

}
