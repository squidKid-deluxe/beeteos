<script setup>
    import { ref, computed, watchEffect, toRaw, onMounted } from 'vue';
    import { useI18n } from 'vue-i18n';

    import AccountSelect from "./account-select";
    
    import store from '../store/index.js';
    import router from '../router/index.js';
    import BeetDB from '../lib/BeetDB.js';

    const { t } = useI18n({ useScope: 'global' });
    
    let serverOnline = ref(false);

    let chain = computed(() => {
        return store.getters['AccountStore/getChain'];
    });

    const sslCert = ref();
    watchEffect(() => {
        async function lookupSSL() {
            let db = BeetDB.ssl_data;
            let ssl_data;
            try {
                ssl_data = await db.toArray();
            } catch (error) {
                console.log(error);                
            }

            if (
                !ssl_data ||
                !ssl_data.length ||
                (ssl_data[0].timestamp < Date.now() - 30 * 24 * 60 * 60 * 1000)
            ) {
                let retrievedSSL;
                try {
                    retrievedSSL = await window.electron.fetchSSL();
                } catch (error) {
                    console.error(error);
                }

                if (retrievedSSL) {
                    const { key, cert } = retrievedSSL;
                    db.toArray().then((res) => {
                        if (!res || res.length == 0) {
                            db.add({key: key, cert: cert, timestamp: Date.now()});
                        } else {
                            db.update(res[0].id, {key: key, cert: cert, timestamp: Date.now()});
                        }
                    });
                    sslCert.value = { key, cert };
                }
            } else {
                sslCert.value = ssl_data[0];
            }
        }

        if (chain.value) {
            lookupSSL();
        }
    });

    let compatibleChain = ref(false);
    watchEffect(() => {
        async function initialize() {
            let blockchainRequest;
            try {
                blockchainRequest = await window.electron.blockchainRequest(
                    { 
                        methods: ['supportsWeb'],
                        chain: chain.value
                    }
                );
            } catch (error) {
                console.error(error);
            }

            if (blockchainRequest) {
                const { supportsWeb } = blockchainRequest;
                if (supportsWeb) {
                    compatibleChain.value = true;
                }
            }
        }

        if (chain.value) {
            initialize();
        }
    });

    const proceed = ref(false);
    watchEffect(() => {
        async function launchServer() {
            if (
                !store.state.WalletStore.isUnlocked ||
                router.currentRoute.value.path !== "/www"
            ) {
                console.log("Wallet must be unlocked for web requests to work.");
                return;
            }

            let launchedServers;
            try {
                launchedServers = await window.electron.launchServer({
                    cert: sslCert.value ? sslCert.value.cert : null,
                    key: sslCert.value ? sslCert.value.key : null
                });
            } catch (error) {
                console.error(error);
            }

            if (launchedServers) {
                serverOnline.value = launchedServers;
                return;
            }

            serverOnline.value = {
                http: false,
                https: false,
            };
        }

        if (compatibleChain.value && proceed.value === true && serverOnline.value === false) {
            launchServer();
        }
    });

    watchEffect(async () => {
        async function listen() {           
            window.electron.getAuthApp((data) => {
                // Connecting...
                let app;
                let _error;
                try {
                    app = store.getters['OriginStore/getBeetApp'](data)
                } catch (error) {
                    console.log(error);
                    _error = error;
                }

                window.electron.sendAuthResponse({
                    app: app ? toRaw(app) : null,
                    error: _error
                })
            });

            window.electron.newRequest((data) => {
                // Preparing for request
                window.electron.resetTimer();
                store.dispatch('OriginStore/newRequest', data);
            });

            window.electron.link(async (request) => {
                // Linking with a new dapp account
                window.electron.resetTimer();

                let linkReq = {appName: request.appName, origin: request.origin, chain: request.chain};
                let accounts =  store.getters['AccountStore/getSafeAccountList']();
                if (!accounts) {
                    window.electron.linkError({id: request.id, result: {isError: true, method: "getSafeAccountList", error: "No accounts"}})
                    return;
                }

                let existingLinks = [];
                try {
                    existingLinks = store.getters['OriginStore/getExistingLinks'](linkReq);
                } catch (error) {
                    window.electron.linkError({id: request.id, result: {isError: true, method: "existingLinks", error: error}});
                    return;
                }

                store.dispatch(
                    "WalletStore/notifyUser",
                    {notify: "request", message: window.t("common.link_alert", linkReq)}
                );

                window.electron.createPopup(
                    {
                        request: request,
                        accounts: accounts,
                        existingLinks: existingLinks
                    }
                );

                window.electron.popupApproved(request.id, async (result) => {
                    window.electron.resetTimer();
                    console.log({result, location: "popupApproved", id: request.id})
                    store.dispatch("AccountStore/selectAccount", result.result);
                    window.electron.linkResponse(result);
                });

                window.electron.popupRejected(request.id, (result) => {
                    window.electron.resetTimer();
                    window.electron.linkError({id: request.id, result: {isError: true, method: "rejectedPopup", error: result}});
                });
            });

            window.electron.relink(async (request) => {
                // Relinking with an existing dapp account
                window.electron.resetTimer();
                let shownBeetApp = store.getters['OriginStore/getBeetApp'](request);
                if (!shownBeetApp) {
                    window.electron.relinkError({id: request.id, result: {isError: true, method: "REQUEST_RELINK", error: 'No beetapp'}});
                }

                let linkReq = {appName: request.appName, origin: request.origin, chain: request.chain};

                store.dispatch(
                    "WalletStore/notifyUser",
                    {notify: "request", message: window.t("common.relink_alert", linkReq)}
                );

                let account = store.getters['AccountStore/getSafeAccount'](JSON.parse(JSON.stringify(shownBeetApp)));

                window.electron.createPopup(
                    {
                        request: request,
                        accounts: [account]
                    }
                );

                window.electron.popupApproved(request.id, async (result) => {
                    window.electron.resetTimer();
                    store.dispatch("AccountStore/selectAccount", result.result);
                    window.electron.linkResponse(result);
                });

                window.electron.popupRejected(request.id, (result) => {
                    window.electron.resetTimer();
                    window.electron.relinkError({id: request.id, result: {isError: true, method: "rejectedPopup", error: result}});
                });
            });

            window.electron.addLinkApp(async (data) => {
                // Adding a new dapp linkage to store
                window.electron.resetTimer();
                let app;
                let _error;
                try {
                    app = await store.dispatch('OriginStore/addApp', data);
                } catch (error) {
                    console.log(error)
                    _error = error;
                }
                window.electron.sendLinkAppResponse({app, error: _error})
            });

            window.electron.getLinkApp((data) => {
                // Fetching existing dapp linkage
                window.electron.resetTimer();
                let app;
                let _error;
                try {
                    app = store.getters['OriginStore/getBeetApp'](data)
                } catch (error) {
                    console.log(error);
                    _error = error;
                }

                console.log({about: "getlinkapp", app, error: _error})
                window.electron.sendLinkAppResponse({app, error: _error})
            });

            window.electron.getApiApp((data) => {
                // For checking a dapp's allowed operations
                window.electron.resetTimer();
                let app;
                let _error;
                try {
                    app = store.getters['OriginStore/getBeetApp'](data)
                } catch (error) {
                    console.log(error);
                    _error = error;
                }

                window.electron.sendApiResponse({
                    app: app ? toRaw(app) : null,
                    error: _error
                })
            });
        }

        if (serverOnline.value) {
            listen();
        }
    });

    onMounted(() => {
        if (!store.state.WalletStore.isUnlocked) {
            console.log("logging user out...");
            store.dispatch("WalletStore/logout");
            router.replace("/");
            return;
        }
    });
