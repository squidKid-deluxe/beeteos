/*
import { fileURLToPath } from 'url';
import path from 'path';
import nodeExternals from 'webpack-node-externals';
import FriendlyErrorsWebpackPlugin from '@soda/friendly-errors-webpack-plugin';
import { VueLoaderPlugin } from 'vue-loader';
import * as sass from 'sass';
*/

const { fileURLToPath } = require('url');
const path = require('path');
const nodeExternals = require('webpack-node-externals');
const FriendlyErrorsWebpackPlugin = require('@soda/friendly-errors-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');
const sass = require('sass');

//const _directory = path.dirname(fileURLToPath(import.meta.url));

//export default env => {
module.exports = function(env) {
    return {
        entry: {
            modal: "./src/modal.js",
            receipt: "./src/receipt.js",
            app: "./src/app.js",
        },
        output: {
            filename: "[name].js",
            path: path.resolve(__dirname, "../app"),
            chunkFormat: 'commonjs',
        },
        target: "web",
        //target: 'electron-renderer',
        mode: env === "production" ? "production" : "development",

        externals: [nodeExternals({
            allowlist: [
                'vue',
                'vuex',
                'vue-router',
                'vue-i18n',
                'dexie',
                '@intlify/shared',
                '@intlify/core-base',
                '@intlify/message-compiler',
                '@vue/devtools-api',
                'typeface-roboto',
                'typeface-rajdhani',
                '@babel/runtime'
            ]
        })],
        
        resolve: {
            extensions: ['.*', '.js', '.mjs', '.vue', '.json', '.css', '.scss'],
            mainFields: ["browser"],
            alias: {
                vue: "vue/dist/vue.esm-browser.js",
                "balm-gui": "balm-ui/dist/balm-ui.js",
                "vue-router": "vue-router/dist/vue-router.esm-browser.js",
                "balm-ui-plus": "balm-ui/dist/balm-ui-plus.js",
                "balm-ui-css": "balm-ui/dist/balm-ui.css",
                vue$: 'vue/dist/vue.min.js',
                env: path.resolve(__dirname, `../config/env_${env}.json`),
                '~': path.resolve(__dirname, '../src/')
            }
        },

        devtool: "source-map",
        
        module: {
        rules: [
            {
                test: /\.vue$/,
                loader: 'vue-loader'
            },
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                    presets: [
                        ['@babel/preset-env', { targets: "defaults" }]
                    ]
                    }
                }
            },
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"]
            },
            {
                test: /\.s[ac]ss$/i,
                use: [
                    // Creates `style` nodes from JS strings
                    "style-loader",
                    // Translates CSS into CommonJS
                    "css-loader",
                    // Compiles Sass to CSS
                    {
                    loader: "sass-loader",
                    options: {
                        // Prefer `dart-sass`
                        implementation: sass,
                    },
                    },
                ]
            },
            {
                test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
                type: 'asset/resource',
                dependency: { not: ['url'] }
            }
        ]
        },
    
        plugins: [
        new VueLoaderPlugin(),
        new FriendlyErrorsWebpackPlugin({
            clearConsole: env === "development",
            onErrors: function (severity, errors) {
                console.log({severity, errors})
            },
        })
        ]
    };
};
