<script setup>
    import { ref, computed, onMounted } from 'vue';
    import { useI18n } from 'vue-i18n';

    import AccountSelect from "./account-select";
    import Operations from "./blockchains/operations";
    import store from '../store/index.js';

    const { t } = useI18n({ useScope: 'global' });

    let chosenScope = ref();
    let hasSelectedRows = ref();
    let inProgress = ref(false);

    function goBack() {
        chosenScope.value = null;
        hasSelectedRows.value = null;
    }

    let chain = computed(() => {
        return store.getters['AccountStore/getChain'];
    });

    let settingsRows = computed(() => { // last approved operation rows for this chain
        if (!store.state.WalletStore.isUnlocked) {
            return;
        }

        let rememberedRows = store.getters['SettingsStore/getChainPermissions'](chain.value);
        if (!rememberedRows || !rememberedRows.length) {
            return [];
        }

        return rememberedRows;
    });

    let supportsLocal = ref(false);
    let operationTypes = ref([]);
    onMounted(async () => {
        async function initialize() {
            let blockchainResponse;
            try {
                blockchainResponse = await window.electron.blockchainRequest({
                    methods: ['supportsLocal', 'getOperationTypes'],
                    chain: chain.value,
                    location: 'local'
                });
            } catch (error) {
                console.log({error});
                inProgress.value = false;
                window.electron.notify(t("common.local.promptFailure"));
                return;
            }

            if (!blockchainResponse) {
                console.log("No blockchain response");
                inProgress.value = false;
                window.electron.notify(t("common.local.promptFailure"));
                return;
            }
            
            if (blockchainResponse.supportsLocal) {
                supportsLocal.value = blockchainResponse.supportsLocal;
            }

            if (blockchainResponse.getOperationTypes) {
                operationTypes.value = blockchainResponse.getOperationTypes;
            }
        }

        initialize();
    });

    function setScope(newValue) {
        chosenScope.value = newValue;
        if (newValue === 'AllowAll') {
            hasSelectedRows.value = true;
            store.dispatch(
                "SettingsStore/setChainPermissions",
                {
                    chain: chain,
                    rows: operationTypes.value.map(type => type.id)
                }
            );
        }
    }

    async function onFileUpload(a) {
        inProgress.value = true;

        let account = store.getters['AccountStore/getCurrentSafeAccount']();
        if (!account) {
            console.log('No account selected')
            inProgress.value = false;
            return;
        }

        let blockchainResponse;
        try {
            blockchainResponse = await window.electron.blockchainRequest({
                methods: ['localFileUpload'],
                chain: chain.value,
                filePath: a[0].sourceFile.path,
                settingsRows: settingsRows.value,
            });
        } catch (error) {
            console.log({error});
            inProgress.value = false;
            window.electron.notify(t("common.local.promptFailure"));
            return;
        }

        if (!blockchainResponse) {
            console.log("No blockchain response");
            inProgress.value = false;
            window.electron.notify(t("common.local.promptFailure"));
            return;
        }

        if (blockchainResponse.localFileUpload) {
            const { success } = blockchainResponse.localFileUpload;
            inProgress.value = false;
            window.electron.notify(t("common.local.promptSuccess"));
            console.log({success});
        }
    }
</script>

<template>
    <div
        v-if="settingsRows"
        class="bottom p-0"
    >
        <span v-if="supportsLocal">
            <span>
                <AccountSelect />
                <p
                    v-if="!chosenScope"
                    style="marginBottom:0px;"
                >
                    {{ t('common.local.label') }}
                </p>
                <ui-card
                    v-if="!hasSelectedRows"
                    v-shadow="3"
                    outlined
                    style="marginTop: 5px;"
                >
                    <span v-if="!chosenScope">
                        <p>
                            {{ t('common.chosenScope.title.local') }}
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
                <span v-if="!inProgress">
                    <h3>{{ t('common.local.upload') }}</h3>
                    <ui-file
                        accept="application/json"
                        @change="onFileUpload($event)"
                    />
                </span>
                <span v-else>
                    <ui-spinner active />
                    <h3>{{ t('common.local.progress') }}</h3>
                </span>
            </span>

            <br>
            <ui-button
                v-if="chosenScope && hasSelectedRows"
                style="margin-right:5px"
                icon="arrow_back_ios"
                @click="goBack"
            >
                {{ t('common.local.back') }}
            </ui-button>
            <router-link
                :to="'/dashboard'"
                replace
            >
                <ui-button
                    outlined
                    class="step_btn"
                >
                    {{ t('common.local.exit') }}
                </ui-button>
            </router-link>
        </span>
        <span v-else>
            {{ t('common.local.unsupported') }}
        </span>
    </div>
</template>
