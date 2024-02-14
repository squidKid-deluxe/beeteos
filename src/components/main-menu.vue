<script setup>
    import { ref, computed } from 'vue';
    import { useI18n } from 'vue-i18n';

    import router from '../router/index.js';
    import store from '../store/index.js';
    import langSelect from "./lang-select.vue";

    let open = ref(false);
    let lastIndex = ref(0);
    const { t } = useI18n({ useScope: 'global' });

    let items = computed(() => {
        return [
            {
                text: t("common.actionBar.Home"),
                index: 0,
                icon: "home",
                url: "/dashboard"
            },
            {
                text: t("common.actionBar.New"),
                index: 1,
                icon: "add",
                url: "/add-account"
            },
            {
                text: t("common.actionBar.WWW"),
                index: 2,
                icon: "web",
                url: "/www"
            },
            {
                text: t("common.actionBar.TOTP"),
                index: 3,
                icon: "generating_tokens",
                url: "/totp"
            },
            {
                text: t("common.actionBar.Local"),
                index: 4,
                icon: "upload",
                url: "/local"
            },
            {
                text: t("common.actionBar.RAW"),
                index: 5,
                icon: "raw_on",
                url: "/raw-link"
            },
            {
                text: t("common.actionBar.QR"),
                index: 6,
                icon: "qr_code_2",
                url: "/qr"
            },
            {
                text: t("common.actionBar.dapps"),
                index: 7,
                icon: "app_registration",
                url: "/dapps"
            },
            {
                text: t("common.actionBar.Backup"),
                index: 8,
                icon: "download",
                url: "/backup"
            },
            {
                text: t("common.actionBar.Logout"),
                index: 9,
                icon: "logout",
                url: "/"
            }
        ]
    });

    function onChange(data) {
        const newIndex = data.index;
        if (
            lastIndex.value &&
            lastIndex.value === 2 && // WWW
            newIndex !== 2 // leaving WWW
        ) {
            console.log("Automatically shutting down web services");
            window.electron.closeServer();
        }
        lastIndex.value = newIndex;

        if (data.index === 9) {
            console.log('logout')
            store.dispatch("WalletStore/logout");
            router.replace("/");
        }

        router.replace(items.value[data.index].url);
    }

    window.electron.timeout(() => {
        console.log('wallet timed logout');
        if (lastIndex.value && lastIndex.value === 2) {
            window.electron.closeServer();
        }
        store.dispatch("WalletStore/logout");
        router.replace("/");
    });
</script>

<template>
    <div>
        <ui-menu-anchor
            absolute
            position="BOTTOM_START"
        >
            <ui-fab
                style="margin-bottom: 10px;"
                icon="menu"
                mini
                @click="open = true"
            />
            <langSelect location="small" />

            <ui-menu
                v-model="open"
                style="border: 1px solid #C7088E;"
                position="BOTTOM_START"
                @selected="onChange"
            >
                <ui-menuitem
                    v-for="item in items"
                    :key="item.icon"
                    nested
                >
                    <ui-menuitem
                        v-if="lastIndex === item.index"
                        selected
                    >
                        <ui-menuitem-icon dark>
                            <ui-icon style="color: #707070;">
                                {{ item.icon }}
                            </ui-icon>
                        </ui-menuitem-icon>
                        <ui-menuitem-text>{{ item.text }}</ui-menuitem-text>
                    </ui-menuitem>
                    <ui-menuitem v-else>
                        <ui-menuitem-icon dark>
                            <ui-icon
                                dark
                                style="visibility: visible;"
                            >
                                {{ item.icon }}
                            </ui-icon>
                        </ui-menuitem-icon>
                        <ui-menuitem-text>{{ item.text }}</ui-menuitem-text>
                    </ui-menuitem>
                </ui-menuitem>
            </ui-menu>
        </ui-menu-anchor>
    </div>
</template>
