<script setup>
    import { ref, computed, watch, onMounted } from 'vue';
    import { useI18n } from 'vue-i18n';

    import router from '../router/index.js';
    import store from '../store/index.js';
    import langSelect from "./lang-select.vue";

    let open = ref(false);
    let lastIndex = ref(0);
    const { t } = useI18n({ useScope: 'global' });

    let items = computed(() => {
        return [
            {
                text: t("common.actionBar.Home"),
                index: 0,
                icon: "home",
                url: "/dashboard"
            },
            {
                text: t("common.actionBar.New"),
                index: 1,
                icon: "add",
                url: "/add-account"
            },
            {
                text: t("common.actionBar.WWW"),
                index: 2,
                icon: "web",
                url: "/www"
            },
            {
                text: t("common.actionBar.TOTP"),
                index: 3,
                icon: "generating_tokens",
                url: "/totp"
            },
            {
                text: t("common.actionBar.Local"),
                index: 4,
                icon: "upload",
                url: "/local"
            },
            {
                text: t("common.actionBar.RAW"),
                index: 5,
                icon: "raw_on",
                url: "/raw-link"
            },
            {
                text: t("common.actionBar.QR"),
                index: 6,
                icon: "qr_code_2",
                url: "/qr"
            },
            {
                text: t("common.actionBar.dapps"),
                index: 7,
                icon: "app_registration",
                url: "/dapps"
            },
            {
                text: t("common.actionBar.Backup"),
                index: 8,
                icon: "download",
                url: "/backup"
            },
            {
                text: t("common.actionBar.Settings"),
                index: 9,
                icon: "settings",
                url: "/settings"
            },
            {
                text: t("common.actionBar.Logout"),
                index: 10,
                icon: "logout",
                url: "/"
            }
        ]
    });

    function onChange(data) {
        const newIndex = data.index;
        if (
            lastIndex.value &&
            lastIndex.value === 2 && // WWW
            newIndex !== 2 // leaving WWW
        ) {
            console.log("Automatically shutting down web services");
            window.electron.closeServer();
        }
        lastIndex.value = newIndex;

        if (data.index === 10) {
            console.log('User logged out.');
            store.dispatch("WalletStore/logout");
            router.replace("/");
        }

        router.replace(items.value[data.index].url);
    }

    let logoutTimer = null;
    function startLogoutTimer(newValue) {
        if (logoutTimer) {
            clearTimeout(logoutTimer);
        }

        logoutTimer = setTimeout(() => {
            console.log('wallet timed logout');
            if (newValue === 2) {
                window.electron.closeServer();
            }
            store.dispatch("WalletStore/logout");
            router.replace("/");
        }, 2 * 60 * 1000);
    }

    watch(lastIndex, (newValue, oldValue) => {
        if (items.value[oldValue]) {
            console.log(`User navigated from ${items.value[oldValue].text} to ${items.value[newValue].text}`);
        } else if (newValue === oldValue) {
            console.log(`Page ${items.value[newValue].text} is in use...`);
        }

        window.electron.removeAllListeners('signMessage');
        window.electron.removeAllListeners('signNFT');
        window.electron.removeAllListeners('injectedCall');
        window.electron.removeAllListeners('requestSignature');
        window.electron.removeAllListeners('getAccount');
        window.electron.removeAllListeners('verifyMessage');

        if (
            store.state.WalletStore.isUnlocked &&
            [2,3,4,5,6].includes(newValue)
        ) {
            const decryptKey = async (encryptedKey) => {
                return new Promise(async (resolve, reject) => {
                    let signature = await window.electron.getSignature('decrypt');
                    if (!signature) {
                        console.log('Signature failure')
                        return reject('signature failure');
                    }

                    let isValid;
                    try {
                        isValid = await window.electron.verifyCrypto({
                            signedMessage: signature.signedMessage,
                            msgHash: signature.msgHash,
                            pubk: signature.pubk
                        });
                    } catch (error) {
                        console.log(error);
                    }

                    if (!isValid) {
                        console.log('invalid signature')
                        return reject('invalid signature');
                    }

                    console.log("Was valid, proceeding to decrypt");
                    let decryptedKey;
                    try {
                        decryptedKey = await window.electron.decrypt({data: encryptedKey, inject: true});
                    } catch (error) {
                        console.log(error);
                        return reject('decrypt failure');
                    }

                    if (!decryptedKey) {
                        console.log('Decryption failure')
                        return reject('decryption failure');
                    }

                    return resolve(decryptedKey);
                })
            }

            window.electron.onSignMessage((request) => {
                let shownBeetApp = store.getters['OriginStore/getBeetApp'](request);
                if (!shownBeetApp) {
                    window.electron.signMessageError({id: request.id, result: {isError: true, method: "signMessage.getBeetApp", error: 'No beetApp'}});
                }

                let account = store.getters['AccountStore/getSafeAccount'](JSON.parse(JSON.stringify(shownBeetApp)));
                store.dispatch("WalletStore/notifyUser", {notify: "request", message: t('common.apiUtils.signMessage')});

                window.electron.createPopup({
                    request: request,
                    accounts: [account]
                });

                window.electron.popupApproved(request.id, async (result) => {
                    let retrievedKey;
                    try {
                        retrievedKey = store.getters['AccountStore/getSigningKey'](request);
                    } catch (error) {
                        window.electron.signMessageError({id: request.id, result: {isError: true, method: "signMessage.getSigningKey", error: error}});
                        return;
                    }

                    let processedKey;
                    try {
                        processedKey = await decryptKey(retrievedKey)
                    } catch (error) {
                        window.electron.signMessageError({id: request.id, result: {isError: true, method: "signMessage.getKey", error: error}});
                        return;
                    }

                    let accountName;
                    try {
                        accountName = account.accountName;
                    } catch (error) {
                        window.electron.signMessageError({id: request.id, result: {isError: true, method: "signMessage.accountName", error: error}});
                        return;
                    }

                    let signedMessage;
                    try {
                        signedMessage = await window.electron.executeSignMessage({
                            key: processedKey,
                            name: accountName,
                            params: request.payload.params
                        });
                    } catch (error) {
                        window.electron.signMessageError({id: request.id, result: {isError: true, method: "signMessage.executeSignMessage", error: error}});
                        return;
                    }

                    window.electron.signMessageResponse({result: signedMessage});
                });

                window.electron.popupRejected(request.id, (result) => {
                    window.electron.signMessageError({id: request.id, result: {isError: true, method: "signMessage.popupRejected", error: result}});
                });
            });

            window.electron.onSignNFT((request) => {
                let shownBeetApp = store.getters['OriginStore/getBeetApp'](request);
                if (!shownBeetApp) {
                    window.electron.signNFTError({id: request.id, result: {isError: true, method: "signNFT.getBeetApp", error: 'No beetApp'}});
                    return;
                }
          
                let account = store.getters['AccountStore/getSafeAccount'](JSON.parse(JSON.stringify(shownBeetApp)));
                store.dispatch("WalletStore/notifyUser", {notify: "request", message: t('common.apiUtils.signNFT')});

                window.electron.createPopup({
                    request: request,
                    accounts: [account]
                });
            
                window.electron.popupApproved(request.id, async (result) => { // `popupApproved_${request.id}`                
                    let retrievedKey;
                    try {
                        retrievedKey = store.getters['AccountStore/getSigningKey'](request);
                    } catch (error) {
                        console.log(error);
                        window.electron.signNFTError({id: request.id, result: {isError: true, method: "signNFT.getSigningKey", error: error}});
                        return;
                    }

                    if (!retrievedKey) {
                        window.electron.signNFTError({id: request.id, result: {isError: true, method: "signNFT.getSigningKey", error: "No retrievedKey"}});
                        return;
                    }
            
                    let processedKey;
                    try {
                        processedKey = await decryptKey(retrievedKey)
                    } catch (error) {
                        console.log(error);
                        window.electron.signNFTError({id: request.id, result: {isError: true, method: "signNFT.getKey", error: error}});
                        return;
                    }

                    if (!processedKey) {
                        window.electron.signNFTError({id: request.id, result: {isError: true, method: "signNFT.getKey", error: "No processedKey"}});
                        return;
                    }

                    let _request;
                    try {
                        _request = await window.electron.blockchainRequest({
                            methods: ["signNFT"],
                            account: null,
                            chain: store.getters['AccountStore/getChain'],
                            key: processedKey,
                            target: request.payload.params
                        });
                    } catch (error) {
                        console.log(error);
                        window.electron.signNFTError({id: request.id, result: {isError: true, method: "signNFT.executeSignNFT", error: error}});
                        return;
                    }
            
                    if (!_request || !_request.signNFT) {
                        window.electron.signNFTError({id: request.id, result: {isError: true, method: "signNFT.executeSignNFT", error: "No signedNFT"}});
                        return;
                    }

                    window.electron.signNFTResponse({result: _request.signNFT});
                });

                window.electron.popupRejected(request.id, (result) => { // `popupRejected_${request.id}`
                    window.electron.signNFTError({id: request.id, result: {isError: true, method: "signNFT.popupRejected", error: result}});
                });
            });

            window.electron.onInjectedCall(async (args) => {
                const {
                    request,
                    chain,
                    account,
                    visualizedAccount,
                    visualizedParams,
                    isBlocked,
                    blockedAccounts,
                    foundIDs
                } = args;

                if (
                    (["BTS", "BTS_TEST"].includes(chain)) &&
                    ((!visualizedAccount && account && !account.accountName) || !visualizedParams)
                ) {
                    console.log("Missing required fields for injected call");
                    window.electron.injectedCallError({id: request.id, result: {isError: true, method: "injectedCall.missingFields", error: 'Missing required fields for injected BTS call'}});
                    return;
                }

                if (
                    (["EOS", "BEOS", "TLOS"].includes(chain)) &&
                    !visualizedParams
                ) {
                    console.log(`Missing required fields for injected ${chain} based call`);
                    window.electron.injectedCallError({id: request.id, result: {isError: true, method: "injectedCall.missingFields", error: `Missing required fields for injected ${chain} based call`}});
                    return;
                }

                const popupContents = (["EOS", "BEOS", "TLOS"].includes(chain))
                    ? {
                        request: request,
                        visualizedAccount: visualizedAccount,
                        visualizedParams: JSON.stringify(visualizedParams)
                    }
                    : {
                        request: request,
                        visualizedAccount: visualizedAccount || account.accountName,
                        visualizedParams: JSON.stringify(visualizedParams)
                    };

                if (chain === "BTS" && foundIDs.length) {
                    popupContents['isBlockedAccount'] = isBlocked;
                }

                if (
                    chain === "BTS" &&
                    (!blockedAccounts || !blockedAccounts.length)
                ) {
                    popupContents['serverError'] = true;
                }
                
                try {
                    window.electron.createPopup(popupContents);
                } catch (error) {
                    window.electron.injectedCallError({id: request.id, result: {isError: true, method: "injectedCall.createPopup", error: error}});
                    return;
                }

                store.dispatch("WalletStore/notifyUser", {notify: "request", message: t('common.apiUtils.inject')});

                window.electron.popupApproved(request.id, async (args) => {
                    let _request = request;
                    if (["BTS", "BTS_TEST"].includes(chain)) {        
                        if (request.payload.memo) {
                            let from;
                            let to;
                            if (request.payload.from) {
                                from = request.payload.from;
                                to = request.payload.to;
                            } else if (request.payload.withdraw_from_account) {
                                from = request.payload.withdraw_from_account;
                                to = request.payload.withdraw_to_account;
                            } else if (request.payload.issuer) {
                                from = request.payload.issuer;
                                to = request.payload.issue_to_account;
                            }

                            let _blockchainRequest;
                            try {
                                _blockchainRequest = await window.electron.blockchainRequest({
                                    methods: ["createMemoObject"],
                                    account: null,
                                    chain: chain,
                                    from: from,
                                    to: to,
                                    optionalNonce: request.payload.params.optionalNonce ?? undefined,
                                    encryptMemo: request.payload.params.encryptMemo ?? undefined,
                                });
                            } catch (error) {
                                console.log(error);
                            }

                            if (_blockchainRequest && _blockchainRequest.createMemoObject) {
                                _request.payload.memo = _blockchainRequest.createMemoObject;
                            }
                        }
                    }

                    let finalResult;
                    let notifyTXT = "";

                    let txType = _request.payload.params[0] ?? "signAndBroadcast";
                    if (txType == "broadcast") {
                        try {
                            finalResult = await window.electron.blockchainRequest({
                                methods: ["broadcastTransaction"],
                                account: null,
                                chain: chain,
                                operation: _request.payload.params
                            });
                        } catch (error) {
                            console.log(error)
                            window.electron.injectedCallError({id: _request.id, result: {isError: true, method: "injectedCall.blockchain.broadcast", error: error}});
                            return;
                        }

                        if (!finalResult || !finalResult.broadcastTransaction) {
                            window.electron.injectedCallError({id: _request.id, result: {isError: true, method: "injectedCall.finalResult", error: 'No final result'}});
                            return;
                        }

                        store.dispatch(
                            "WalletStore/notifyUser",
                            {notify: "request", message: t('common.apiUtils.broadcast')}
                        );
                        window.electron.injectedCallResponse({id: _request.id, result: {result: finalResult.broadcastTransaction}});
                        return;
                    }

                    let activeKey;
                    if (["BTS", "BTS_TEST"].includes(chain)) {
                        try {
                            activeKey = request.payload.account_id
                                ? store.getters['AccountStore/getActiveKey'](request)
                                : store.getters['AccountStore/getCurrentActiveKey']();
                        } catch (error) {
                            console.log(error);
                            window.electron.injectedCallError({id: request.id, result: {isError: true, method: "injectedCall.getActiveKey", error: error}});
                            return;
                        }
                    } else if (["EOS", "BEOS", "TLOS"].includes(chain)) {
                        activeKey = store.getters['AccountStore/getEOSKey']();
                    }

                    let signingKey;
                    try {
                        signingKey = await decryptKey(activeKey);
                    } catch (error) {
                        console.log(error)
                        window.electron.injectedCallError({id: request.id, result: {isError: true, method: "injectedCall.getKey", error: error}});
                        return;
                    }

                    if (txType == "signAndBroadcast") {
                        try {
                            if (["BTS", "BTS_TEST"].includes(chain)) {
                                finalResult = await window.electron.blockchainRequest({
                                    methods: ["signAndBroadcast"],
                                    account: null,
                                    chain: chain,
                                    operation: request.payload.params,
                                    signingKey: signingKey
                                });
                            } else if (["EOS", "BEOS", "TLOS"].includes(chain)) {
                                finalResult = await window.electron.blockchainRequest({
                                    methods: ["signAndBroadcast"],
                                    account: null,
                                    chain: chain,
                                    operation: JSON.parse(request.payload.params[1]),
                                    signingKey: signingKey
                                });
                            }
                        } catch (error) {
                            console.log(error);
                            window.electron.injectedCallError({id: request.id, result: {isError: true, method: "injectedCall.blockchain.broadcast", error: error}});
                            return;
                        }
                        notifyTXT = t('common.apiUtils.signAndBroadcast');
                    }

                    if (!finalResult || !finalResult.signAndBroadcast) {
                        window.electron.injectedCallError({id: request.id, result: {isError: true, method: "injectedCall.finalResult", error: 'No final result'}});
                        return;
                    }
                    
                    store.dispatch("WalletStore/notifyUser", {notify: "request", message: notifyTXT});

                    if (args?.result?.receipt) {
                        try {
                            window.electron.createReceipt({
                                request: request,
                                result: finalResult.signAndBroadcast,
                                notifyTXT: notifyTXT,
                                receipt: {
                                    visualizedAccount: popupContents.visualizedAccount,
                                    visualizedParams: popupContents.visualizedParams
                                }
                            });
                        } catch (error) {
                            console.log(error)
                        }
                    }

                    window.electron.injectedCallResponse({id: request.id, result: {result: finalResult}});
                })

                window.electron.popupRejected(request.id, (result) => {
                    window.electron.injectedCallError({id: request.id, result: {isError: true, method: "injectedCall.popupRejected", error: result}});
                });
            });

            window.electron.onRequestSignature((request, chain, visualizedParams, visualizedAccount) => {
                if (!request || !request.payload) {
                    window.electron.requestSignatureError({id: request.id, result: {isError: true, method: "requestSignature.inputs", error: 'input error'}});
                    return;
                }

                store.dispatch("WalletStore/notifyUser", {notify: "request", message: `Signature request type: ${request.params[0]}`});

                window.electron.createPopup({
                    request: request,
                    visualizedParams: visualizedParams,
                    visualizedAccount: visualizedAccount
                });

                window.electron.popupApproved(request.id, async (result) => {

                    let activeKey;
                    if (["BTS", "BTS_TEST"].includes(chain)) {
                        try {
                            activeKey = request.payload.account_id
                                ? store.getters['AccountStore/getActiveKey'](request)
                                : store.getters['AccountStore/getCurrentActiveKey']();
                        } catch (error) {
                            console.log(error)
                            window.electron.requestSignatureError({id: request.id, result: {isError: true, method: "requestSignature.getActiveKey", error: error}});
                            return;
                        }
                    } else if (["EOS", "BEOS", "TLOS"].includes(chain)) {
                        activeKey = store.getters['AccountStore/getEOSKey']();
                    }

                    let signingKey;
                    try {
                        signingKey = await decryptKey(activeKey);
                    } catch (error) {
                        console.log(error);
                        window.electron.requestSignatureError({id: request.id, result: {isError: true, method: "requestSignature.getKey", error: error}});
                        return;
                    }

                    let transaction;
                    try {
                        if (["BTS", "BTS_TEST"].includes(chain)) {
                            transaction = await window.electron.requestSignature(request.payload.params, signingKey);
                        } else if (["EOS", "BEOS", "TLOS"].includes(chain)) {
                            transaction = await window.electron.requestSignature(JSON.parse(request.payload.params[1]), signingKey);
                        }   
                    } catch (error) {
                        console.log(error);
                        window.electron.injectedCallError({id: request.id, result: {isError: true, method: "injectedCall.blockchain.sign", error: error}});
                        return;
                    }

                    if (!transaction || !transaction.toObject()) {
                        window.electron.requestSignatureError({id: request.id, result: {isError: true, method: "requestSignature.finalResult", error: 'No final result'}});
                        return;
                    }

                    store.dispatch("WalletStore/notifyUser", {notify: "request", message: t('common.apiUtils.sign')});
                    window.electron.requestSignatureResponse({id: request.id, result: {result: transaction.toObject()}});
                });

                window.electron.popupRejected(request.id, (result) => {
                    window.electron.requestSignatureError({id: request.id, result: {isError: true, method: "requestSignature.popupRejected", error: result}});
                });
            });

            window.electron.onGetAccount((request) => {
                let shownBeetApp = store.getters['OriginStore/getBeetApp'](request);
                if (!shownBeetApp) {
                    window.electron.getAccountError({id: request.id, result: {isError: true, method: "getAccount.getBeetApp", error: 'No beetApp'}});
                }

                let account = store.getters['AccountStore/getSafeAccount'](JSON.parse(JSON.stringify(shownBeetApp)));

                window.electron.createPopup({
                    request: request,
                    accounts: [account]
                });

                window.electron.popupApproved(request.id, async (result) => {
                    window.electron.getAccountResponse(result);
                });

                window.electron.popupRejected(request.id, (result) => {
                    window.electron.getAccountError({id: request.id, result: {isError: true, method: "getAccount.popupRejected", error: result}});
                });
            });

            window.electron.onVerifyMessage((request) => {
                if (!store.state.WalletStore.isUnlocked) {
                    window.electron.verifyMessageError({id: request.id, result: {isError: true, method: "verifyMessage.verify", error: 'Wallet is locked'}});
                    store.dispatch("WalletStore/notifyUser", {notify: "request", message: window.t('common.apiUtils.msgVerify')});
                    return;
                }

                store.dispatch("WalletStore/notifyUser", {notify: "request", message: window.t('common.apiUtils.msgVerify')});
                window.electron.verifyMessageResponse();
            });

        }
        startLogoutTimer(newValue);
    }, { immediate: true });

    watch(() => router.currentRoute.value, (newRoute) => {
        const matchingItem = items.value.find(item => item.url === newRoute.path);
        if (matchingItem) {
            if (lastIndex.value === 2) {
                window.electron.closeServer();
            }
            lastIndex.value = matchingItem.index;
        }
    });

    watch(() => store.state.WalletStore.isUnlocked, (isUnlocked) => {
        if (isUnlocked) {
            window.electron.timer(() => startLogoutTimer(lastIndex.value));
            window.electron.setNode((data) => {
                const _currentChain = store.getters['AccountStore/getChain'];
                store.dispatch("SettingsStore/setNode", {
                    chain: _currentChain,
                    node: data
                });
            });
            window.electron.onGetSafeAccount((arg) => {
                let account = store.getters['AccountStore/getCurrentSafeAccount']();
                window.electron.getSafeAccountResponse(account);
            });
        }
    }, { immediate: true }); 
