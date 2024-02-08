<script setup>
    import { ref, computed, inject, watchEffect } from 'vue';
    import { useI18n } from 'vue-i18n';

    import AccountSelect from "./account-select";
    import Operations from "./blockchains/operations";
    
    import store from '../store/index.js';
    import router from '../router/index.js';

    const { t } = useI18n({ useScope: 'global' });
    const emitter = inject('emitter');

    let selectedRows = ref();
    let opPermissions = ref();
    emitter.on('selectedRows', (data) => {
        selectedRows.value = data;
    });

    emitter.on('exitOperations', () => {
        opPermissions.value = null;
        selectedRows.value = null;
    });

    function goBack() {
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

    let compatibleChain = ref(false);
    let chainTypes = ref([]);
    watchEffect(() => {
        async function initialize() {
            let blockchainRequest;
            try {
                blockchainRequest = window.electron.blockchainRequest(
                    { 
                        methods: ['supportsTOTP', 'getOperationTypes'],
                        chain: chain.value
                    }
                );
            } catch (error) {
                console.error(error);
            }

            if (blockchainRequest) {
                const { supportsTOTP, getOperationTypes } = blockchainRequest;
                if (supportsTOTP) {
                    compatibleChain.value = supportsTOTP;
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

    let deepLinkInProgress = ref(false);
    /*
    ipcRenderer.on('rawdeeplink', async (event, args) => {
        if (!store.state.WalletStore.isUnlocked || router.currentRoute.value.path != "/raw-link") {
            console.log("Wallet must be unlocked for raw deeplinks to work.");
            window.electron.notify(t("common.raw.promptFailure"));
            return;
        }

        let account = store.getters['AccountStore/getCurrentSafeAccount']();
        if (!account) {
            console.log('No account')
            deepLinkInProgress.value = false;
            return;
        }

        deepLinkInProgress.value = true;

        let blockchainRequest;
        try {
            blockchainRequest = window.electron.blockchainRequest(
                { 
                    methods: ['getRawLink'],
                    chain: account.chain,
                    requestBody: args.request
                }
            );
        } catch (error) {
            console.error(error);
            deepLinkInProgress.value = false;
            window.electron.notify(t("common.raw.promptFailure"));
            return;
        }

        if (blockchainRequest) {
            const { success } = blockchainRequest;
            if (success) {
                console.log({success})
            }
        }
        
        deepLinkInProgress.value = false;
    });
    */
</script>

<template>
    <div
        v-if="settingsRows"
        class="bottom p-0"
    >
        <span v-if="compatibleChain">
            <AccountSelect />
            <span v-if="deepLinkInProgress">
                <p style="marginBottom:0px;">
                    {{ t('common.totp.inProgress') }}
                </p>
                <ui-card
                    v-shadow="3"
                    outlined
                    style="marginTop: 5px;"
                >
                    <br>
                    <ui-progress indeterminate />
                    <br>
                </ui-card>
            </span>
            <span v-else>
                <p style="marginBottom:0px;">
                    {{ t('common.raw.label') }}
                </p>
                <ui-card
                    v-shadow="3"
                    outlined
                    style="marginTop: 5px;"
                >
                    <span v-if="!opPermissions">
                        <p>
                            {{ t('common.opPermissions.title.rawLink') }}
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
                                {{ settingsRows ? settingsRows.length : 0 }} {{ t('common.totp.chosen') }}
                            </ui-chip>
                            <ui-chip
                                icon="thumb_up"
                            >
                                Ready for raw links!
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
                >
                    {{ t('common.totp.exit') }}
                </ui-button>
            </router-link>
        </span>
        <span v-else>
            {{ t('common.totp.unsupported') }}
        </span>
    </div>
</template>
