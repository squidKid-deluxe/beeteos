<script setup>
    import { watchEffect, ref, computed } from "vue";
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
        balances: {
            type: Array,
            required: false,
            default() {
                return []
            }
        },
        chain: {
            type: String,
            required: true,
            default: ""
        },
        isConnected: {
            type: Boolean,
            required: false,
            default: false
        },
        isConnecting: {
            type: Boolean,
            required: false,
            default: false
        }
    });

    const emit = defineEmits(['refresh']);

    let balances = computed(() => {
        return props.balances;
    });

    let selectedChain = computed(() => {
        return props.account.chain;
    });

    let accountName = computed(() => {
        return props.account.accountName;
    });


    let tableData = ref();
    async function loadBalances() {
        if (
            selectedChain.value !== '' &&
            accountName.value !== '' &&
            props.chain === selectedChain.value
        ) {
            tableData.value = null;
            emit('refresh', true);
        } else {
            console.log("Unable to reload balances, please try again later.")
        }
    }

    watchEffect(() => {
        if (balances.value && balances.value.length) {
            tableData.value = {
                data: balances.value.map(balance => {
                    return {
                        balance: balance.balance.toLocaleString(
                            undefined,
                            { minimumFractionDigits: balance.precision }
                        ),

                        asset_name: balance.asset_name
                    }
                }),
                thead: [
                    {
                        value: 'Asset name',
                        sort: 'asc',
                        columnId: 'asset_name'
                    },
                    {
                        value: 'Balance',
                        columnId: 'balance'
                    },
                ],
                tbody: ['asset_name', 'balance'],
            };
        }
    });
</script>

<template>
    <div style="padding:5px">
        {{ t('common.balances_lbl') }}
        <ui-button
            v-if="isConnected || balances"
            class="step_btn"
            @click="loadBalances()"
        >
            {{ t('common.balances.refresh') }}
        </ui-button>
        <ui-button
            v-else-if="!isConnected && !isConnecting"
            class="step_btn"
            @click="loadBalances()"
        >
            {{ t('common.balances.reconnect') }}
        </ui-button>

        <ui-table
            v-if="tableData"
            v-shadow="1"
            :data="tableData.data"
            :thead="tableData.thead"
            :tbody="tableData.tbody"
            style="height: 180px;"
        />
        <ui-card
            v-if="balances && !balances.length"
            v-shadow="1"
            outlined
        >
            {{ t('common.balances.empty') }}
        </ui-card>
        <ui-card
            v-if="isConnecting"
            v-shadow="1"
            outlined
            style="padding:5px; text-align: center;"
        >
            <ui-skeleton active />
        </ui-card>
        <ui-card
            v-if="!isConnected && !isConnecting"
            v-shadow="1"
            outlined
            style="padding:5px"
        >
            {{ t('common.balances.error') }}
        </ui-card>
    </div>
</template>
