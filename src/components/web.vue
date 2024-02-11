<script setup>
    import { ref, computed, inject, watchEffect } from 'vue';
    import { useI18n } from 'vue-i18n';

    import AccountSelect from "./account-select";
    import Operations from "./blockchains/operations";
    
    import store from '../store/index.js';
    import router from '../router/index.js';
    import BeetDB from '../lib/BeetDB.js';

    const { t } = useI18n({ useScope: 'global' });
    const emitter = inject('emitter');
    
    let serverOnline = ref(false);
    let selectedRows = ref();
    let opPermissions = ref();
    emitter.on('selectedRows', (data) => {
        selectedRows.value = data;
    });

    emitter.on('exitOperations', () => {
        window.electron.closeServer();
        serverOnline.value = false;
        opPermissions.value = null;
        selectedRows.value = null;
    });

    function goBack() {
        window.electron.closeServer();
        serverOnline.value = false;
        opPermissions.value = null;
        selectedRows.value = null;
    }

    function setScope(newValue) {
        opPermissions.value = newValue;
        if (newValue === 'AllowAll') {
            selectedRows.value = true;
            store.dispatch(
                "SettingsStore/setChainPermissions",
                {
                    chain: chain.value,
                    rows: chainTypes.value.map(type => type.id)
                }
            );
        }
    }

    let chain = computed(() => {
        return store.getters['AccountStore/getChain'];
    });

    let settingsRows = computed(() => { // last approved TOTP rows for this chain
        if (!store.state.WalletStore.isUnlocked || !chain.value) {
            return;
        }

        let rememberedRows = store.getters['SettingsStore/getChainPermissions'](chain.value);
        if (!rememberedRows || !rememberedRows.length) {
            return [];
        }

        return rememberedRows;
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
    let chainTypes = ref([]);
    watchEffect(() => {
        async function initialize() {
            let blockchainRequest;
            try {
                blockchainRequest = await window.electron.blockchainRequest(
                    { 
                        methods: ['supportsWeb', 'getOperationTypes'],
                        chain: chain.value
                    }
                );
            } catch (error) {
                console.error(error);
            }

            if (blockchainRequest) {
                const { supportsWeb, getOperationTypes } = blockchainRequest;
                if (supportsWeb) {
                    compatibleChain.value = true;
                }

                if (getOperationTypes) {
                    chainTypes.value = getOperationTypes;
                }
            }
        }
        if (chain.value) {
            initialize();
        }
    });

    watchEffect(() => {
        async function launchServer() {
            if (selectedRows.value) {     
                if (
                    !store.state.WalletStore.isUnlocked ||
                    router.currentRoute.value.path !== "/www"
                ) {
                    console.log("Wallet must be unlocked for web requests to work.");
                    return;
                }

                let launchedServers;
                try {
                    launchedServers = sslCert.value
                        ? await window.electron.launchServer({cert: sslCert.value.cert, key: sslCert.value.key})
                        : await window.electron.launchServer({cert: null, key: null});
                } catch (error) {
                    console.error(error);
                }

                if (launchedServers) {
                    serverOnline.value = true;
                    console.log({launchedServers});
                    return;
                }
                serverOnline.value = false;
            }
        }
        if (selectedRows.value) {
            launchServer();
        }
    });
</script>

<template>
    <div
        v-if="settingsRows"
        class="bottom p-0"
    >
        <span v-if="compatibleChain">
            <AccountSelect />
            <span>
                <p>
                    {{ t('common.www.label') }}
                </p>
                <p v-if="!selectedRows">
                    {{ t('common.www.description') }}
                </p>
                <ui-card
                    v-shadow="3"
                    outlined
                    style="marginTop: 5px;"
                >
                    <span v-if="!opPermissions">
                        <p>
                            {{ t('common.opPermissions.title.www') }}
                        </p>
                        <ui-button
                            raised
                            style="margin-right:5px; margin-bottom: 5px;"
                            @click="setScope('Configure')"
                        >
                            {{ t('common.opPermissions.yes') }}
                        </ui-button>
                        <ui-button
                            raised
                            style="margin-right:5px; margin-bottom: 5px;"
                            @click="setScope('AllowAll')"
                        >
                            {{ t('common.opPermissions.no') }}
                        </ui-button>
                    </span>
                    <span v-else-if="opPermissions == 'Configure' && !selectedRows">
                        <Operations />
                    </span>

                    <span v-if="opPermissions && settingsRows && selectedRows">
                        <ui-chips
                            id="input-chip-set"
                            type="input"
                        >
                            <ui-chip
                                icon="security"
                                style="margin-left:30px;"
                            >
                                {{ settingsRows ? settingsRows.length : 0 }} {{ t('common.www.chosen') }}
                            </ui-chip>
                            <ui-chip
                                icon="thumb_up"
                            >
                                {{ serverOnline ? t('common.www.ready') : t('common.www.loading') }}
                            </ui-chip>
                        </ui-chips>
                    </span>
                </ui-card>
            </span>
            <ui-button
                v-if="opPermissions && selectedRows"
                style="margin-right:5px"
                icon="arrow_back_ios"
                @click="goBack"
            >
                {{ t('common.qr.back') }}
            </ui-button>
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

