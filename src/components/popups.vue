<script setup>
    import { computed, watchEffect, ref } from "vue";
    import queryString from "query-string";
    import { useI18n } from 'vue-i18n';

    import * as Actions from '../lib/Actions';

    import LinkRequestPopup from "./popups/linkrequestpopup";
    import ReLinkRequestPopup from "./popups/relinkrequestpopup";
    import IdentityRequestPopup from "./popups/identityrequestpopup";
    import SignMessageRequestPopup from "./popups/signedmessagepopup";
    import TransactionRequestPopup from "./popups/transactionrequestpopup";
    import langSelect from "./lang-select.vue";

    const { t } = useI18n({ useScope: 'global' });

    function handleProp(target) {
        let search = window.electron.getLocationSearch();
        if (!search) {
            return '';
        }

        let qs;
        try {
            qs = queryString.parse(search);
        } catch (error) {
            console.log(error);
            return;
        }

        if (!qs[target]) {
            return;
        }

        let qsTarget = qs[target];
        let decoded = decodeURIComponent(qsTarget);
        return decoded;
    }

    let chainOperations = ref([]);
    let types = ref();
    let type = ref();
    let toSend = ref();
    let chain = ref();
    let accountName = ref();
    let target = ref();
    let warning = ref();
    let visualizedAccount = ref();
    let visualizedParams = ref();
    let request = ref();
    let moreRequest = ref();
    let payload = ref();
    let accounts = ref();
    let existingLinks = ref();

    watchEffect(() => {
        const id = handleProp('id');

        window.electron.getPrompt(id); // Requesting the data from the main process
        window.electron.onPrompt(id, async (data) => {
            // Main process responded with prompt data
            window.electron.resetTimer();

            function initialize() {
                return new Promise(async (resolve, reject) => {
                    let requestContents;
                    try {
                        requestContents = await window.electron.blockchainRequest({
                            methods: ["getOperationTypes"],
                            chain: data.chain
                        });
                    } catch (error) {
                        console.log(error);
                        return reject(error);
                    }

                    if (requestContents && requestContents.getOperationTypes) {
                        resolve(requestContents.getOperationTypes);
                    } else {
                        resolve([]);
                    }
                });
            }

            const _initializedTypes = await initialize();
            types.value = _initializedTypes;

            if (_initializedTypes) {
                let thisType = type.value ?? payload.value?.type;
                if (thisType !== Actions.REQUEST_LINK) {
                    chainOperations.value = [];
                } else {
                    let thisChain = chain.value ?? request.value.chain;
                    let thisRequest = request.value ?? payload.value.request;

                    if (_initializedTypes && (!thisRequest.injectables || !thisRequest.injectables.length)) {
                        // All operations are required
                        chainOperations.value = _initializedTypes.map(type => {
                            return {
                                text: !type.id === type.method
                                    ? `${type.id}: ${type.method.replaceAll("_", " ")}`
                                    : type.method.replaceAll("_", " "),
                                tooltip: t(
                                    `operations.injected.${thisChain === "BTS_TEST" ? "BTS" : thisChain}.${type.method}.tooltip`
                                )
                            }
                        });
                    } else {
                        let injectChips = [];
                        for (let i = 0; i < thisRequest.injectables.length; i++) {
                            // Subset of operations are required
                            const currentInjection = thisRequest.injectables[i]; // id
                            let foundCurrent = _initializedTypes
                                ? _initializedTypes.find(type => type.id === currentInjection.id)
                                : null;
                            if (!foundCurrent) {
                                injectChips = []; // invalid op will nullify link request
                                break;
                            } else {
                                injectChips.push({
                                    text: `${foundCurrent.id}: ` + t(`operations.injected.${thisChain}.${foundCurrent.method}`),
                                    tooltip: t(`operations.injected.${thisChain}.${foundCurrent.method}.tooltip`)
                                })
                            }   
                        }
                        if (!injectChips || !injectChips.length) {
                            // Avoid rendering warning
                            console.log('No valid operations found, skipping chain operations');
                            chainOperations.value = null;
                        } else {
                            chainOperations.value = injectChips;
                        }
                    }
                }
            }


            if (data.type) {
                type.value = data.type;
            }
            if (data.toSend) {
                toSend.value = data.toSend;
            }
            if (data.chain) {
                chain.value = data.chain;
            }
            if (data.accountName) {
                accountName.value = data.accountName;
            }
            if (data.target) {
                target.value = data.target;
            }
            if (data.warning) {
                warning.value = data.warning;
            }
            if (data.visualizedAccount) {
                visualizedAccount.value = data.visualizedAccount;
            }
            if (data.visualizedParams) {
                visualizedParams.value = data.visualizedParams;
            }
            if (data.request) {
                request.value = data.request;
                moreRequest.value = JSON.stringify(data.request, undefined, 4);
            }
            if (data.payload) {
                payload.value = JSON.parse(data.payload);
            }
            if (data.accounts && data.request) {
                const parsedAccounts = data.accounts;
                const parsedRequest = data.request;
                const filteredAccounts = parsedAccounts.filter(account => parsedRequest.payload.chain === account.chain);
                accounts.value = filteredAccounts;
            }
            if (data.existingLinks) {
                existingLinks.value = JSON.parse(data.existingLinks);
            }
        });
    })