</script>

<template>
    <div class="bottom p-0">
        <span v-if="compatibleChain">
            <AccountSelect />
            <span>
                <p>
                    {{ t('common.www.label') }}
                </p>
                <span v-if="!proceed">
                    <p>
                        {{ t('common.www.description') }}
                    </p>
                    <ui-button
                        raised
                        style="margin-right:5px; margin-bottom: 5px;"
                        @click="proceed = true"
                    >
                        {{ t('common.www.yes') }}
                    </ui-button>
                    <router-link
                        :to="'/dashboard'"
                        replace
                    >
                        <ui-button
                            raised
                            style="margin-right:5px; margin-bottom: 5px;"
                        >
                            {{ t('common.www.no') }}
                        </ui-button>
                    </router-link>
                </span>
                <span v-else>
                    <p>
                        {{ t('common.www.prompt') }}
                    </p>
                    <ui-card
                        v-shadow="3"
                        outlined
                        style="marginTop: 5px;"
                    >
                        <ui-chips
                            id="input-chip-set"
                            type="input"
                            style="display: flex; justify-content: center;"
                        >
                            <ui-chip
                                v-if="serverOnline && serverOnline.http"
                                icon="thumb_up"
                            >
                                HTTP
                            </ui-chip>
                            <ui-chip
                                v-else
                                icon="thumb_down"
                            >
                                HTTP 
                            </ui-chip>
                        
                            <ui-chip
                                v-if="serverOnline && serverOnline.https"
                                icon="thumb_up"
                            >
                                HTTPS   
                            </ui-chip>
                            <ui-chip
                                v-else
                                icon="thumb_down"
                            >
                                HTTPS   
                            </ui-chip>
                        </ui-chips>
                    </ui-card>
                </span>
            </span>
            <router-link
                :to="'/dashboard'"
                replace
            >
                <ui-button
                    outlined
                    class="step_btn"
                >
                    {{ t('common.www.exit') }}
                </ui-button>
            </router-link>
        </span>
        <span v-else>
            {{ t('common.www.unsupported') }}
        </span>
    </div>
</template>

