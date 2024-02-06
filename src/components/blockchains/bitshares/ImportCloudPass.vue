<script setup>
    import { ref, onMounted } from "vue";
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

    onMounted(() => {
        if (!["BTS", "BTS_TEST", "TUSC"].includes(props.chain)) {
            throw "Unsupported chain!";
        }
    })

    let accountname = ref("");
    let cloud_pass = ref("");
    let legacy = ref(false);

    let inProgress = ref();
    let errorOcurred = ref();

    async function next() {
        inProgress.value = true;
        errorOcurred.value = false;

        let blockchainResponse;
        try {
            blockchainResponse = await window.electron.blockchainRequest({
                methods: ["verifyCloudAccount"],
                accountname: accountname.value,
                pass: cloud_pass.value,
                legacy: legacy.value,
                chain: props.chain
            });
        } catch (error) {
            console.log(error);
            console.log("Account verification error, check your cloud account password and try again");
            errorOcurred.value = true;
            inProgress.value = false;
            return;
        }

        if (!blockchainResponse || !blockchainResponse.verifyCloudAccount) {
            console.log("Account verification error, check your cloud account password and try again");
            errorOcurred.value = true;
            inProgress.value = false;
            return;
        }

        console.log("Account verified");
        cloud_pass.value = "";
        inProgress.value = false;
        emit('continue');
        emit('imported', [{
            account: {
                accountName: accountname.value,
                accountID: blockchainResponse.verifyCloudAccount.id,
                chain: props.chain,
                keys: blockchainResponse.verifyCloudAccount.authorities
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
            :placeholder="t('common.account_name',{ 'chain' : chain})"
            required
        >
        <p class="my-3 font-weight-normal">
            {{ t('common.btspass_cta') }}
        </p>
        <input
            id="inputActive"
            v-model="cloud_pass"
            type="password"
            class="form-control mb-3 small"
            :placeholder="t('common.btspass_placeholder')"
            required
        >
        <br>
        <br>
        <ui-form-field>
            <ui-checkbox v-model="legacy" />
            <label>Legacy key mode</label>
        </ui-form-field>
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
                    v-if="accountname !== '' && cloud_pass !== '' && !inProgress && !errorOcurred"
                    raised
                    class="step_btn"
                    type="submit"
                    @click="next"
                >
                    {{ t('common.next_btn') }}
                </ui-button>
                <span v-if="accountname !== '' && cloud_pass !== '' && errorOcurred">
                    <ui-button
                        raised
                        class="step_btn"
                        type="submit"
                        @click="next"
                    >
                        {{ t('common.next2_btn') }}
                    </ui-button>
                    <br>
                    <ui-alert state="warning">
                        {{ t('common.error_text') }}
                    </ui-alert>
                </span>
                <figure v-if="accountname !== '' && cloud_pass !== '' && inProgress">
                    <ui-progress indeterminate />
                    <br>
                    <figcaption>Connecting to blockchain</figcaption>
                </figure>
                <ui-button
                    v-if="accountname === '' || cloud_pass === ''"
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
