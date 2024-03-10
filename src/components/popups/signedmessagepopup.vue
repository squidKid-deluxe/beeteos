<script setup>
    import { computed } from "vue";
    import { useI18n } from 'vue-i18n';

    const { t } = useI18n({ useScope: 'global' });

    const props = defineProps({
        request: {
            type: Object,
            required: true,
            default() {
                return {}
            }
        },
        accounts: {
            type: Array,
            required: true,
            default() {
                return []
            }
        }
    });

    let textFieldContents = computed(() => {
        return JSON.stringify(JSON.parse(props.request.payload.params), undefined, 4)
    });

    let requestText = computed(() => {
        if (!props.request || !props.accounts) {
            return '';
        }
        return t("operations.message.request", {
            appName: props.request.payload.appName,
            origin: props.request.payload.origin,
            chain: props.accounts[0].chain,
            accountName: props.accounts[0].accountName
        });
    });

    function _clickedAllow() {
        window.electron.clickedAllow({
            result: {
                success: true
            },
            request: {
                id: props.request.id
            }
        });
    }

    function _clickedDeny() {
        window.electron.clickedDeny({
            result: {
                canceled: true
            },
            request: {
                id: props.request.id
            }
        });
    }
</script>

<template>
    <div style="padding:5px">
        {{ requestText }}
        <ui-textfield
            v-model="textFieldContents"
            input-type="textarea"
            fullwidth
            disabled
            rows="5"
        />
        <br>
        <ui-button
            raised
            style="margin-right:5px"
            @click="_clickedAllow()"
        >
            {{ t("operations.message.accept_btn") }}
        </ui-button>
        <ui-button
            raised
            @click="_clickedDeny()"
        >
            {{ t("operations.message.reject_btn") }}
        </ui-button>
    </div>
</template>
