<script setup>
    import { ref, computed, onMounted, watch } from 'vue';
    import { useI18n } from 'vue-i18n';

    import AccountSelect from "./account-select";

    import store from '../store/index.js';
    import router from '../router/index.js';

    const { t } = useI18n({ useScope: 'global' });

    let selectedAccount = computed(() => {
        if (!store.state.WalletStore.isUnlocked) {
            return;
        }
        return store.getters["AccountStore/getCurrentSafeAccount"]()
    })

    let storedNodes = ref([]);

    watch(selectedAccount, (newVal) => {
        if (newVal && newVal.chain) {
            storedNodes.value = store.getters["SettingsStore/getNodes"](newVal.chain);
        }
    }, { immediate: true });

    function handleClick(node) {
        store.dispatch("SettingsStore/setNode", {
            chain: selectedAccount.value.chain,
            node: node
        }).then(() => {
            storedNodes.value = [...store.getters["SettingsStore/getNodes"](selectedAccount.value.chain)];
        });
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
    <div
        class="dapp-list mt-2"
        style="text-align: center; margin-top: auto; margin-bottom: auto;"
    >
        <AccountSelect />
        <ui-grid class="row px-4">
            <ui-grid-cell
                class="largeHeader"
                columns="12"
            >
                <p class="small text-justify">
                    {{ t('common.nodes.prompt') }}
                </p>
            </ui-grid-cell>
            <ui-grid-cell columns="6">
                <div style="max-height: 200px; overflow-y: auto;">
                    <ui-list>
                        <ui-item v-for="(node, index) in storedNodes" :key="index" @click="handleClick(index)">
                            <ui-item-text-content>{{ index === 0 ? "✔️" : "" }} {{ storedNodes[index].url }}</ui-item-text-content>
                        </ui-item>
                    </ui-list>
                </div>
            </ui-grid-cell>
            <ui-grid-cell columns="6">
                <router-link
                    :to="'/dashboard'"
                    style="text-decoration: none;"
                    replace
                >
                    <ui-button
                        outlined
                        class="step_btn"
                    >
                        {{ t('common.nodes.exit') }}
                    </ui-button>
                </router-link>
            </ui-grid-cell>
            <ui-grid-cell columns="3" />
        </ui-grid>
    </div>
</template>
