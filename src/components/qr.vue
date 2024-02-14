<script setup>
    import { ref, computed, watchEffect } from 'vue';
    import { useI18n } from 'vue-i18n';

    import AccountSelect from "./account-select";
    import Operations from "./blockchains/operations";
    import QRDrag from "./qr/Drag";
    import QRScan from "./qr/Scan";
    import QRUpload from "./qr/Upload";

    import store from '../store/index.js';

    const { t } = useI18n({ useScope: 'global' });

    let chosenScope = ref();
    let qrInProgress = ref(false);
    let qrChoice = ref();
    let hasSelectedRows = ref();

    function goBack() {
        chosenScope.value = null;
        hasSelectedRows.value = null;
    }

    function undoQRChoice () {
        qrChoice.value = null;
    }
 
    function setChoice(choice) {
        qrChoice.value = choice;
    }

    const chain = computed(() => {
        return store.getters['AccountStore/getChain'];
    });

    emitter.on('detectedQR', async (data) => {
        qrInProgress.value = true;

        let blockchainResponse;
        try {
            blockchainResponse = await window.electron.blockchainRequest({
                methods: ["processQR"],
                chain: chain.value,
                qrChoice: qrChoice.value,
                qrData: data,
                settingsRows: settingsRows.value,
                location: 'qrData'
            });
        } catch (error) {
            console.log({error});
            window.electron.notify(t("common.qr.promptFailure"));
            qrInProgress.value = false;
            return;
        }

        if (blockchainResponse) {
            console.log({ blockchainResponse });
            window.electron.notify(t("common.qr.prompt_success"));
        }
        qrInProgress.value = false;
    });

    let settingsRows = computed(() => { // last approved operation rows for this chain
        if (!store.state.WalletStore.isUnlocked || !chain.value) {
            return;
        }

        let rememberedRows = store.getters['SettingsStore/getChainPermissions'](chain.value);
        if (!rememberedRows || !rememberedRows.length) {
            return [];
        }

        return rememberedRows;
    });

    let compatible = ref(false);
    let operationTypes = ref([]);
    watchEffect(() => {
        async function initialize() {
            let blockchainResponse;
            try {
                blockchainResponse = await window.electron.blockchainRequest({
                    methods: ["supportsQR", "getOperationTypes"],
                    chain: chain.value
                });
            } catch (error) {
                console.log({error});
                return;
            }

            if (!blockchainResponse) {
                return;
            }

            const { supportsQR, getOperationTypes } = blockchainResponse;
            if (supportsQR) {
                compatible.value = supportsQR;
            }
            if (getOperationTypes) {
                operationTypes.value = getOperationTypes;
            }
        }
        
        if (chain.value) {
            initialize();
        }
    });

    function setScope(newValue) {
        chosenScope.value = newValue;
        if (newValue === 'AllowAll') {
            hasSelectedRows.value = true;
            store.dispatch(
                "SettingsStore/setChainPermissions",
                {
                    chain: chain.value,
                    rows: operationTypes.value.map(type => type.id)
                }
            );
        }
    }
</script>

<template>
    <div
        v-if="settingsRows"
        class="bottom p-0"
    >
        <span v-if="compatible">
            <span v-if="qrInProgress">
                <p>
                    {{ t('common.qr.progress') }}
                </p>
                <ui-spinner active />
            </span>
            <span v-else>
                <AccountSelect />
                <p
                    v-if="!chosenScope"
                    style="marginBottom:0px;"
                >
                    {{ t('common.qr.label') }}
                </p>
                <ui-card
                    v-if="!hasSelectedRows"
                    v-shadow="3"
                    outlined
                    style="marginTop: 5px;"
                >
                    <span v-if="!chosenScope">
                        <p>
                            {{ t('common.chosenScope.title.qr') }}
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
                    <span v-else-if="chosenScope == 'Configure' && !hasSelectedRows">
                        <Operations
                            :ops="operationTypes"
                            :stored="settingsRows"
                            :chain="chain"
                            @selected="() => hasSelectedRows.value = true"
                            @exit="() => {
                                chosenScope.value = null;
                                hasSelectedRows.value = null;
                            }"
                        />
                    </span>
                </ui-card>
            </span>

            
            <span v-if="chosenScope && settingsRows && hasSelectedRows">
                <span v-if="qrChoice && qrChoice === 'Scan'">
                    <QRScan />
                    <br>
                    <ui-button @click="undoQRChoice()">
                        {{ t('common.qr.back') }}
                    </ui-button>
                </span>
                <span v-else-if="qrChoice && qrChoice === 'Drag'">
                    <QRDrag />
                    <br>
                    <ui-button @click="undoQRChoice()">
                        {{ t('common.qr.back') }}
                    </ui-button>
                </span>
                <span v-else-if="qrChoice && qrChoice === 'Upload'">
                    <QRUpload />
                    <br>
                    <ui-button @click="undoQRChoice()">
                        {{ t('common.qr.back') }}
                    </ui-button>
                </span>
                <span v-else>
                    <p style="marginBottom:0px;">
                        {{ t('common.qr.main.title') }}
                    </p>
                    <br>
                    <ui-button
                        raised
                        style="margin-bottom: 10px;"
                        @click="setChoice('Drag')"
                    >
                        {{ t('common.qr.main.drag') }}
                    </ui-button>
                    <br>
                    <ui-button
                        raised
                        style="margin-bottom: 10px;"
                        @click="setChoice('Scan')"
                    >
                        {{ t('common.qr.main.scan') }}
                    </ui-button>
                    <br>
                    <ui-button
                        raised
                        style="margin-bottom: 10px;"
                        @click="setChoice('Upload')"
                    >
                        {{ t('common.qr.main.upload') }}
                    </ui-button>
                </span>
            </span>

            <br>
            <ui-button
                v-if="chosenScope && hasSelectedRows"
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
                    {{ t('common.qr.exit') }}
                </ui-button>
            </router-link>
        </span>
        <span v-else>
            {{ t('common.qr.unsupported') }}
        </span>
    </div>
</template>
