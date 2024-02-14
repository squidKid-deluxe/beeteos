<script setup>
    import { ref, computed, inject, watchEffect } from 'vue';
    import { useI18n } from 'vue-i18n';

    import AccountSelect from "./account-select";
    
    import store from '../store/index.js';
    import router from '../router/index.js';
    import BeetDB from '../lib/BeetDB.js';

    const { t } = useI18n({ useScope: 'global' });
    const emitter = inject('emitter');
    
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
                        if (res.length == 0) {
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

        if (compatibleChain.value && proceed.value === true) {
            launchServer();
        }
    });

    watchEffect(async () => {
        async function listen() {            
            window.electron.addLinkApp(async (data) => {
                let app;
                let _error;
                try {
                    app = await store.dispatch('OriginStore/addApp', data);
                } catch (error) {
                    console.log(error)
                    _error = error;
                }

                window.electron.sendLinkResponse({app, error: _error})
            });
            window.electron.getLinkApp((data) => {
                let app;
                let _error;
                try {
                    app = store.getters['OriginStore/getBeetApp'](data)
                } catch (error) {
                    console.log(error);
                    _error = error;
                }

                window.electron.sendLinkResponse({app, error: _error})
            });
            
            window.electron.getAuthApp((data) => {
                let app;
                let _error;
                try {
                    app = store.getters['OriginStore/getBeetApp'](data)
                } catch (error) {
                    console.log(error);
                    _error = error;
                }

                window.electron.sendAuthResponse({app, error: _error})
            });

            window.electron.newRequest((data) => { // BeetServer.respondAPI
                store.dispatch('OriginStore/newRequest', data);
            });
        }

        if (serverOnline.value) {
            listen();
        }
    });

    function goBack() {
        window.electron.closeServer();
    }
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
                            @click="goBack"
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
                    @click="goBack"
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