</script>

<template>
    <div>
        <ui-menu-anchor
            absolute
            position="BOTTOM_START"
        >
            <ui-fab
                v-if="store.state.WalletStore.isUnlocked"
                style="margin-bottom: 10px;"
                icon="menu"
                mini
                @click="open = true"
            />
            <langSelect location="small" />

            <ui-menu
                v-model="open"
                style="border: 1px solid #C7088E;"
                position="BOTTOM_START"
                @selected="onChange"
            >
                <ui-menuitem
                    v-for="item in items"
                    :key="item.icon"
                    nested
                >
                    <ui-menuitem
                        v-if="lastIndex === item.index"
                        selected
                    >
                        <ui-menuitem-icon dark>
                            <ui-icon style="color: #707070;">
                                {{ item.icon }}
                            </ui-icon>
                        </ui-menuitem-icon>
                        <ui-menuitem-text>{{ item.text }}</ui-menuitem-text>
                    </ui-menuitem>
                    <ui-menuitem v-else>
                        <ui-menuitem-icon dark>
                            <ui-icon
                                dark
                                style="visibility: visible;"
                            >
                                {{ item.icon }}
                            </ui-icon>
                        </ui-menuitem-icon>
                        <ui-menuitem-text>{{ item.text }}</ui-menuitem-text>
                    </ui-menuitem>
                </ui-menuitem>
            </ui-menu>
        </ui-menu-anchor>
    </div>
</template>
