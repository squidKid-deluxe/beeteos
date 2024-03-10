<script setup>
    import { onMounted, watchEffect, ref } from 'vue';
    import { useI18n } from 'vue-i18n';
    import store from '../../store/index.js';

    const { t } = useI18n({ useScope: 'global' });
    const props = defineProps({
        ops: {
            type: Array,
            required: true,
            default() {
                return []
            }
        },
        chain: {
            type: String,
            required: true,
            default() {
                return ''
            }
        }
    });
    const emit = defineEmits(['selected', 'exit']);

    let selected = ref([]);
    onMounted(() => {
        let rememberedRows = store.getters['SettingsStore/getChainPermissions'](props.chain);
        if (!rememberedRows || !rememberedRows.length) {
            selected.value = [];
            return;
        }

        selected.value = rememberedRows;
    })

    function saveRows() {
        window.electron.resetTimer();
        store.dispatch(
            "SettingsStore/setChainPermissions",
            {
                chain: props.chain,
                rows: selected.value
            }
        );
        emit('selected', selected.value);
    }

    function goBack() {
        window.electron.resetTimer();
        emit('exit', true);
    }

    let thead = ref(['ID', 'Method', 'Info'])
    let tbody = ref([
        {
            field: 'id',
            fn: data => {
                return data.id
            }
        },
        {
            field: 'method',
            fn: data => {
                return t(`operations.injected.${props.chain === "BTS_TEST" ? "BTS" : props.chain}.${data.method}.method`)
            }
        },
        {
            field: 'info',
            fn: data => {
                return t(`operations.injected.${props.chain === "BTS_TEST" ? "BTS" : props.chain}.${data.method}.tooltip`)
            }
        }
    ]);
</script>

<template>
    <div class="bottom p-0">
        <span>
            <span>
                <p style="marginBottom:0px;">
                    {{ t('common.totp.prompt') }}
                </p>
                <p
                    v-if="!props.ops || !props.ops.length"
                    outlined
                    style="marginTop: 5px;"
                >
                    {{ t('common.totp.unsupported') }}
                </p>
                <ui-table
                    v-else 
                    v-model="selected"
                    :data="props.ops"
                    :thead="thead"
                    :tbody="tbody"
                    :default-col-width="200"
                    style="height: 250px;"
                    row-checkbox
                    selected-key="id"
                >
                    <template #method="{ data }">
                        <div class="method">{{ data.method }}</div>
                    </template>

                    <template #info="{ data }">
                        <div class="info">{{ data.info }}</div>
                    </template>
                </ui-table>
                <ui-list>
                    <ui-item style="padding-left:100px;">
                        <ui-button
                            raised
                            style="margin-right:5px"
                            icon="arrow_back_ios"
                            @click="goBack"
                        >
                            {{ t('common.qr.back') }}
                        </ui-button>
                        <ui-button
                            raised
                            style="margin-right:5px"
                            icon="save"
                            @click="saveRows"
                        >
                            {{ t('common.totp.save') }}
                        </ui-button>
                    </ui-item>
                </ui-list>
            </span>
        </span>
    </div>
</template>
