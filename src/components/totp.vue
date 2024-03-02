<script setup>
    import { watchEffect, ref, computed, onMounted } from 'vue';
    import { useI18n } from 'vue-i18n';

    import AccountSelect from "./account-select";
    import Operations from "./blockchains/operations";

    import store from '../store/index.js';
    import router from '../router/index.js';

    const { t } = useI18n({ useScope: 'global' });

    let chain = computed(() => {
        return store.getters['AccountStore/getChain'];
    });
    
    let compatible = ref(false);
    let operationTypes = ref([]);
    watchEffect(() => {
        async function initialize() {
            let blockchainResponse;
            try {
                blockchainResponse = await window.electron.blockchainRequest({
                    methods: ["supportsTOTP", "getOperationTypes"],
                    chain: chain.value
                });
            } catch (error) {
                console.log(error);
                return;
            }

            if (!blockchainResponse) {
                console.log("No blockchain response");
                return;
            }

            const { supportsTOTP, getOperationTypes } = blockchainResponse;
            if (supportsTOTP) {
                compatible.value = supportsTOTP;
            }
            if (getOperationTypes) {
                operationTypes.value = getOperationTypes;
            }
        }

        if (chain.value) {
            initialize();
        }
    })

    let selectedRows = ref();
    let chosenScope = ref();
    function setScope(newValue) {
        window.electron.resetTimer();
        chosenScope.value = newValue;
        if (newValue === 'AllowAll') {
            const _ids = operationTypes.value.map(type => type.id);
            selectedRows.value = _ids;
            store.dispatch(
                "SettingsStore/setChainPermissions",
                {
                    chain: chain.value,
                    rows: _ids
                }
            );
        }
    }

    function goBack() {
        window.electron.resetTimer();
        chosenScope.value = null;
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
        window.electron.resetTimer();
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
        async function getNewCode() {
            window.electron.resetTimer();
            let blockchainResponse;
            try {
                blockchainResponse = await window.electron.blockchainRequest({
                    methods: ["totpCode"],
                    chain: chain.value,
                    timestamp: timestamp.value
                });
            } catch (error) {
                console.log(error);
                return;
            }

            if (!blockchainResponse || !blockchainResponse.code) {
                console.log("No blockchain response");
                return;
            }

            const { code } = blockchainResponse;
            currentCode.value = code;
            copyContents.value = {text: code, success: () => {console.log('copied code')}};
        }

        if (timestamp && timestamp.value) {
            getNewCode();
        }
    });

    let deepLinkInProgress = ref(false);
    window.electron.onDeepLink(async (args) => {
        if (!store.state.WalletStore.isUnlocked || router.currentRoute.value.path != "/totp") {
            console.log("Wallet must be unlocked for deeplinks to work.");
            window.electron.notify(t("common.totp.promptFailure"));
            return;
        }

        let account = store.getters['AccountStore/getCurrentSafeAccount']();
        if (!account || !currentCode.value) {
            console.log('Insufficient state to proceed')
            window.electron.notify(t("common.totp.promptFailure"));
            return;
        }

        window.electron.resetTimer();
        deepLinkInProgress.value = true;
        let blockchainResponse;
        try {
            blockchainResponse = await window.electron.blockchainRequest({
                methods: ["totpDeeplink"],
                chain: chain.value,
                currentCode: currentCode.value,
                allowedOperations: selectedRows.value,
                requestContent: args.request
            });
        } catch (error) {
            console.log(error);
            deepLinkInProgress.value = false;
            window.electron.notify(t("common.totp.failed"));
            return;
        }

        if (!blockchainResponse || !blockchainResponse.totpDeeplink) {
            console.log("No blockchain response");
            deepLinkInProgress.value = false;
            window.electron.notify(t("common.totp.failed"));
            return;
        }

        const { totpDeeplink } = blockchainResponse;
        if (totpDeeplink) {
            console.log({totpDeeplink})
        }
        deepLinkInProgress.value = false;
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
                <p style="marginBottom:0px;">
                    {{ t('common.totp.desc') }}
                </p>
                <ui-card
                    v-shadow="3"
                    outlined
                    style="marginTop: 5px;"
                >
                    <span v-if="!chosenScope">
                        <p>
                            {{ t('common.chosenScope.title.totp') }}
                        </p>
                        <ui-button
                            raised
                            style="margin-right:5px; margin-bottom: 5px;"
                            @click="setScope('Configure')"
                        >
                            {{ t('common.chosenScope.yes') }}
                        </ui-button>
                        <ui-button
                            raised
                            style="margin-right:5px; margin-bottom: 5px;"
                            @click="setScope('AllowAll')"
                        >
                            {{ t('common.chosenScope.no') }}
                        </ui-button>
                    </span>
                    <span v-else-if="chosenScope == 'Configure' && !selectedRows">
                        <Operations
                            :ops="operationTypes"
                            :chain="chain"
                            @selected="(ops) => selectedRows = ops"
                            @exit="() => {
                                chosenScope = null;
                                selectedRows = null;
                            }"
                        />
                    </span>

                    <span v-if="chosenScope && selectedRows">
                        <ui-chips
                            id="input-chip-set"
                            type="input"
                        >
                            <ui-chip
                                icon="security"
                                style="margin-left:30px;"
                            >
                                {{ selectedRows ? selectedRows.length : 0 }} {{ t('common.totp.chosen') }}
                            </ui-chip>
                            <ui-chip
                                v-if="selectedRows && selectedRows.length && newCodeRequested"
                                icon="access_time"
                            >
                                {{ t('common.totp.time') }}: {{ timeLimit - progress.toFixed(0) }}s
                            </ui-chip>
                        </ui-chips>
                        <span
                            v-if="!newCodeRequested && selectedRows && selectedRows.length > 0 && !timeLimit"
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
                                v-if="!newCodeRequested && selectedRows && selectedRows.length > 0 && timeLimit"
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
                v-if="chosenScope && selectedRows"
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