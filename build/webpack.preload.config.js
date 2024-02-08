/*
import { fileURLToPath } from 'url';
import path from 'path';
import FriendlyErrorsWebpackPlugin from '@soda/friendly-errors-webpack-plugin';
*/

const { fileURLToPath } = require('url');
const path = require('path');
const FriendlyErrorsWebpackPlugin = require('@soda/friendly-errors-webpack-plugin');

//const _directory = path.dirname(fileURLToPath(import.meta.url));

//export default env => {
module.exports = function(env) {
    return {
        entry: {
            preload: "./src/preload.js",
        },
        output: {
            filename: "[name].js",
            path: path.resolve(__dirname, "../app"),
        },
        target: 'electron-preload',
        mode: env === "production" ? "production" : "development",
        
        node: {
            __dirname: false,
            __filename: false
        },
            
        externals: [],
        
        resolve: {
            extensions: ['.*', '.js'],
            mainFields: ["preload"],
            alias: {
                env: path.resolve(__dirname, `../config/env_${env}.json`),
                '~': path.resolve(__dirname, '../src/')
            }
        },

        devtool: "source-map",
        /*
        module: {
        rules: [
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
        ]
        },
        */
    
        plugins: [
            new FriendlyErrorsWebpackPlugin({
                clearConsole: env === "development",
                onErrors: function (severity, errors) {
                    // You can listen to errors transformed and prioritized by the plugin
                    // severity can be 'error' or 'warning'
                    console.log({severity, errors})
                },
            })
        ]
    };
};
