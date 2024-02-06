<script setup>
    import {ref, watchEffect} from "vue";
    import { useI18n } from 'vue-i18n';
    const { t } = useI18n({ useScope: 'global' });

    const props = defineProps({
        chain: {
            type: String,
            required: true,
            default: ''
        }
    });

    const emit = defineEmits(['back', 'continue', 'imported']);

    let accountname = ref("");
    let memopk = ref("");

    let accessType = ref();
    let requiredFields = ref();
    watchEffect(() => {
        async function initialize() {
            let blockchainRequest;
            try {
                blockchainRequest = window.electron.blockchainRequest({
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

    async function next() {       
        let authorities = {};
        if (requiredFields.value.memo != null) {
            authorities.memo = memopk.value;
        }

        let blockchainRequest;
        try {
            blockchainRequest = await window.electron.blockchainRequest({
                methods: ["verifyAccount"],
                accountname: accountname.value,
                chain: props.chain,
                authorities: authorities
            });
        } catch (error) {
            console.log(error);
            console.log("Account verification error, check your memo key and try again");
            window.electron.notify(t("common.unverified_account_error"));
            return;
        }

        if (!blockchainRequest || !blockchainRequest.verifyAccount) {
            console.log("Account verification error, check your memo key and try again");
            window.electron.notify(t("common.unverified_account_error"));
            return;
        }

        emit('continue');
        emit('imported', [{
            account: {
                accountName: accountname.value,
                accountID: blockchainRequest.verifyAccount.id,
                chain: props.chain,
                keys: blockchainRequest.verifyAccount.authorities
            }
        }]);
    }
</script>

<template>
    <div id="step2">
        <p class="mb-2 font-weight-bold">
            {{ t('common.account_name', { 'chain' : chain}) }}
        </p>
        <input
            id="inputAccount"
            v-model="accountname"
            type="text"
            class="form-control mb-3"
            :placeholder="t('common.account_name', { 'chain' : chain})"
            required
        >
        <p class="my-3 font-weight-normal">
            {{ t('common.keys_cta') }}
        </p>
        <template v-if="requiredFields.memo !== null">
            <p class="mb-2 font-weight-bold">
                {{ t('common.memo_authority') }}
            </p>
            <input
                id="inputMemo"
                v-model="memopk"
                type="password"
                class="form-control mb-3 small"
                :placeholder="t('common.memo_authority_placeholder')"
                required
            >
        </template>
        <p class="my-3 font-weight-normal">
            {{ t('common.use_only_for_messages_and_proof') }}
        </p>

        <ui-grid>
            <ui-grid-cell columns="12">
                <ui-button
                    outlined
                    class="step_btn"
                    @click="emit('back')"
                >
                    {{ t('common.back_btn') }}
                </ui-button>

                <ui-button
                    v-if="accountname !== ''"
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
            </ui-grid-cell>
        </ui-grid>
    </div>
</template>
