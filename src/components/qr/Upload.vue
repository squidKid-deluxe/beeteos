<script setup>
    import { ref } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { QrcodeCapture } from 'vue-qrcode-reader'

    const emit = defineEmits(['detection']);
    const { t } = useI18n({ useScope: 'global' });
    let selected = ref();
    let qrContent = ref();

    function onDecode (result) {
        if (result && result.length) {
            qrContent.value = true;
            emit('detection', result[0].rawValue);
        }
    }

    function uploadAnother () {
        qrContent.value = null;
        selected.value = null;
    }
</script>

<template>
    <span v-if="qrContent">
        <p>
            {{ t('common.qr.scan.scanned') }}
        </p>
        <ui-button @click="uploadAnother">
            {{ t('common.qr.scan.another') }}
        </ui-button>
    </span>
    <span v-else>
        <p>
            {{ t('common.qr.upload.title') }}
        </p>
        <ui-card
            v-shadow="5"
            outlined
            style="height: 45px; width: 200px; margin-left: 100px; padding-top: 10px; padding-left: 5px; padding-right: 5px; border: 1px solid #C7088E;"
        >
            <qrcode-capture
                :capture="selected"
                @detect="onDecode"
            />
        </ui-card>
    </span>
</template>
