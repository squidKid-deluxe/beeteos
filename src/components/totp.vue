<script setup>
    import { watchEffect, ref, computed, inject } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { ipcRenderer } from "electron";

    import AccountSelect from "./account-select";
    import Operations from "./blockchains/operations";

    import store from '../store/index';
    import router from '../router/index.js';

    const { t } = useI18n({ useScope: 'global' });
    const emitter = inject('emitter');

    let chain = computed(() => {
        return store.getters['AccountStore/getChain'];
    });

    let settingsRows = computed(() => { // last approved TOTP rows for this chain
        if (!store.state.WalletStore.isUnlocked) {
            return;
        }

        let rememberedRows = store.getters['SettingsStore/getChainPermissions'](chain.value);
        if (!rememberedRows || !rememberedRows.length) {
            return [];
        }

        return rememberedRows;
    });
    
    watchEffect(() => {
        if (chain.value) {
            ipcRenderer.send("blockchainRequest", {
                methods: ["supportsTOTP", "getOperationTypes"],
                location: 'totpInit',
                chain: chain.value
            })
        }
    })

    let compatible = ref(false);
    let operationTypes = ref([]);
    ipcRenderer.on("blockchainResponse:totpInit", (event, data) => {
        const { supportsTOTP, getOperationTypes } = data;
        if (supportsTOTP) {
            compatible.value = supportsTOTP;
        }
        if (getOperationTypes) {
            operationTypes.value = getOperationTypes;
        }
    });

    let selectedRows = ref();
    emitter.on('selectedRows', (data) => {
        selectedRows.value = data;
    })

    let opPermissions = ref();
    function setScope(newValue) {
        opPermissions.value = newValue;
        if (newValue === 'AllowAll') {
            selectedRows.value = true;
            store.dispatch(
                "SettingsStore/setChainPermissions",
                {
                    chain: chain.value,
                    rows: operationTypes.value.map(type => type.id)
                }
            );
        }
    }
    emitter.on('exitOperations', () => {
        opPermissions.value = null;
        selectedRows.value = null;
    })

    function goBack() {
        opPermissions.value = null;
        selectedRows.value = null;
        //
        timestamp.value = null;
        newCodeRequested.value = null;
        timeLimit.value = null;
        progress.value = 0;
    }

    let timestamp = ref();
    let newCodeRequested = ref(false);
    function requestCode() {
        newCodeRequested.value = true;
        timestamp.value = new Date();
    }
 
    let timeLimit = ref();
    function setTime(time) {
        timeLimit.value = time;
    }

    let progress = ref(0);
    watchEffect(() => {
        setInterval(
            () => {
                if (!timestamp.value) {
                    return;
                } else if (progress.value >= timeLimit.value) {
                    progress.value = 0;
                    newCodeRequested.value = false;
                    timestamp.value = null;
                } else {
                    let currentTimestamp = new Date();
                    var seconds = (currentTimestamp.getTime() - timestamp.value.getTime()) / 1000;
                    progress.value = seconds;
                }
            },
            1000
        );
    });

    let currentCode = ref();
    let copyContents = ref();
    watchEffect(() => {
        if (timestamp && timestamp.value) {
            ipcRenderer.send("blockchainRequest", {
                methods: ["totpCode"],
                chain: chain.value,
                location: "totpCode",
                timestamp: timestamp.value
            });
        }
    });

    ipcRenderer.on("blockchainResponse:totpCode", (event, args) => {
        const {code} = args;
        if (!code) {
            console.log("No code generated");
            return;
        }
        currentCode.value = code;
        copyContents.value = {text: code, success: () => {console.log('copied code')}};
    })

    let deepLinkInProgress = ref(false);
    ipcRenderer.on('deeplink', async (event, args) => {
        if (!store.state.WalletStore.isUnlocked || router.currentRoute.value.path != "/totp") {
            console.log("Wallet must be unlocked for deeplinks to work.");
            ipcRenderer.send("notify", t("common.totp.promptFailure"));
            return;
        }

        let account = store.getters['AccountStore/getCurrentSafeAccount']();
        if (!account || !currentCode.value) {
            console.log('Insufficient state to proceed')
            return;
        }

        deepLinkInProgress.value = true;
        ipcRenderer.send(
            "blockchainRequest",
            {
                methods: ["totpDeeplink"],
                chain: chain.value,
                location: "totpDeeplink",
                currentCode: currentCode.value,
                settingsRows: settingsRows.value,
                requestContent: args.request
            }
        );
    });

    ipcRenderer.on('blockchainResponse:totpDeeplink', (event, args) => {
        const { totpDeeplink } = args;
        if (totpDeeplink) {
            console.log({totpDeeplink})
        }
        deepLinkInProgress.value = false;
    });

    ipcRenderer.on('blockchainResponse:totpDeeplink:error', (event, args) => {
        deepLinkInProgress.value = false;
        ipcRenderer.send("notify", t("common.totp.promptFailure"));
    });

    ipcRenderer.on('blockchainResponse:totpDeeplink:fail', (event, args) => {
        deepLinkInProgress.value = false;
        ipcRenderer.send("notify", t("common.totp.failed"));
    });
</script>

<template>
    <div
        v-if="settingsRows"
        class="bottom p-0"
    >
        <span v-if="compatible">
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
                    {{ t('common.totp.label') }}
                </p>
                <ui-card
                    v-shadow="3"
                    outlined
                    style="marginTop: 5px;"
                >
                    <span v-if="!opPermissions">
                        <p>
                            {{ t('common.opPermissions.title.totp') }}
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
                                v-if="settingsRows && settingsRows.length && newCodeRequested"
                                icon="access_time"
                            >
                                {{ t('common.totp.time') }}: {{ timeLimit - progress.toFixed(0) }}s
                            </ui-chip>
                        </ui-chips>
                        <span
                            v-if="!newCodeRequested && settingsRows && settingsRows.length > 0 && !timeLimit"
                            style="padding-left: 20px;"
                        >
                            <ui-button
                                raised
                                style="margin-right:10px; margin-bottom: 10px;"
                                @click="setTime(60)"
                            >
                                60s
                            </ui-button>
                            <ui-button
                                raised
                                style="margin-right:10px; margin-bottom: 10px;"
                                @click="setTime(180)"
                            >
                                3m
                            </ui-button>
                            <ui-button
                                raised
                                style="margin-bottom: 10px;"
                                @click="setTime(600)"
                            >
                                10m
                            </ui-button>
                        </span>
                        <span>
                            <ui-button
                                v-if="!newCodeRequested && settingsRows && settingsRows.length > 0 && timeLimit"
                                icon="generating_tokens"
                                raised
                                style="margin-left: 30px; margin-right:5px; margin-bottom: 10px;"
                                @click="requestCode"
                            >
                                {{ t('common.totp.request') }}
                            </ui-button>
                        </span>
                        <ui-textfield
                            v-if="currentCode && newCodeRequested"
                            v-model="currentCode"
                            style="margin:5px;"
                            outlined
                            :attrs="{ readonly: true }"
                        >
                            <template #after>
                                <ui-textfield-icon v-copy="copyContents">content_copy</ui-textfield-icon>
                            </template>
                        </ui-textfield>
                        <ui-alert
                            v-if="currentCode && newCodeRequested"
                            style="margin:10px;"
                            state="warning"
                            closable
                        >
                            {{ t('common.totp.warning') }}
                        </ui-alert>
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