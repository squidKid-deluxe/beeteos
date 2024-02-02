<script setup>
    import {ref, inject, computed, watchEffect} from "vue";
    import { ipcRenderer } from 'electron';

    import { useI18n } from 'vue-i18n';
    const { t } = useI18n({ useScope: 'global' });

    const props = defineProps({
        chain: {
            type: String,
            required: true,
            default: ''
        },
    });

    const emit = defineEmits(['back', 'continue', 'imported']);

    watchEffect(() => {
        if (props.chain) {
            ipcRenderer.send("blockchainRequest", {
                methods: ["getAccessType", "getSignUpInput"],
                location: 'importKeysInit',
                chain: props.chain
            });
        }
    });

    let accessType = ref();
    let requiredFields = ref();
    ipcRenderer.on("blockchainResponse:importKeysInit", (event, data) => {
        const { getAccessType, getSignUpInput } = data;
        if (getAccessType) {
            accessType.value = getAccessType;
        }
        if (getSignUpInput) {
            requiredFields.value = getSignUpInput;
        }
    });

    let accountname = ref("");
    let privateKey = ref("");
    async function next() {
        let authorities = {};
        if (requiredFields.value.privateKey != null) {
            authorities.privateKey = privateKey.value;
        }

        console.log("Verifying account");
        ipcRenderer.send("blockchainRequest", {
            methods: ["verifyAccount"],
            location: 'import',
            accountname: accountname.value,
            chain: props.chain,
            authorities: authorities.privateKey
        });

    }

    ipcRenderer.on("blockchainResponse:import", (event, data) => {
        const { account, authorities } = data;
        if (account && authorities) {
            console.log("Account verified");
            privateKey.value = "";

            emit('continue');
            emit('imported', [{
                account: {
                    accountName: accountname.value,
                    accountID: account.id,
                    chain: props.chain,
                    keys: authorities
                }
            }]);
        }
    });

    ipcRenderer.on("blockchainResponse:import:error", (event, data) => {
        console.log("Account verification error, check your key and try again");
        ipcRenderer.send("notify", t("common.unverified_account_error"));
    });
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

        <template v-if="requiredFields.privateKey !== null">
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

                <span v-if="requiredFields.privateKey != null">
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
