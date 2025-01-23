<script setup>
import { ref, watchEffect, watch } from "vue";
import queryString from "query-string";
import { useI18n } from "vue-i18n";

import langSelect from "./lang-select.vue";

const { t } = useI18n({ useScope: "global" });

function handleProp(target) {
    let search = window.electron.getLocationSearch();
    if (!search) {
        return "";
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

const visualizedParams = ref();
const request = ref();
const moreRequest = ref();
const result = ref();
const chain = ref();
const moreResult = ref();
const notifyTXT = ref();

let openOPReq = ref(false);
let openOPRes = ref(false);
let openOpDetails = ref(false);
let page = ref(1);

const payload = ref();
const accounts = ref();

let jsonData = ref("");
let resultData = ref("");
let resultID = ref("");
let resultBlockNum = ref(1);
let resultTrxNum = ref(1);
let resultExpiration = ref("");
let resultSignatures = ref("");

watchEffect(() => {
    const id = handleProp("id");

    window.electron.getReceipt(id);
    window.electron.onReceipt(id, (data) => {
        if (data.receipt) {
            visualizedParams.value = JSON.parse(data.receipt.visualizedParams);
        }
        console.log({
            vp: JSON.parse(data.receipt.visualizedParams),
            result: data.result,
        });
        if (data.request) {
            request.value = data.request;
            chain.value = data.request.payload.chain;
            moreRequest.value = JSON.stringify(data.request, undefined, 4);
        }
        if (data.result) {
            moreResult.value = JSON.stringify(data.result, undefined, 4);

            result.value = data.result;

            if (["EOS", "TLOS", "BEOS"].includes(data.request.payload.chain)) {
                // EOS based
                resultID.value = data.result.transaction_id;
                resultBlockNum.value = data.result.processed.block_num;
                resultTrxNum.value = 0;
            } else {
                // BTS based
                resultID.value = data.result[0].id;
                resultBlockNum.value = data.result[0].block_num;
                resultTrxNum.value = data.result[0].trx_num;
                resultExpiration.value = data.result[0].trx.expiration;
                resultSignatures.value = data.result[0].trx.signatures;
            }
        }
        if (data.payload) {
            payload.value = JSON.parse(data.payload);
        }
        if (data.accounts && data.request) {
            const parsedAccounts = JSON.parse(data.accounts);
            const parsedRequest = JSON.parse(data.request);
            const filteredAccounts = parsedAccounts.filter(
                (account) => parsedRequest.payload.chain === account.chain
            );
            accounts.value = filteredAccounts;
        }
        if (data.notifyTXT) {
            notifyTXT.value = data.notifyTXT;
        }
    });
});

watch(
    [page, visualizedParams, result],
    ([newPage, newVisualizedParams, newResult]) => {
        const currentPageValue = newPage > 0 ? newPage - 1 : 0;

        if (newVisualizedParams && newVisualizedParams.length) {
            jsonData.value = JSON.stringify(
                newVisualizedParams[currentPageValue].op,
                undefined,
                4
            );
        }
        if (["EOS", "TLOS", "BEOS"].includes(chain.value)) {
            // EOS based
            if (newResult) {
                resultData.value = JSON.stringify(
                    newResult.processed,
                    undefined,
                    4
                );
            }
        } else {
            if (newResult && newResult.length) {
                resultData.value = JSON.stringify(
                    newResult[0].trx.operation_results[currentPageValue],
                    undefined,
                    4
                );
            }
        }
    },
    { immediate: true }
);

let openMoreRequest = ref(false);
let openResult = ref(false);

async function copyToClipboard(_data) {
    try {
        await navigator.clipboard.writeText(_data);
    } catch (err) {
        console.error("Failed to copy: ", err);
    }
}
</script>

<template>
    <div style="overflow-y: auto; width: 750px">
        <ui-collapse with-icon ripple model-value="{{True}}">
            <template #toggle>
                <div>{{ t("common.popup.evaluate") }}</div>
            </template>
            <div
                style="
                    overflow-y: auto;
                    padding-right: 25px;
                    padding-left: 5px;
                    padding-bottom: 15px;
                "
            >
                <div>
                    {{ notifyTXT }}
                </div>

                <div
                    v-if="!!visualizedParams"
                    class="text-left custom-content"
                    style="margintop: 10px"
                >
                    <ui-card no-hover>
                        <ui-card-content>
                            <ui-card-text>
                                <div
                                    v-if="visualizedParams.length > 1"
                                    :class="$tt('subtitle1')"
                                >
                                    <b>{{
                                        t(
                                            visualizedParams[
                                                page > 0 ? page - 1 : 0
                                            ].title
                                        )
                                    }}</b>
                                    ({{ page }}/{{ visualizedParams.length }})
                                </div>
                                <div v-else :class="$tt('subtitle1')">
                                    <b>{{
                                        t(
                                            visualizedParams[
                                                page > 0 ? page - 1 : 0
                                            ].title
                                        )
                                    }}</b>
                                </div>
                                <div style="margin-bottom: 5px">
                                    {{
                                        t(
                                            `operations.injected.${
                                                chain === "BTS_TEST"
                                                    ? "BTS"
                                                    : chain
                                            }.${
                                                visualizedParams[
                                                    page > 0 ? page - 1 : 0
                                                ].method
                                            }.headers.result`
                                        )
                                    }}
                                </div>
                                <div
                                    v-for="row in visualizedParams[
                                        page > 0 ? page - 1 : 0
                                    ].rows"
                                    :key="row.key"
                                    :class="$tt('subtitle2')"
                                >
                                    {{
                                        t(
                                            `operations.injected.${
                                                chain === "BTS_TEST"
                                                    ? "BTS"
                                                    : chain
                                            }.${
                                                visualizedParams[
                                                    page > 0 ? page - 1 : 0
                                                ].method
                                            }.rows.${row.key}`,
                                            row.params
                                        )
                                    }}
                                </div>
                            </ui-card-text>
                        </ui-card-content>
                        <ui-card-actions>
                            <ui-card-buttons>
                                <ui-button outlined @click="openOPReq = true">
                                    {{ t("common.popup.request") }}
                                </ui-button>
                                <ui-button
                                    outlined
                                    style="margin-left: 25px"
                                    @click="openOPRes = true"
                                >
                                    {{ t("common.popup.result") }}
                                </ui-button>
                                <ui-button
                                    outlined
                                    style="margin-left: 25px"
                                    @click="openOpDetails = true"
                                >
                                    {{ t("common.popup.details") }}
                                </ui-button>
                            </ui-card-buttons>
                            <ui-card-icons />
                        </ui-card-actions>
                    </ui-card>
                    <ui-pagination
                        v-if="visualizedParams.length > 1"
                        v-model="page"
                        :total="visualizedParams.length"
                        mini
                        show-total
                        :page-size="[1]"
                        position="center"
                    />
                </div>
            </div>
        </ui-collapse>
        <ui-collapse v-if="result" with-icon ripple>
            <template #toggle>
                <div>{{ t("common.popup.result") }}</div>
            </template>
            <div>
                <ui-button outlined @click="openResult = true">
                    {{ t("common.popup.result") }}
                </ui-button>
            </div>
        </ui-collapse>
        <ui-collapse v-if="moreRequest" with-icon ripple>
            <template #toggle>
                <div>{{ t("common.popup.request") }}</div>
            </template>
            <div>
                <ui-button outlined @click="openMoreRequest = true">
                    {{ t("common.popup.request") }}
                </ui-button>
            </div>
        </ui-collapse>
        <ui-collapse with-icon ripple>
            <template #toggle>
                <div>{{ t("common.abSettings") }}</div>
            </template>
            <langSelect location="prompt" />
        </ui-collapse>
    </div>

    <ui-dialog v-model="openOPReq" fullscreen>
        <ui-dialog-title v-if="visualizedParams && visualizedParams.length > 1">
            {{ t("common.popup.keywords.request") }} ({{ page }}/{{
                visualizedParams.length
            }})
        </ui-dialog-title>
        <ui-dialog-title v-else>
            {{ t("common.popup.keywords.request") }}
        </ui-dialog-title>
        <ui-dialog-content>
            <ui-textfield
                v-model="jsonData"
                input-type="textarea"
                fullwidth
                disabled
                rows="8"
            />
            <ui-button @click="copyToClipboard(jsonData)">
                {{ t("common.popup.copy") }}
            </ui-button>
        </ui-dialog-content>
    </ui-dialog>

    <ui-dialog v-model="openOPRes" fullscreen>
        <ui-dialog-title v-if="visualizedParams && visualizedParams.length > 1">
            {{ t("common.popup.keywords.result") }} ({{ page }}/{{
                visualizedParams.length
            }})
        </ui-dialog-title>
        <ui-dialog-title v-else>
            {{ t("common.popup.keywords.result") }}
        </ui-dialog-title>
        <ui-dialog-content>
            <ui-textfield
                v-model="resultData"
                input-type="textarea"
                fullwidth
                disabled
                rows="8"
            />
            <ui-button @click="copyToClipboard(resultData)">
                {{ t("common.popup.copy") }}
            </ui-button>
        </ui-dialog-content>
    </ui-dialog>

    <ui-dialog v-model="openOpDetails" fullscreen>
        <ui-dialog-title>
            {{ t("common.popup.details") }}
        </ui-dialog-title>
        <ui-dialog-content>
            <span> {{ t("operations.receipt.id", { resultID }) }}<br /> </span>
            <span>
                {{ t("operations.receipt.block", { resultBlockNum }) }}<br />
            </span>
            <span v-if="resultTrxNum">
                {{ t("operations.receipt.trxNum", { resultTrxNum }) }}<br />
            </span>
            <span v-if="resultExpiration">
                {{ t("operations.receipt.expiration", { resultExpiration })
                }}<br />
            </span>
            <span v-if="resultSignatures">
                {{ t("operations.receipt.signatures", { resultSignatures }) }}
            </span>
        </ui-dialog-content>
    </ui-dialog>

    <ui-dialog v-model="openResult" fullscreen>
        <ui-dialog-title>
            {{ t("common.popup.result") }}
        </ui-dialog-title>
        <ui-dialog-content>
            <ui-textfield
                v-model="moreResult"
                input-type="textarea"
                fullwidth
                disabled
                rows="8"
            />
            <ui-button @click="copyToClipboard(moreResult)">
                {{ t("common.popup.copy") }}
            </ui-button>
        </ui-dialog-content>
    </ui-dialog>

    <ui-dialog v-model="openMoreRequest" fullscreen>
        <ui-dialog-title>
            {{ t("common.popup.request") }}
        </ui-dialog-title>
        <ui-dialog-content>
            <ui-textfield
                v-model="moreRequest"
                input-type="textarea"
                fullwidth
                disabled
                rows="8"
            />
            <ui-button @click="copyToClipboard(moreRequest)">
                {{ t("common.popup.copy") }}
            </ui-button>
        </ui-dialog-content>
    </ui-dialog>
</template>
