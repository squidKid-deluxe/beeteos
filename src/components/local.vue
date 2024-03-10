<script setup>
    import { ref, computed, onMounted, toRaw } from 'vue';
    import { useI18n } from 'vue-i18n';

    import AccountSelect from "./account-select";
    import Operations from "./blockchains/operations";
    
    import store from '../store/index.js';
    import router from '../router/index.js';

    const { t } = useI18n({ useScope: 'global' });

    let chosenScope = ref();
    let selectedRows = ref();
    let inProgress = ref(false);

    function goBack() {
        window.electron.resetTimer();
        chosenScope.value = null;
        selectedRows.value = null;
    }

    let chain = computed(() => {
        return store.getters['AccountStore/getChain'];
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

    async function onFileUpload(a) {
        window.electron.resetTimer();
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
                allowedOperations: toRaw(selectedRows.value)
            });
        } catch (error) {
            console.log({error});
            inProgress.value = false;
            window.electron.notify(t("common.local.promptFailure"));
            return;
        }

        if (!blockchainResponse || !blockchainResponse.localFileUpload) {
            console.log("No blockchain response");
            inProgress.value = false;
            window.electron.notify(t("common.local.promptFailure"));
            return;
        }

        inProgress.value = false;
        window.electron.notify(t("common.local.promptSuccess"));
    }

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
        <span v-if="supportsLocal">
            <span>
                <AccountSelect />
                <p
                    v-if="!chosenScope"
                    style="marginBottom:0px;"
                >
                    {{ t('common.local.label') }}
                </p>
                <p
                    v-if="!chosenScope"
                    style="marginBottom:0px;"
                >
                    {{ t('common.local.desc') }}
                </p>

                <ui-card
                    v-if="!selectedRows"
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
                </ui-card>
            </span>

            
            <span v-if="chosenScope && selectedRows">
                <span v-if="!inProgress">
                    <p>{{ t('common.local.label') }}</p>

                    <p>{{ t('common.local.desc') }}</p>

                    <h4>{{ t('common.local.upload') }}</h4>
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
                v-if="chosenScope && selectedRows"
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
