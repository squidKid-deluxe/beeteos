import BlockchainAPI from "./BlockchainAPI.js";

import { APIClient, FetchProvider, PrivateKey } from '@wharfkit/antelope'
import { Transaction, Action, SignedTransaction } from '@wharfkit/antelope'
import { Signature, PublicKey, Bytes } from '@wharfkit/antelope'

import { TextEncoder, TextDecoder } from "util";

import beautify from "./EOS/beautify.js";
import * as Actions from "../Actions.js";

const operations = [
    Actions.GET_ACCOUNT,
    Actions.REQUEST_SIGNATURE,
    Actions.INJECTED_CALL,
    Actions.SIGN_MESSAGE,
    Actions.VERIFY_MESSAGE,
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
    "transfer",
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
    "bidrefund",
    "ramtransfer",
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
        if (
            (!nodeToConnect || !nodeToConnect.length) &&
            !this.getNodes()[0].url
        ) {
            this._connectionFailed(reject, "", "No node url");
        }

        const chosenURL =
            nodeToConnect && nodeToConnect.length
                ? nodeToConnect
                : this.getNodes()[0].url;

        let client;
        try {
            client = new APIClient({
                provider: new FetchProvider(chosenURL, { fetch })
            });
        } catch (error) {
            console.log({ error });
            this._connectionFailed(reject, chosenURL, error.message);
        }

        this.client = client;
        this._connectionEstablished(resolve, chosenURL);

        /*
        try {
            this.client.v1.chain.get_block(1).then(() => {
                this._connectionEstablished(resolve, chosenURL);
            })
        } catch (error) {
            console.log({error})
            this._connectionFailed(reject, chosenURL, error.message);
        }
        */
    }

    /**
     * Returning the list of injectable operations
     * @returns {Array}
     */
    getOperationTypes() {
        // No virtual operations included
        const _ops = operations.map((op) => {
            return {
                id: op,
                method: op,
            };
        });
        return _ops;
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
                return this._establishConnection(
                    nodeToConnect,
                    resolve,
                    reject
                );
            }

            if (
                this._isConnected &&
                this._isConnectedToNode &&
                !nodeToConnect
            ) {
                //console.log(`isConnected: ${this._isConnectedToNode}`)
                return this._connectionEstablished(
                    resolve,
                    this._isConnectedToNode
                );
            }

            const userConfiguredNodes = store.getters['SettingsStore/getNodes'](this._config.coreSymbol);

            if (!userConfiguredNodes || !userConfiguredNodes.length) {
                return this._connectionFailed(
                    reject,
                    "",
                    "No working nodes"
                );
            }

            this._node = userConfiguredNodes[0].url;
            return this._establishConnection(
                this._node,
                resolve,
                reject
            );
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
            socket.on("connect", () => {
                let now = new Date();
                let nowTS = now.getTime();
                socket.destroy();
                //console.log(`Success: ${url} (${nowTS - beforeTS}ms)`);
                return resolve({ url: url, lag: nowTS - beforeTS });
            });

            socket.on("error", (error) => {
                //console.log(`Failure: ${url}`);
                socket.destroy();
                return resolve(null);
            });
        });

        const fastestPromise = Promise.race([
            connectionPromise,
            timeoutPromise,
        ]).catch((error) => {
            return null;
        });

        return fastestPromise;
    }

    /**
     * Test the wss nodes, return latencies and fastest url.
     * @returns {Promise}
     */
    async _testNodes() {
        return new Promise(async (resolve, reject) => {
            let urls = this.getNodes().map((node) => node.url);

            let filteredURLS = urls.filter((url) => {
                if (!this._tempBanned || !this._tempBanned.includes(url)) {
                    return true;
                }
            });

            return Promise.all(
                filteredURLS.map((url) => this._testConnection(url))
            )
                .then((validNodes) => {
                    let filteredNodes = validNodes.filter((x) => x);
                    if (filteredNodes.length) {
                        let sortedNodes = filteredNodes.sort(
                            (a, b) => a.lag - b.lag
                        );
                        let now = new Date();
                        return resolve({
                            node: sortedNodes[0].url,
                            latencies: sortedNodes,
                            timestamp: now.getTime(),
                        });
                    } else {
                        console.error(
                            "No valid BTS WSS connections established; Please check your internet connection."
                        );
                        return reject();
                    }
                })
                .catch((error) => {
                    console.log(error);
                });
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

            let testConnection = await this._testConnection(
                this._isConnectedToNode
            );
            let connectionResult =
                testConnection && testConnection.url ? false : true;
            return resolve(connectionResult);
        });
    }

    /**
     * Verify the private key for an EOS blockchain L1 account
     * @param {string} accountName
     * @param {string} privateKey
     * @param {string} chain // EOS, TLOS, BEOS (note: chain parameter is not needed by wharfkit, left here for compatibility)
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
            const privKey = PrivateKey.from(privateKey);
            publicKey = privKey.toPublic().toString();
        } catch (err) {
            // key is likely invalid, an exception was thrown
            console.log(err);
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
            const matches = perm.required_auth.keys.filter(
                (auth) => auth.key === publicKey && auth.weight >= threshold
            );
            // this is a valid permission should any of the keys and thresholds match
            return matches.length > 0;
        });

        if (validPermissions.length > 0) {
            console.log("Key is valid");
            return {
                fetchedAccount,
                publicKey,
            };
        }
    }

    getAccount(accountname) {
        return new Promise((resolve, reject) => {
            this._establishConnection()
                .then((result) => {
                    this.client.v1.chain
                        .get_account(accountname)
                        .then((account) => {
                            account.active = {};
                            account.owner = {};
                            account.active.public_keys = account.permissions
                                .find((res) => {
                                    return res.perm_name.equals("active");
                                })
                                .required_auth.keys.map((item) => [
                                    item.key.toString(),
                                    item.weight.toNumber(),
                                ]);
                            account.owner.public_keys = account.permissions
                                .find((res) => {
                                    return res.perm_name.equals("owner");
                                })
                                .required_auth.keys.map((item) => [
                                    item.key.toString(),
                                    item.weight.toNumber(),
                                ]);
                            account.memo = {
                                public_key: account.active.public_keys[0][0],
                            };
                            account.id = account.account_name.toString();
                            resolve(account);
                        })
                        .catch((error) => {
                            console.error(error);
                            reject(error);
                        });
                })
                .catch((error) => {
                    console.error(error);
                    reject(error);
                });
        });
    }

    getPublicKey(privateKey) {
        // convertLegacyPublicKey
        return PrivateKey.from(privateKey).toPublic().toString();
    }

    getTableRows(
        contract = "eosio.token",
        accountname,
        table = "accounts",
        limit = 100
    ) {
        return new Promise((resolve, reject) => {
            this.client.v1.chain
                .get_table_rows({
                    json: true,
                    code: contract,
                    scope: accountname,
                    table: table,
                    limit: limit,
                })
                .then((result) => {
                    if (result && result.rows) {
                        resolve(result.rows);
                    }
                    reject();
                })
                .catch(reject);
        });
    }

    getBalances(accountName) {
        return new Promise((resolve, reject) => {
            let balances = [];
            this.getAccount(accountName)
                .then((account) => {
                    balances.push({
                        asset_type: "Core",
                        asset_name: this._getCoreSymbol(),
                        balance: parseFloat(account.core_liquid_balance.toString()),
                        owner: "-",
                        prefix: "",
                    });
                    balances.push({
                        asset_type: "UIA",
                        asset_name: "CPU Stake",
                        balance: parseFloat(account.cpu_weight.toString()),
                        owner: "-",
                        prefix: "",
                    });
                    balances.push({
                        asset_type: "UIA",
                        asset_name: "Bandwith Stake",
                        balance: parseFloat(account.net_weight.toString()),
                        owner: "-",
                        prefix: "",
                    });
                    balances.push({
                        asset_type: "UIA",
                        asset_name: `RAM Stake (-${account.ram_usage.toString()} bytes)`,
                        balance: parseFloat(account.ram_quota.toString()),
                        owner: "-",
                        prefix: "",
                    });
                })
                .then(() => {
                    // Call getTableRows after getting the account information
                    this.getTableRows(
                        "eosio.token",
                        accountName,
                        "accounts",
                        100
                    ).then((tableRows) => {
                        // Merge the results
                        tableRows.forEach((row) => {
                            if (
                                !balances.some(
                                    (balance) =>
                                        balance.asset_name ===
                                        row.balance.split(" ")[1]
                                )
                            ) {
                                balances.push({
                                    asset_type: "UIA",
                                    asset_name: row.balance.split(" ")[1], // replace 'key' with the actual property name
                                    balance: parseFloat(
                                        row.balance.split(" ")[0]
                                    ), // replace 'value' with the actual property name
                                    owner: "-",
                                    prefix: "",
                                });
                            }
                        });
                    });
                })
                .then(() => {
                    return resolve(balances);
                })
                .catch((error) => {
                    console.log({ error });
                    reject();
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
     * Placeholder for blockchain Web implementation
     * @returns Boolean
     */
    supportsWeb() {
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
            // Store the private key for later use in broadcast
            transaction.privateKey = PrivateKey.from(key);
            resolve(transaction);
        });
    }

    async broadcast(transaction) {
        if (!this.client) {
            this.client = new APIClient({
                provider: new FetchProvider(this.getNodes()[0].url, { fetch })
            });
        }

        const info = await this.client.v1.chain.get_info();
        const header = info.getTransactionHeader(30);

        // Fetch ABIs for all contracts used in actions
        const contractNames = [...new Set(transaction.actions.map(action => action.account))];
        const abiPromises = contractNames.map(contract =>
            this.client.v1.chain.get_abi(contract)
        );
        const abiResponses = await Promise.all(abiPromises);

        // Create ABI array for Transaction.from()
        const abis = contractNames.map((contract, index) => ({
            contract,
            abi: abiResponses[index]?.abi
        })).filter(item => item.abi);

        const tx = Transaction.from({
            ...header,
            actions: transaction.actions
        }, abis);

        const signature = transaction.privateKey.signDigest(
            tx.signingDigest(info.chain_id)
        );

        const signedTransaction = SignedTransaction.from({
            ...tx,
            signatures: [signature]
        });

        return await this.client.v1.chain.push_transaction(signedTransaction);
    }

    getOperation(data, account) {
        // FIXME this file no longer uses eosjs, and a query to WharfKit's DeepWiki produces
        // "The block producer voting API is accessed through the get_producer_schedule() method in the Chain API"
        // So implementing this does now seem possible, perhaps?

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
        const privateKey = PrivateKey.from(key);
        const message = Bytes.from(string, 'utf8');
        const signature = privateKey.signMessage(message);
        return signature.toString();
    }

    _verifyString(signature, publicKey, string) {
        const sig = Signature.from(signature);
        const pubKey = PublicKey.from(publicKey);
        const message = Bytes.from(string, 'utf8');
        return sig.verifyMessage(message, pubKey);
    }

    getExplorer(object, chain) {
        if (object.accountName) {
            return "https://eosauthority.com/account/" + object.accountName;
        } else if (object.txid) {
            // 4e0d513db2b03e7a5cdee0c4b5b8096af33fba08fcf2b7c4b05ab8980ae4ffc6
            return "https://eosauthority.com/transaction/" + object.txid;
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
                translate_key: "import_keys",
            },
        ];
    }

    /**
     * Processing and localizing operations in the transaction
     * @param {Object[]} trx
     * @returns
     */
    async visualize(trx) {
        const _trx = typeof trx[1] === "string" ? JSON.parse(trx[1]) : trx[1];
        console.log({ trx, _trx, actions: _trx.actions[0] });
        let beautifiedOpPromises = [];
        for (let i = 0; i < _trx.actions.length; i++) {
            let operation = _trx.actions[i];
            beautifiedOpPromises.push(beautify(operation));
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
