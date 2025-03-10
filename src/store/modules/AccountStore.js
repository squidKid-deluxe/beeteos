const LOAD_ACCOUNTS = 'LOAD_ACCOUNTS';
const CHOOSE_ACCOUNT = 'CHOOSE_ACCOUNT';
const ADD_ACCOUNT = 'ADD_ACCOUNT';
const CLEAR_ACCOUNTS = 'CLEAR_ACCOUNTS';
const DELETE_ACCOUNT = 'DELETE_ACCOUNT';

const mutations = {
    [LOAD_ACCOUNTS](state, accounts) {
        state.accountlist = accounts;
        state.selectedIndex = 0;
    },
    [CHOOSE_ACCOUNT](state, accountIndex) {
        state.selectedIndex = accountIndex;
    },
    [ADD_ACCOUNT](state, account) {
        state.accountlist.push(account);
        state.selectedIndex = state.accountlist.length - 1;
    },
    [CLEAR_ACCOUNTS](state) {
        state.selectedIndex = null;
        state.accountlist = [];
    },
    [DELETE_ACCOUNT](state, accountName) {
        const index = state.accountlist.findIndex(account => account.accountName === accountName);
        if (index !== -1) {
            state.accountlist.splice(index, 1);
            if (state.selectedIndex === index) {
                state.selectedIndex = null;
            } else if (state.selectedIndex > index) {
                state.selectedIndex--;
            }
        }
    }
};

const actions = {
    addAccount({
        dispatch,
        commit,
        state
    }, payload) {
        return new Promise(async (resolve, reject) => {
            let existingAccount = state.accountlist.find(
                x => x.chain == payload.account.chain &&
                (
                    x.accountID && x.accountID === payload.account.accountName ||
                    x.accountName && x.accountName === payload.account.accountName
                )
            );

            if (!existingAccount) {
                let _hash = await window.electron.sha512({data: payload.password});
                let keys = Object.keys(payload.account.keys);
                for (let i = 0; i < keys.length; i++) {
                    let keytype = keys[i];
                    let _aesResult;
                    try {
                        _aesResult = await window.electron.aesEncrypt({
                            data: payload.account.keys[keytype],
                            seed: _hash
                        });
                    } catch (error) {
                        console.log({error});
                        throw 'AES encryption failure';
                    }

                    if (_aesResult) {
                        payload.account.keys[keytype] = _aesResult;
                    }
                }

                dispatch('WalletStore/saveAccountToWallet', payload, {root: true})
                .then(() => {
                    commit(ADD_ACCOUNT, payload.account);
                    return resolve('Account added');
                }).catch((error) => {
                    console.log(error)
                    return reject(error);
                });
            } else {
                return reject('Account already exists');
            }
        });
    },
    deleteAccount({ commit, dispatch, state }, payload) {
        return new Promise((resolve, reject) => {
            let existingAccount = state.accountlist.find(
                x => x.chain == payload.account.chain &&
                (x.accountID == payload.account.accountName || x.accountName === payload.account.accountName)
            );
            
            if (existingAccount) {
                dispatch('deleteAccountFromWallet', payload).then(() => {
                    commit(DELETE_ACCOUNT, payload.accountName);
                    resolve('Account deleted');
                }).catch((error) => {
                    reject(error);
                });
            } else {
                reject('Account not found');
            }
        })
    },
    loadAccounts({
        commit
    }, payload) {
        return new Promise((resolve, reject) => {
            if (payload && payload.length > 0) {
                commit(LOAD_ACCOUNTS, payload);
                resolve('Accounts Loaded');
            } else {
                reject('Empty Account list');
            }
        });
    },
    logout({
        commit
    }) {
        return new Promise((resolve, reject) => {
            commit(CLEAR_ACCOUNTS);
            resolve();
        });
    },
    selectAccount({
        commit,
        state
    }, payload) {
        return new Promise((resolve, reject) => {
            let index = -1;
            for (let i = 0; i < state.accountlist.length; i++) {
                if (
                    (payload.chain == state.accountlist[i].chain) &&
                    (
                        payload.accountID == state.accountlist[i].accountID ||
                        payload.accountID == state.accountlist[i].accountName ||
                        payload.accountName == state.accountlist[i].accountName
                    )
                ) {
                    index = i;
                    break;
                }
            }

            if (index != -1) {
                commit(CHOOSE_ACCOUNT, index);
                resolve('Account found');
            }
        });
    }
}

const getters = {
    getCurrentSafeAccount: state => () => {
        let selected = state.selectedIndex;
        let currentAccount = state.accountlist[selected ?? 0];
        return {
            accountID: currentAccount.accountID,
            accountName: currentAccount.accountName,
            chain: currentAccount.chain
        }
    },
    getCurrentIndex: state => state.selectedIndex ?? -1,
    getChain: state => state.accountlist[state.selectedIndex].chain,
    getAccountList: state => state.accountlist,
    getAccountQuantity: state => state.accountlist.length,
    getSafeAccountList: state => () => {
        const _mappedAccounts = state.accountlist.map(account => {
            return {
                accountID: account.accountID,
                accountName: account.accountName,
                chain: account.chain
            };
        });
        return _mappedAccounts;
    },
    getSafeAccount: state => (request) => {
        let safeAccounts = state.accountlist.map(account => {
          return {
            accountID: account.accountID,
            accountName: account.accountName,
            chain: account.chain,
            memoKey: account.keys.memo
          };
        });

        let requestedAccounts = safeAccounts.filter(account => {
            return account.accountID == request.account_id && account.chain == request.chain
                    ? true
                    : false;
        });

        if (!requestedAccounts || !requestedAccounts.length) {
            console.log("Couldn't retrieve account safely.");
            return;
        }

        return requestedAccounts[0];
    },
    getCurrentActiveKey: (state) => () => {
        let currentAccount = state.accountlist[state.selectedIndex];
        return currentAccount.keys.active;
    },
    getEOSKey: (state) => () => {
        let currentAccount = state.accountlist[state.selectedIndex];
        return currentAccount.keys.privateKey;
    },
    getActiveKey: (state) => (request) => {
      let signing = state.accountlist.filter(account => {
          return (
              account.accountID == request.payload.account_id &&
              account.chain == request.payload.chain
          );
      });

      if (!signing || !signing.length) {
          return;
      }

      return signing.slice()[0].keys.active;
    },
    getSigningKey: (state) => (request) => {
        let signing = state.accountlist.filter(account => {
            return (
                account.accountID == request.payload.account_id &&
                account.chain == request.payload.chain
            );
        });

        if (!signing || !signing.length) {
            return;
        }

        let keys = signing.slice()[0].keys;

        return keys.memo
                ? keys.memo
                : keys.active;
    },
    getPrivateMemoKey: (state) => (accountId, chain) => {
        try {
            const account = state.accountlist.find(account => account.accountID === accountId && account.chain === chain);
            if (account && account.keys.memo) {
                return account.keys.memo;
            }
        } catch (error) {
            console.error("Failed to get private memo key:", error);
        }
        return null;
    }
};

const initialState = {
    selectedIndex: null,
    accountlist: []
};

export default {
    namespaced: true,
    state: initialState,
    actions,
    mutations,
    getters,
};
