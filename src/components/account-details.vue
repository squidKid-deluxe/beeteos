<script setup>
    import { computed } from 'vue';
    import {formatChain} from "../lib/formatter.js";
    //import { shell } from 'electron';
    import { useI18n } from 'vue-i18n';
    const { t } = useI18n({ useScope: 'global' });

    const props = defineProps({
        account: {
            type: Object,
            required: true,
            default() {
                return {}
            }
        },
        explorer: {
            type: String,
            required: true,
            default: ""
        },
        type: {
            type: String,
            required: true,
            default: ""
        }
    });

    let chainLabel = computed(() => {
        return formatChain(props.account.chain);
    });

    let accessType = computed(() => {
        if (!props.type) {
            return;
        }
        return props.type == "account"
            ? t('common.account_details_name_lbl')
            : t('common.account_details_address_lbl');
    });

    function openExplorer() {
        // TODO: Copy/Paste link for external browser instead?
        //shell.openExternal(props.explorer);
    }

</script>

<template>
    <div style="padding:5px">
        <span>
            {{ t('common.account_details_lbl') }}
            <ui-button
                v-if="explorer"
                class="step_btn"
                outline
                @click="openExplorer()"
            >
                {{ t('common.account_details_explorer_lbl') }}
            </ui-button>
        </span>
        <ui-card
            v-shadow="1"
            outlined
        >
            <ui-list v-if="account">
                <ui-item :key="chainLabel">
                    <ui-item-text-content>
                        {{ t('common.account_details_chaim_lbl') }}
                    </ui-item-text-content>
                    <ui-item-last-content>
                        {{ chainLabel }}
                    </ui-item-last-content>
                </ui-item>
                <ui-item :key="account.accountName">
                    <ui-item-text-content>
                        {{ accessType }}
                    </ui-item-text-content>
                    <ui-item-last-content>
                        {{ account.accountName }}
                    </ui-item-last-content>
                </ui-item>
            </ui-list>
        </ui-card>
    </div>
</template>
