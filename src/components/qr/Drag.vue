<script setup>
    import { ref, inject } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { QrcodeDropZone } from 'vue-qrcode-reader'

    const emitter = inject('emitter');

    const { t } = useI18n({ useScope: 'global' });
    let result = ref();
    let error = ref();
    let dragover = ref(false);

    /**
     * Dragged image QR attempt
     * @param {Promise} promise 
     */
    async function onDetect (promise) {
        let detectedQR;
        try {
            detectedQR = await promise
        } catch (error) {
            if (error.name === 'DropImageFetchError') {
                error.value = t('common.qr.drag.error1')
            } else if (error.name === 'DropImageDecodeError') {
                error.value = t('common.qr.drag.error2')
            } else {
                error.value = t('common.qr.drag.error3')
            }
        }
      
        if (detectedQR && detectedQR.content) {
            error.value = null;
            result.value = true;
            emitter.emit('detectedQR', detectedQR.content);
        }
    }

    /**
     * @param {Boolean} isDraggingOver 
     */
    function onDragOver (isDraggingOver) {
        dragover.value = isDraggingOver;
    }

    /**
     * @param {Promise} promise 
     */
    function logErrors (promise) {
        promise.catch((error) => {console.log(error)});
    }

    function tryAgain() {
        result.value = null;
        error.value = null;
    }
</script>

<template>
    <div>
        <span v-if="result && !error">
            <p>
                {{ t('common.qr.drag.successPrompt') }}
            </p>           
            <ui-button @click="tryAgain">
                {{ t('common.qr.drag.successBtn') }}
            </ui-button>
        </span>
        <span v-else-if="!result && error">
            <ui-alert
                state="warning"
                closable
            >
                {{ error }}
            </ui-alert>           
            <ui-button @click="tryAgain">
                {{ t('common.qr.drag.successBtn') }}
            </ui-button>
        </span>
        <span v-else>
            <p>
                {{ t('common.qr.drag.title') }}
            </p>

            <ui-card
                v-shadow="5"
                outlined
                style="height: 100px; width: 200px; margin-left: 115px; border: 1px solid #C7088E;"
            >
                <qrcode-drop-zone
                    @detect="onDetect"
                    @dragover="onDragOver"
                    @init="logErrors"
                >
                    <div
                        class="drop-area"
                        style="height: 100px; width: 200px; padding-top: 40px;"
                        :class="{ 'dragover': dragover }"
                    >
                        {{ t('common.qr.drag.prompt') }}
                    </div>
                </qrcode-drop-zone>
            </ui-card>
        </span>
    </div>
</template>