</script>

<template>
    <div
        v-if="type && type !== '' && request"
        style="overflow-y: auto; width: 750px;"
    >
        <ui-collapse
            with-icon
            ripple
            model-value="{{True}}"
        >
            <template #toggle>
                <div>{{ t('common.popup.preview') }}</div>
            </template>
            <LinkRequestPopup
                v-if="type === Actions.REQUEST_LINK && request && accounts"
                :request="request"
                :accounts="accounts"
                :existing-links="existingLinks"
            />
            <ReLinkRequestPopup
                v-else-if="type === Actions.REQUEST_RELINK && request && accounts"
                :request="request"
                :accounts="accounts"
            />
            <IdentityRequestPopup
                v-else-if="type === Actions.GET_ACCOUNT && request && accounts"
                :request="request"
                :accounts="accounts"
            />
            <SignMessageRequestPopup
                v-else-if="
                    (type === Actions.SIGN_MESSAGE || type === Actions.SIGN_NFT)
                        && request && accounts
                "
                :request="request"
                :accounts="accounts"
            />
            <div
                v-else-if="
                    (type === Actions.REQUEST_SIGNATURE || type === Actions.INJECTED_CALL)
                        && request
                        && visualizedParams
                        && visualizedAccount
                "
                style="overflow-y: auto; padding-right: 25px;"
            >
                <TransactionRequestPopup
                    :request="request"
                    :visualized-params="visualizedParams"
                    :visualized-account="visualizedAccount"
                    :warning="warning"
                />
            </div>
        </ui-collapse>
        <ui-collapse
            v-if="type === Actions.REQUEST_LINK && chainOperations"
            with-icon
            ripple
        >
            <template #toggle>
                <div>{{ t('common.popup.chainOperations') }}</div>
            </template>
            <div style="overflow-y: auto; max-height: 200px;">
                <ui-list :type="2">
                    <ui-item
                        v-for="item in chainOperations"
                        :key="'ui-tooltip-' + chainOperations.indexOf(item)"
                    >
                        <ui-item-text-content>
                            <ui-item-text1>{{ item.text }}</ui-item-text1>
                            <ui-item-text2 style="overflow-wrap:break-word;">
                                {{ item.tooltip }}
                            </ui-item-text2>
                        </ui-item-text-content>
                    </ui-item>
                </ui-list>
            </div>
        </ui-collapse>
        <ui-collapse
            v-if="moreRequest"
            with-icon
            ripple
        >
            <template #toggle>
                <div>{{ t('common.popup.request') }}</div>
            </template>
            <div>
                <ui-textfield
                    v-model="moreRequest"
                    input-type="textarea"
                    fullwidth
                    disabled
                    rows="8"
                />
            </div>
        </ui-collapse>
        <ui-collapse
            v-if="payload"
            with-icon
            ripple
        >
            <template #toggle>
                <div>{{ t('common.popup.payload') }}</div>
            </template>
            <div>
                <ui-textfield
                    v-model="payload"
                    input-type="textarea"
                    fullwidth
                    disabled
                    rows="8"
                />
            </div>
        </ui-collapse>
        <ui-collapse
            with-icon
            ripple
        >
            <template #toggle>
                <div>{{ t('common.abSettings') }}</div>
            </template>
            <langSelect location="prompt" />
        </ui-collapse>
    </div>
    <div v-else>
        Error: Unable to load prompt.
    </div>
</template>
