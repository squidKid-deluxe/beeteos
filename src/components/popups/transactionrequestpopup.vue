<script setup>
    import { computed, ref, watchEffect, onMounted } from "vue";
    import { useI18n } from 'vue-i18n';
    import {formatChain} from "../../lib/formatter.js";

    const { t } = useI18n({ useScope: 'global' });

    const props = defineProps({
        request: {
            type: Object,
            required: true,
            default() {
                return {}
            }
        },
        visualizedAccount: {
            type: String,
            required: true,
            default() {
                return ''
            }
        },
        visualizedParams: {
            type: String,
            required: true,
            default() {
                return ''
            }
        },
        warning: {
            type: String,
            required: false,
            default() {
                return ''
            }
        }
    });

    let parsedParameters = ref([]);
    onMounted(() => {
        if (props.visualizedParams) {
            const _parsedparsedParameters = JSON.parse(props.visualizedParams);
            parsedParameters.value = _parsedparsedParameters;
        }
    });

    let open = ref(false);
    let page = ref(1);
    let receipt = ref(false);

    let tableTooltip = computed(() => {
        if (!props.request) {
            return '';
        }

        return t(
            'operations.rawsig.request',
            {
                appName: props.request.payload.appName,
                origin: props.request.payload.origin,
                chain: formatChain(props.request.payload.chain),
                accountName: props.visualizedAccount ? props.visualizedAccount : props.request.payload.account_id
            }
        );
    });

    let buttonText = computed(() => {
        if (!props.request) {
            return '';
        }

        return props.request.payload.params &&
            props.request.payload.params.length > 0 &&
            props.request.payload.params[0] == "sign"
            ? t('operations.rawsig.sign_btn')
            : t('operations.rawsig.sign_and_broadcast_btn')
    })

    let warning = computed(() => {
        if (!props.warning || !props.warning.length) {
            return;
        }
        return props.warning;
    });

    function _clickedAllow() {
        window.electron.clickedAllow({
            result: {
                success: true,
                receipt: receipt.value
            },
            request: {
                id: props.request.id
            }
        });
    }

    function _clickedDeny() {
        window.electron.clickedDeny({
            result: {
                canceled: true
            },
            request: {
                id: props.request.id
            }
        });
    }

    const hexToString = (hex) => {
        const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        return new TextDecoder().decode(bytes);
    };

    let jsonData = ref("");
    watchEffect(() => {
        let currentOp = parsedParameters.value[page.value - 1].op;
        if (currentOp.memo && currentOp.memo.message) {
            try {
                currentOp.memo.message = hexToString(currentOp.memo.message);
            } catch (e) {
                console.error("Failed to decode memo message:", e);
            }
        }
        jsonData.value = JSON.stringify(currentOp, undefined, 4);
    });
</script>
<template>
    <div style="padding-bottom:5px;">
        {{ tableTooltip }}
    </div>
    <div>
        {{ 
            parsedParameters && parsedParameters.length > 1
                ? t('operations.rawsig.summary', {numOps: parsedParameters.length})
                : t('operations.rawsig.summary_single')
        }}
    </div>
    <div
        v-if="!!parsedParameters"
        class="text-left custom-content"
        style="marginTop: 10px;"
    >
        <ui-card>
            <ui-card-content>
                <ui-card-text>
                    <div
                        v-if="parsedParameters.length > 1"
                        :class="$tt('subtitle1')"
                    >
                        {{ t(parsedParameters[page - 1].title) }} ({{ page }}/{{ parsedParameters.length }})
                    </div>
                    <div
                        v-else
                        :class="$tt('subtitle1')"
                    >
                        {{ t(parsedParameters[page - 1].title) }}
                    </div>
                    <div>
                        {{ t(`operations.injected.${props.request.payload.chain === "BTS_TEST" ? "BTS" : props.request.payload.chain}.${parsedParameters[page - 1].method}.headers.request`) }}
                    </div>
                    <div
                        v-for="row in parsedParameters[page - 1].rows"
                        :key="row.key"
                        :class="$tt('subtitle2')"
                    >
                        {{ t(`operations.injected.${props.request.payload.chain === "BTS_TEST" ? "BTS" : props.request.payload.chain}.${parsedParameters[page - 1].method}.rows.${row.key}`, row.params) }}
                    </div>
                </ui-card-text>
            </ui-card-content>
            <ui-card-actions>
                <ui-card-buttons>
                    <ui-button
                        outlined
                        @click="open = true"
                    >
                        {{ t('common.popup.request') }}
                    </ui-button>
                </ui-card-buttons>
                <ui-card-icons />
            </ui-card-actions>
        </ui-card>
        <ui-pagination
            v-model="page"
            :total="parsedParameters.length"
            mini
            show-total
            :page-size="[1]"
            position="center"
        />

        <h4 class="h4 beet-typo-small">
            {{ t('operations.rawsig.receipt.title') }}
        </h4>
        <ui-switch
            v-model="receipt"
            input-id="enable-receipt"
            style="margin-bottom: 5px;"
        />
        <label
            :for="'enable-receipt'"
            style="margin-left: 15px;"
        >
            {{ t(`operations.rawsig.receipt.${receipt ? "yes" : "no"}`) }}
        </label>

        <h4 class="h4 beet-typo-small">
            {{ t('operations.rawsig.request_cta') }}
        </h4>
        <ui-alert
            v-if="warning"
            state="warning"
        >
            {{ 
                warning && warning === "serverError"
                    ? t("operations.transfer.server_error")
                    : null
            }}
            {{
                warning && warning !== "serverError"
                    ? t("operations.transfer.detected_scammer")
                    : null
            }}
        </ui-alert>
        <div
            v-if="!!parsedParameters"
            style="padding-bottom: 25px;"
        >
            <ui-button
                raised
                style="margin-right:5px"
                @click="_clickedAllow()"
            >
                {{ buttonText }}
            </ui-button>
            <ui-button
                raised
                @click="_clickedDeny()"
            >
                {{ t('operations.rawsig.reject_btn') }}
            </ui-button>
        </div>
        <div
            v-else
            style="padding-bottom: 25px;"
        >
            <ui-button
                raised
                style="margin-right:5px"
                disabled
            >
                {{ buttonText }}
            </ui-button>
            <ui-button
                raised
                @click="_clickedDeny()"
            >
                {{ t('operations.rawsig.reject_btn') }}
            </ui-button>
        </div>
    </div>
    <div
        v-else
        class="text-left custom-content"
    >
        <pre>
            {{ t('operations.rawsig.loading') }}
        </pre>
    </div>

    <ui-dialog
        v-model="open"
        fullscreen
    >
        <ui-dialog-title v-if="parsedParameters.length > 1">
            {{ t(parsedParameters[page - 1].title) }} ({{ page }}/{{ parsedParameters.length }})
        </ui-dialog-title>
        <ui-dialog-title v-else>
            {{ t(parsedParameters[page - 1].title) }}
        </ui-dialog-title>
        <ui-dialog-content>
            <ui-textfield
                v-model="jsonData"
                input-type="textarea"
                fullwidth
                disabled
                rows="8"
            />
        </ui-dialog-content>
    </ui-dialog>
</template>
