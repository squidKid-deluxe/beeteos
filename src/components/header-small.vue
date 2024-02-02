<script setup>
    import MainMenu from "./main-menu.vue";
</script>

<template>
    <div class="top">
        <ui-grid class="container-fluid">
            <ui-grid-cell
                class="smallHeader"
                columns="6"
            >
                <MainMenu />
            </ui-grid-cell>

            <ui-grid-cell
                class="smallHeader"
                columns="12"
            >
                <img
                    class="logo-small"
                    src="img/beet.png"
                    alt
                >
                <h4 class="h4 beet-typo-small">
                    BeetEOS
                </h4>
            </ui-grid-cell>
        </ui-grid>
    </div>
</template>
