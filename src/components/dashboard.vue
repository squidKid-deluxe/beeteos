<script setup>
    import { computed, watchEffect, ref, onMounted } from "vue";

    import Balances from "./balances";
    import AccountDetails from "./account-details";
    import AccountSelect from "./account-select";

    import store from '../store/index.js';
    import router from '../router/index.js';

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

    let _explorer = ref("");
    let _accessType = ref("");
    let _balances = ref([]);
    let _chain = ref("");

    watchEffect(async () => {
        async function lookupBlockchain() {
            isConnecting.value = true;
            isConnected.value = false;
            let selectedDifferentChain = !lastBlockchain.value || (lastBlockchain.value && lastBlockchain.value !== selectedAccount.value.chain);
            if (selectedDifferentChain) {
                lastBlockchain.value = selectedAccount.value.chain;
            }

            _chain.value = selectedAccount.value.chain;

            let blockchainRequest;
            try { 
                blockchainRequest = await window.electron.blockchainRequest({
                    methods: selectedDifferentChain
                        ? ['getExplorer', 'getAccessType', 'getBalances']
                        : ['getExplorer', 'getBalances'],
                    account: selectedAccount.value,
                    chain: selectedAccount.value.chain,
                })
            } catch (error) {
                console.log({error});
            }

            if (!blockchainRequest) {
                console.log("No blockchain request");
                isConnecting.value = false;
                isConnected.value = false;
                return;
            }

            if (blockchainRequest.getExplorer) {
                _explorer.value = blockchainRequest.getExplorer;
            }
            if (blockchainRequest.getAccessType) {
                _accessType.value = blockchainRequest.getAccessType;
            }
            if (blockchainRequest.getBalances) {
                _balances.value = JSON.parse(blockchainRequest.getBalances);
            }

            isConnecting.value = false;
            isConnected.value = true;
        }

        if (selectedAccount.value && fetchQty.value) {
            console.log(`Fetching blockchain data #${fetchQty.value}`);
            lookupBlockchain();
        }
    });

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
                @refresh="() => fetchQty += 1"
            />
        </span>
    </span>
</template>
