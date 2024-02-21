import BeetDB from '../../lib/BeetDB.js';

const GET_WALLET = 'GET_WALLET';
const CREATE_WALLET = 'CREATE_WALLET';
const CONFIRM_UNLOCK = 'CONFIRM_UNLOCK';
const SET_WALLET_STATUS = 'SET_WALLET_STATUS';
const SET_WALLET_UNLOCKED = 'SET_WALLET_UNLOCKED';
const SET_WALLETLIST = 'SET_WALLETLIST';
const REQ_NOTIFY = 'REQ_NOTIFY';
const CLOSE_WALLET = 'CLOSE_WALLET';
const SET_SELECTED_WALLET_INDEX = 'SET_SELECTED_WALLET_INDEX';

const wallet = {};

const mutations = {
    [GET_WALLET](state, wallet) {
        state.wallet = wallet;
    },
    [CONFIRM_UNLOCK](state) {
        state.unlocked.resolve();
        state.isUnlocked = true;
    },
    [CLOSE_WALLET](state) {
        state.wallet = {};
        state.hasWallet = false;
        state.walletlist = [];
        state.unlocked = {};
        state.isUnlocked = false;
    },
    [SET_WALLET_STATUS](state, status) {
        state.hasWallet = status;
    },
    [SET_WALLET_UNLOCKED](state, unlocked) {
        state.unlocked = unlocked;
    },
    [SET_WALLETLIST](state, walletlist) {
        state.walletlist = walletlist;
    },
    [REQ_NOTIFY](state, notify) {
        window.electron.notify(notify);
    },
    [CREATE_WALLET](state, wallet) {
        state.wallet = wallet;
    },
    [SET_SELECTED_WALLET_INDEX](state, index) {
        state.selectedWalletIndex = index;
    },
};

