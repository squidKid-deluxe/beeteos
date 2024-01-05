import { defineConfig } from "vite";
import path from "node:path";
import electron from "vite-plugin-electron/simple";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [
    vue(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: "electron/background.js",
        vite: {
          build: {
            rollupOptions: {
              input: {
                main: path.join(__dirname, "index.html"),
                modal: path.join(__dirname, "modal.html"),
                receipt: path.join(__dirname, "receipt.html"),
              },
              external: ["~/lib/applicationMenu", "~/lib/SecureRemote", "~/lib/Actions"],
              output: {
                // Provide global variables to use in the UMD build
                // for externalized deps
                globals: {
                  vue: "Vue",
                },
              },
            },
          },
        },
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__dirname, "electron/preload.ts"),
      },
      // Ployfill the Electron and Node.js built-in modules for Renderer process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      vue: "vue/dist/vue.esm-bundler.js",
      "balm-ui-plus": "balm-ui/dist/balm-ui-plus.esm.js",
      "balm-ui-css": "balm-ui/dist/balm-ui.css",
    },
  },
  build: {
    rollupOptions: {
      external: ["electron"],
    },
  },
});
