<script setup>
    import { ref, computed } from 'vue';
    import { useI18n } from 'vue-i18n';

    import AccountSelect from "./account-select";

    import store from '../store/index.js';
    import router from '../router/index.js';

    const { t } = useI18n({ useScope: 'global' });

    let walletpass = ref("");
    let passincorrect = ref("");

    let selectedAccount = computed(() => {
        if (!store.state.WalletStore.isUnlocked) {
            return;
        }
        return store.getters["AccountStore/getCurrentSafeAccount"]()
    })

    let accountQuantity = computed(() => {
        if (!store.state.WalletStore.isUnlocked) {
            return 0;
        }
        return store.getters["AccountStore/getAccountQuantity"];
    })

    async function deleteAccount() {
        if (!store.state.WalletStore.isUnlocked || router.currentRoute.value.path != "/settings") {
            return;
        }
        window.electron.resetTimer();

        store
            .dispatch("WalletStore/deleteAccountFromWallet", {
                accountName: selectedAccount.value.accountName,
                chain: selectedAccount.value.chain,
                wallet_pass: walletpass.value
            })
            .then(async () => {
                window.electron.notify(t('common.settings.deleted'));
                router.replace("/");
                passincorrect.value = "";
                walletpass.value = "";
            })
            .catch(() => {
                passincorrect.value = "is-invalid";
                window.electron.notify(t('common.start.invalid_password'));
            });
    }
</script>

<template>
    <div
        class="dapp-list mt-2"
        style="text-align: center; margin-top: auto; margin-bottom: auto;"
    >
        <p>
            <u>{{ t('common.settings.label') }}</u>
        </p>
        <AccountSelect />
        <ui-grid
            v-if="accountQuantity && accountQuantity > 1"
            class="row px-4"
        >
            <ui-grid-cell
                class="largeHeader"
                columns="12"
            >
                <p class="small text-justify">
                    {{ t('common.settings.prompt') }}
                </p>
            </ui-grid-cell>
            <ui-grid-cell columns="3" />
            <ui-grid-cell columns="6">
                <input
                    id="inputPassword"
                    v-model="walletpass"
                    style="width:97%; margin-top: 5px;"
                    type="password"
                    class="form-control mb-4 px-3"
                    :placeholder=" t('common.password_placeholder')"
                    required
                    :class="passincorrect"
                    @focus="passincorrect=''"
                >
                <br>
                <ui-button
                    class="step_btn"
                    type="button"
                    raised
                    @click="deleteAccount"
                >
                    {{ t('common.settings.button') }}
                </ui-button><br>
                <router-link
                    :to="'/dashboard'"
                    style="text-decoration: none;"
                    replace
                >
                    <ui-button
                        outlined
                        class="step_btn"
                    >
                        {{ t('common.settings.exit') }}
                    </ui-button>
                </router-link>
            </ui-grid-cell>
            <ui-grid-cell columns="3" />
        </ui-grid>
        <ui-grid
            v-else
            class="row px-4"
        >
            <ui-grid-cell
                class="largeHeader"
                columns="12"
            >
                <p class="small text-justify">
                    {{ t('common.settings.insufficient') }}
                </p>
            </ui-grid-cell>
        </ui-grid>
    </div>
</template>