const actions = {
    setSelectedWalletIndex({ commit }, index) {
        commit(SET_SELECTED_WALLET_INDEX, index);
    },
    getWallet({
        dispatch,
        commit,
        state
    }, payload) {
        return new Promise((resolve, reject) => {
            BeetDB.wallets_encrypted.get({
                id: payload.wallet_id
            }).then(async (wallet) => {
                let _hash;
                try {
                    _hash = await window.electron.sha512({data: payload.wallet_pass});
                } catch (error) {
                    console.log({error});
                    reject('hash_failure');
                }

                let bytes;
                try {
                    bytes = await window.electron.aesDecrypt({data: wallet.data, seed: _hash});
                } catch (error) {
                    console.log({error});
                    throw error;
                }

                if (!bytes) {
                    console.log("No decrypted data")
                    throw 'decrypt_failure';
                }

                let public_wallets = state.walletlist.filter((x) => {
                    return x.id == payload.wallet_id
                });

                commit(GET_WALLET, public_wallets[0]);
                let accountlist = bytes;
                dispatch('AccountStore/loadAccounts', accountlist, {
                    root: true
                });
                resolve();
            }).catch((e) => {
                reject(e);
            });
        });
    },
    confirmUnlock({
        commit
    }) {
        console.log('Unlocked wallet!');
        commit(CONFIRM_UNLOCK);
    },
    restoreWallet({
        commit,
        dispatch
    }, payload) {
        return new Promise(async (resolve, reject) => {
            let walletid;
            try {
                walletid = await window.electron.id();
            } catch (error) {
                console.log({error});
                reject('uuid_failure');
            }

            let newwallet = {
                id: walletid,
                name: payload.backup.wallet,
                chain: '',
                accounts: payload.backup.accounts.map(x=> x.accountID)
            };
            BeetDB.wallets_public.put(newwallet).then(() => {
                BeetDB.wallets_public.toArray().then(async (wallets) => {
                    let unlock;
                    let unlocked = new Promise(function (resolve) {
                        unlock = resolve
                    });
                    commit(SET_WALLET_UNLOCKED, {
                        promise: unlocked,
                        resolve: unlock
                    });
                    commit(SET_WALLET_STATUS, true);
                    commit(SET_WALLETLIST, wallets);

                    let _hash;
                    try {
                        _hash = await window.electron.sha512({data: payload.password});
                    } catch (error) {
                        console.log({error});
                        return;
                    }

                    let _encrypted;
                    try {
                        _encrypted = await window.electron.aesEncrypt({
                            data: JSON.stringify(payload.backup.walletdata),
                            seed: _hash
                        });
                    } catch (error) {
                        console.log({error});
                        return;
                    }

                    BeetDB.wallets_encrypted.put({
                        id: walletid,
                        data: _encrypted
                    });

                    commit(GET_WALLET, newwallet);
                    dispatch('AccountStore/loadAccounts', payload.backup.walletdata, {
                        root: true
                    });
                    resolve();
                }).catch((e) => {
                    throw (e);
                });
            }).catch((e) => {
                reject(e);
            });
        });

    },
    saveWallet({
        commit,
        dispatch
    }, payload) {
        return new Promise(async (resolve, reject) => {
            let walletid;
            try {
                walletid = await window.electron.id();
            } catch (error) {
                console.log({error});
                reject('uuid_failure');
            }
            let newwallet = {
                id: walletid,
                name: payload.walletname,
                accounts: [{ accountID: payload.walletdata.accountID, chain: payload.walletdata.chain}]
            };
            BeetDB.wallets_public.put(newwallet).then(() => {
                BeetDB.wallets_public.toArray().then(async (wallets) => {
                    let unlock;
                    let unlocked = new Promise(function (resolve) {
                        unlock = resolve
                    });
                    commit(SET_WALLET_UNLOCKED, {
                        promise: unlocked,
                        resolve: unlock
                    });
                    commit(SET_WALLET_STATUS, true);
                    commit(SET_WALLETLIST, wallets);

                    let _hash;
                    try {
                        _hash = await window.electron.sha512({data: payload.password});
                    } catch (error) {
                        console.log({error});   
                        return;
                    }

                    for (let keytype in payload.walletdata.keys) {
                        let _encrypted;
                        try {
                            _encrypted = await window.electron.aesEncrypt({
                                data: payload.walletdata.keys[keytype],
                                seed: _hash
                            });
                        } catch (error) {
                            console.log({error});
                            reject('AES encryption failure');
                        }
                    }
                    
                    let _encryptedWalletData;
                    try {
                        _encryptedWalletData = await window.electron.aesEncrypt({
                            data: JSON.stringify(payload.walletdata),
                            seed: _hash
                        });
                    } catch (error) {
                        console.log({error});
                        reject('AES encryption failure');
                    }

                    BeetDB.wallets_encrypted.put({
                        id: walletid,
                        data: _encryptedWalletData
                    });

                    commit(GET_WALLET, newwallet);
                    dispatch('AccountStore/loadAccounts', [payload.walletdata], {
                        root: true
                    });
                    resolve();
                }).catch((e) => {
                    throw (e);
                });
            }).catch((e) => {
                reject(e);
            });
        });
    },
    saveAccountToWallet({
        commit,
        state,
        rootState
    }, payload) {
        return new Promise(async (resolve, reject) => {
            let walletdata =  rootState.AccountStore.accountlist.slice();
            let newwalletdata = walletdata;
            newwalletdata.push(payload.account);

            await BeetDB.wallets_encrypted.get({
                id: state.wallet.id
            }).then(async (wallet) => {
                let _hash;
                try {
                    _hash = await window.electron.sha512({data: payload.password});
                } catch (error) {
                    console.log({error});
                    throw ('hash_failure');
                }

                let bytes;
                try {
                    bytes = await window.electron.aesDecrypt({data: wallet.data, seed: _hash});
                } catch (error) {
                    console.log({error});
                    throw ('decrypt_failure');
                }

                let encwalletdata;
                try {
                    encwalletdata = await window.electron.aesEncrypt({
                        data: JSON.stringify(newwalletdata),
                        seed: _hash
                    });
                } catch (error) {
                    console.log(error)
                    throw ('encrypt_failure');
                }

                let updatedWallet = JSON.parse(JSON.stringify(state.wallet))
                updatedWallet.accounts.push({
                    accountID: payload.account.accountID,
                    chain: payload.account.chain
                });
                
                let docID = updatedWallet.id;
                let newAccounts = updatedWallet.accounts;

                await BeetDB.wallets_encrypted.update(docID, {
                    "data": encwalletdata
                }).then(async () => {
                    await BeetDB.wallets_public.update(docID, {
                        "accounts": newAccounts
                    }).then(() => {
                        commit(GET_WALLET, updatedWallet);
                        resolve('Account saved');
                    }).catch((error) => {
                        console.log(error);
                        reject('update_failed');
                    });
                }).catch((error) => {
                    console.log(error)
                    reject(error);
                });
            }).catch((error) => {
                console.log(error)
                reject(error);
            });

        });
    },
    loadWallets({
        commit
    }) {
        return new Promise((resolve, reject) => {
            BeetDB.wallets_public.toArray().then((wallets) => {
                if (wallets && wallets.length > 0) {
                    let unlock;
                    let unlocked = new Promise(function (resolve) {
                        unlock = resolve
                    });
                    commit(SET_WALLET_UNLOCKED, {
                        promise: unlocked,
                        resolve: unlock
                    });
                    commit(SET_WALLET_STATUS, true);
                    commit(SET_WALLETLIST, wallets);
                    return resolve('Wallets Found');
                } else {
                    return resolve('Wallets not found');
                }
            }).catch((error) => {
                return reject(error);
            });
        });
    },
    notifyUser({
        commit
    }, payload) {
        return new Promise((resolve, reject) => {
            if (payload.notify == 'request') {
                commit(REQ_NOTIFY, payload.message);
                resolve();
            } else {
                reject();
            }
        });
    },
    logout({
        commit,
        dispatch
    }) {
        return new Promise((resolve,reject)=> {
            commit(CLOSE_WALLET);
            dispatch('AccountStore/logout', {}, {
                root: true
            });
            resolve();
        });
    }
}


const getters = {
    getWallet: state => state.wallet,
    getCurrentID: state => {
        if (
            state.selectedWalletIndex !== null &&
            state.selectedWalletIndex >= 0 &&
            state.selectedWalletIndex < state.walletlist.length
        ) {
            return state.walletlist[state.selectedWalletIndex].id;
        } else {
            return null;
        }
    },
    getWalletName: state => state.wallet.name,
    getHasWallet: state => state.hasWallet,
    getWalletList: state => state.walletlist
};

const initialState = {
    wallet: wallet,
    hasWallet: false,
    walletlist: [],
    unlocked: {},
    isUnlocked: false,
    selectedWalletIndex: null,
};

export default {
    namespaced: true,
    state: initialState,
    actions,
    mutations,
    getters,
};
