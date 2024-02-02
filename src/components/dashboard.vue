<script setup>
    import { computed, inject, onMounted, watchEffect, ref, ipcRenderer } from "vue";

    import Balances from "./balances";
    import AccountDetails from "./account-details";
    import AccountSelect from "./account-select";

    import store from '../store/index';

    const emitter = inject('emitter');

    let selectedAccount = computed(() => {
        if (!store.state.WalletStore.isUnlocked) {
            return;
        }
        return store.getters["AccountStore/getCurrentSafeAccount"]()
    })
    
    let isConnected = ref();
    let isConnecting = ref();
    let lastBlockchain = ref(null);
    let fetchQty = ref(1);

    watchEffect(() => {
        console.log(`Fetching blockchain data #${fetchQty.value}`);
        if (selectedAccount.value) {
            isConnecting.value = true;
            isConnected.value = false;
            if (
                !lastBlockchain.value ||
                (lastBlockchain.value && lastBlockchain.value !== selectedAccount.value.chain)
            ) {
                lastBlockchain.value = selectedAccount.value.chain;
                ipcRenderer.send(
                    'blockchainRequest',
                    { 
                        methods: ['getExplorer', 'getAccessType', 'getBalances'],
                        account: selectedAccount.value,
                        chain: selectedAccount.value.chain,
                        location: 'dashboard'
                    }
                );
            } else {
                ipcRenderer.send(
                    'blockchainRequest',
                    {
                        methods: ['getBalances'],
                        account: selectedAccount.value,
                        chain: selectedAccount.value.chain,
                        location: 'dashboard'
                    }
                );
            }
        }
    })

    emitter.on('refreshBalances', () => {
        console.log("Refreshing balances")
        fetchQty.value++;
    });

    const _explorer = ref(null);
    const _accessType = ref(null);
    const _balances = ref(null);
    const _chain = ref(null);
    
    ipcRenderer.on(`blockchainResponse:dashboard`, (event, data) => {
        const { getExplorer, getAccessType, getBalances, chain } = data;
        if (getExplorer) {
            _explorer.value = getExplorer;
        }
        if (getAccessType) {
            _accessType.value = getAccessType;
        }
        if (getBalances) {
            _balances.value = getBalances;
        }
        if (chain) {
            _chain.value = chain;
        }
        isConnecting.value = false;
        isConnected.value = true;
    });

    /**
     * Set the initial menu value
     */
    onMounted(() => {
        emitter.emit('setMenuItem', 0);
    });
</script>

<template>
    <span
        class="container"
        style="min-height:700px;"
    >
        <AccountSelect />
        <span v-if="selectedAccount">
            <AccountDetails
                :account="selectedAccount"
                :explorer="_explorer"
                :type="_accessType"
            />
            <Balances
                :account="selectedAccount"
                :balances="_balances"
                :chain="_chain"
                :is-connected="isConnected"
                :is-connecting="isConnecting"
            />
        </span>
    </span>
</template>
