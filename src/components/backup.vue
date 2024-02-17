<script setup>
    import { ref } from 'vue';
    import { useI18n } from 'vue-i18n';
    import store from '../store/index.js';
    import router from '../router/index.js';

    const { t } = useI18n({ useScope: 'global' });

    let walletpass = ref("");
    let passincorrect = ref("");

    async function downloadBackup() {
        if (!store.state.WalletStore.isUnlocked || router.currentRoute.value.path != "/backup") {
            return;
        }
        window.electron.resetTimer();

        const _id = store.getters['WalletStore/getCurrentID'];

        store
            .dispatch("WalletStore/getWallet", {
                wallet_id: _id,
                wallet_pass: walletpass.value
            })
            .then(async () => {
                let walletName = store.getters['WalletStore/getWalletName'];
                let accounts = JSON.stringify(store.getters['AccountStore/getAccountList'].slice());

                window.electron.downloadBackup({
                    walletName: walletName,
                    accounts: accounts,
                    seed: walletpass.value
                });
                
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
            <u>{{ t('common.backup_lbl') }}</u>
        </p>
        <ui-grid class="row px-4">
            <ui-grid-cell
                class="largeHeader"
                columns="12"
            >
                <p class="small text-justify">
                    {{ t('common.backup_txt') }}
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
                    @click="downloadBackup"
                >
                    {{ t('common.backup_btn') }}
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
                        Exit settings menu
                    </ui-button>
                </router-link>
            </ui-grid-cell>
            <ui-grid-cell columns="3" />
        </ui-grid>
    </div>
</template>
