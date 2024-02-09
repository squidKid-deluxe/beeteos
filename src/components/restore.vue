<script setup>
    import { ref, computed } from 'vue';
    import { useI18n } from 'vue-i18n';
    const { t } = useI18n({ useScope: 'global' });

    import store from '../store/index.js';
    import router from '../router/index.js';

    let backupPass = ref("");
    let fileError = ref(false);
    let passError = ref(false);

    let walletlist = computed(() => {
        return store.getters['WalletStore/getWalletList'];
    })

    async function restore() {
        fileError.value = false;
        passError.value = false;

        if (!document.getElementById('restoreWallet').files[0]) {
            fileError.value = true;
            return;
        }

        if (backupPass.value === "") {
            passError.value = true;
            return;
        }

        let _hash;
        try {
            _hash = window.electron.sha512({data: backupPass.value});
        } catch (error) {
            console.log(error);
            fileError.value = false;
            passError.value = true;
            store.dispatch(
                "WalletStore/notifyUser",
                {notify: "request", message: t('common.apiUtils.restore.decryptError')}
            );
            return;
        }

        backupPass.value = "";

        let file = document.getElementById('restoreWallet').files[0].path;
        let parsedData;
        try {
            parsedData = window.electron.restore({file: file, seed: _hash});
        } catch (error) {
            console.log(error);
            fileError.value = true;
            passError.value = true;
            store.dispatch(
                "WalletStore/notifyUser",
                {notify: "request", message: t('common.apiUtils.restore.decryptError')}
            );
            return;
        }

        let existingWalletNames = walletlist.value.slice().map(wallet => wallet.name);
        if (existingWalletNames.includes(parsedData.wallet)) {
            fileError.value = true;
            passError.value = true;
            console.log("A wallet with the same name already exists, aborting wallet restoration");
            store.dispatch(
                "WalletStore/notifyUser",
                {notify: "request", message: t('common.apiUtils.restore.duplicate')}
            );
            return;
        }

        try {
            await store.dispatch(
                'WalletStore/restoreWallet',
                {
                    backup: parsedData,
                    password: backupPass.value
                }
            );
            router.replace("/");
        } catch (error) {
            console.log(error);
            return;
        }
    }
</script>

<template>
    <div class="bottom p-0">
        <div class="content px-3">
            <h4 class="h4 mt-3 font-weight-bold">
                {{ t('common.restore_lbl') }}
            </h4>
            <p
                v-tooltip="t('common.tooltip_backupfile_cta')"
                class="my-3 font-weight-bold"
            >
                {{ t('common.backupfile_cta') }} &#10068;
            </p>
            <input
                id="restoreWallet"
                type="file"
                class="form-control"
                required
            >
            <p
                v-if="fileError"
                style="color: red;"
            >
                {{ t('common.invalidFile') }}
            </p>
            <p
                v-tooltip="t('common.tooltip_backuppass_cta')"
                class="my-3 font-weight-bold"
            >
                {{ t('common.backuppass_cta') }} &#10068;
            </p>

            <input
                id="backupPass"
                v-model="backupPass"
                type="password"
                class="form-control mb-3"
                :placeholder="t('common.password_placeholder')"
                required
            >

            <p
                v-if="passError"
                style="color: red;"
            >
                {{ t('common.invalidPass') }}
            </p>

            <ui-grid>
                <ui-grid-cell columns="12">
                    <router-link
                        to="/"
                        replace
                    >
                        <ui-button
                            outlined
                            class="step_btn"
                        >
                            {{ t('common.cancel_btn') }}
                        </ui-button>
                    </router-link>
                    <ui-button
                        raised
                        class="step_btn"
                        type="submit"
                        @click="restore"
                    >
                        {{ t('common.restore_go_cta') }}
                    </ui-button>
                </ui-grid-cell>
            </ui-grid>
        </div>
    </div>
</template>
