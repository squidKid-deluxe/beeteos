<script setup>
    import { ref, onMounted } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { QrcodeStream } from 'vue-qrcode-reader'

    const { t } = useI18n({ useScope: 'global' });
    const emit = defineEmits(['detection']);

    let camera = ref('auto');
    let paused = ref(false);

    let cameraInitializing = ref(false);
    let cameraError = ref();
    let videoDevices = ref();

    function onCameraOn () {
        cameraInitializing.value = true;
    }

    function onCameraOff () {
        cameraInitializing.value = false;
    }

    function onError (error) {
        console.log(error)
        paused.value = true;
        cameraError.value = true;
        cameraInitializing.value = false;
    }

    let QRresult = ref();
    /**
     * Parsing the contents of the scanned QR code
     * @param {String} content
     */
    async function onDetect (detectedBarcodes) {
        if (!QRresult.value && detectedBarcodes.length > 0) {
            await timeout(1000);
            QRresult.value = detectedBarcodes[0].rawValue;
            paused.value = true;
            emit('detection', detectedBarcodes[0].rawValue);
        }
    }

    /**
     * Try to switch between front/back camera
     * If camera is off -> turn it on
     */
    async function switchCamera () {
        if (camera.value === 'off') {
            console.log('turning on camera')
            camera.value = 'auto'
            cameraInitializing.value = false;
            cameraError.value = undefined;
            QRresult.value = undefined;
        } else if (camera.value === 'auto') {
            console.log('setting to front')
            camera.value = 'front'
        } else if (camera.value === 'front') {
            console.log('setting to rear')
            camera.value = 'rear'
        } else {
            camera.value = 'front'
        }
    }

    /**
     * Overlaying branding on detected qr
     * @param {Array} detectedCodes
     * @param {Canvas} ctx
     */
    function paintQR (detectedCodes, ctx) {
        for (const detectedCode of detectedCodes) {
            const [ firstPoint, ...otherPoints ] = detectedCode.cornerPoints

            ctx.textAlign = "center"
            var img = document.getElementById("beetScan");
            ctx.drawImage(img, firstPoint.x + 25, firstPoint.y + 10);
        }

        for (const detectedCode of detectedCodes) {
            const [ firstPoint, ...otherPoints ] = detectedCode.cornerPoints

            ctx.strokeStyle = "#C7088E";

            ctx.beginPath();
            ctx.moveTo(firstPoint.x, firstPoint.y);
            for (const { x, y } of otherPoints) {
                ctx.lineTo(x, y);
            }
            ctx.lineTo(firstPoint.x, firstPoint.y);
            ctx.closePath();
            ctx.stroke();
        }
    }

    /**
     * Waiting to paint branding
     * @param {Number} ms 
     */
    function timeout (ms) {
        return new Promise(resolve => {
            window.setTimeout(resolve, ms)
        })
    }

    onMounted(async () => {
        let enumeratedDevices = await navigator.mediaDevices.enumerateDevices();
        videoDevices.value = enumeratedDevices.filter(device => device.kind === 'videoinput');
    });
</script>

<template>
    <div>
        <span
            v-if="!QRresult && camera !== 'off' && !cameraError"
            style="height: 300px;"
        >
            <p>
                {{ t('common.qr.scan.title') }}
            </p>
            <div style="display: flex; justify-content: center;">
                <ui-card
                    v-shadow="5"
                    outlined
                    style="height: 300px; width: 300px; border: 1px solid #C7088E;"
                >
                    <qrcode-stream
                        :camera="camera"
                        :track="paintQR"
                        class="qrcode-stream-wrapper"
                        @camera-on="onCameraOn"
                        @camera-off="onCameraOff"
                        @error="onError"
                        @detect="onDetect"
                    >
                        <span v-if="cameraInitializing">
                            <ui-spinner
                                style="padding-top: 65px;"
                                active
                            />
                        </span>

                        <div style="display:none;">
                            <img
                                id="beetScan"
                                src="img/beetSmall.png"
                            >
                        </div>

                        <video
                            class="qrcode-stream-camera"
                            autoplay
                            playsinline
                            object-fit="cover"
                        />
                    </qrcode-stream>
                </ui-card>
            </div>
            <ui-button
                v-if="videoDevices && videoDevices.length > 1"
                @click="switchCamera"
            >
                {{ t('common.qr.scan.switch') }}
            </ui-button>
        </span>
        <span v-else>
            <span v-if="cameraError">
                <p>
                    {{ t('common.qr.scan.initFail') }}
                </p>
                <ui-button @click="switchCamera">
                    {{ t('common.qr.scan.again') }}
                </ui-button>
            </span>
            <span v-else>
                <p>
                    {{ t('common.qr.scan.scanned') }}
                </p>
                <ui-button @click="switchCamera">
                    {{ t('common.qr.scan.another') }}
                </ui-button>
            </span>

        </span>
    </div>
</template>

<style>
.qrcode-stream-wrapper {
    max-width: 300px;
    max-height: 300px;
    overflow: hidden;
}

.qrcode-stream-camera {
    width: 100%;
    height: 100%;
}
</style>