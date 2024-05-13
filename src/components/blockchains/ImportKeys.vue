<script setup>
    import {ref, inject, computed, watchEffect} from "vue";

    import { useI18n } from 'vue-i18n';
    import store from '../../store/index.js';
    const { t } = useI18n({ useScope: 'global' });

    const props = defineProps({
        chain: {
            type: String,
            required: true,
            default: ''
        },
    });

    const emit = defineEmits(['back', 'continue', 'imported']);

    let accessType = ref();
    let requiredFields = ref();
    watchEffect(() => {
        async function initialize() {
            let blockchainRequest;
            try {
                blockchainRequest = await window.electron.blockchainRequest({
                    methods: ["getAccessType", "getSignUpInput"],
                    chain: props.chain
                });
            } catch (error) {
                console.log(error);
                return;
            }
            
            if (blockchainRequest && blockchainRequest.getAccessType) {
                accessType.value = blockchainRequest.getAccessType;
            }

            if (blockchainRequest && blockchainRequest.getSignUpInput) {
                requiredFields.value = blockchainRequest.getSignUpInput;
            }

        }
        if (props.chain) {
            initialize();
        }
    });

    let accountname = ref("");
    let privateKey = ref("");
    async function next() {
        let authorities = {};
        if (requiredFields.value && requiredFields.value.privateKey) {
            authorities.privateKey = privateKey.value;
        }

        console.log("Verifying account");

        let blockchainRequest;
        try {
            blockchainRequest = await window.electron.blockchainRequest({
                methods: ["verifyAccount"],
                accountname: accountname.value,
                chain: props.chain,
                authorities: authorities.privateKey
            });
        } catch (error) {
            console.log(error);
            console.log("Account verification error, check your key and try again");
            window.electron.notify(t("common.unverified_account_error"));
            return;
        }

        if (blockchainRequest && blockchainRequest.verifyAccount) {
            console.log("Account verified");
            privateKey.value = "";

            if (store.state.WalletStore.isUnlocked) {
                window.electron.resetTimer();
            }
            emit('continue');
            emit('imported', [{
                account: {
                    accountName: accountname.value,
                    accountID: blockchainRequest.verifyAccount.id,
                    chain: props.chain,
                    keys: authorities
                }
            }]);
        }

    }
</script>

<template>
    <div id="step2">
        <p class="mb-2 font-weight-bold">
            {{ t(accessType == 'account' ? 'common.account_name' : 'common.address_name', { 'chain' : chain}) }}
        </p>
        <input
            id="inputAccount"
            v-model="accountname"
            type="text"
            class="form-control mb-3"
            :placeholder="t(accessType == 'account' ? 'common.account_name' : 'common.address_name', { 'chain' : chain})"
            required
        >
        <p class="my-3 font-weight-normal">
            {{ t('common.keys_cta') }}
        </p>

        <template v-if="requiredFields && requiredFields.privateKey">
            <p class="mb-2 font-weight-bold">
                {{ t(accessType == 'account' ? 'common.active_authority' : 'common.public_authority') }}
            </p>
            <input
                id="inputActive"
                v-model="privateKey"
                type="password"
                class="form-control mb-3 small"
                :placeholder="t(accessType == 'account' ? 'common.active_authority_placeholder' : 'common.public_authority_placeholder')"
                required
            >
        </template>

        <ui-grid>
            <ui-grid-cell columns="12">
                <ui-button
                    outlined
                    class="step_btn"
                    @click="emit('back')"
                >
                    {{ t('common.back_btn') }}
                </ui-button>

                <span v-if="requiredFields && requiredFields.privateKey">
                    <ui-button
                        v-if="accountname !== '' && privateKey !== ''"
                        raised
                        class="step_btn"
                        type="submit"
                        @click="next"
                    >
                        {{ t('common.next_btn') }}
                    </ui-button>
                    <ui-button
                        v-else
                        disabled
                        class="step_btn"
                        type="submit"
                    >
                        {{ t('common.next_btn') }}
                    </ui-button>
                </span>
                <span v-else>
                    <ui-button
                        disabled
                        class="step_btn"
                        type="submit"
                    >
                        {{ t('common.next_btn') }}
                    </ui-button>
                </span>
            </ui-grid-cell>
        </ui-grid>
    </div>
</template>
