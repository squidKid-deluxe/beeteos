/*
import { fileURLToPath } from 'url';
import path from 'path';
import nodeExternals from 'webpack-node-externals';
import FriendlyErrorsWebpackPlugin from '@soda/friendly-errors-webpack-plugin';
*/

const { fileURLToPath } = require('url');
const path = require('path');
const nodeExternals = require('webpack-node-externals');
const FriendlyErrorsWebpackPlugin = require('@soda/friendly-errors-webpack-plugin');

//const _directory = path.dirname(fileURLToPath(import.meta.url));

//export default env => {
module.exports = function(env) {
    return {
        target: 'electron-main',
        entry: {
            background: "./src/background.js",
        },
        output: {
            filename: "[name].js",
            path: path.resolve(__dirname, "../app"),
        },
        mode: env === "production" ? "production" : "development",
        node: {
        __dirname: false,
        __filename: false
        },
            
        //externals: [],
        externals: [nodeExternals({
            //this WILL include `jquery` and `webpack/hot/dev-server` in the bundle, as well as `lodash/*`
            allowlist: ['@babel/runtime']
        })],

        resolve: {
            extensions: ['.js', '.json'],
            mainFields: ["main"],
            alias: {
                env: path.resolve(__dirname, `../config/env_${env}.json`),
                '~': path.resolve(__dirname, '../src/')
            }
        },

        devtool: "source-map",
        
        module: {
            rules: [
                {
                    test: /node_modules[/\\](bytebuffer)[/\\].+/,
                    resolve: {
                        aliasFields: ["main"]
                    }
                },
                {
                    test: /node_modules[/\\](lzma)[/\\].+/,
                    resolve: {
                        aliasFields: ["main"]
                    }
                }
            ]
        },

        /*
        module: {
        rules: [{
                test: /node_modules[/\\](bytebuffer)[/\\].+/,
                resolve: {
                    aliasFields: ["main"]
                }
            },
            {
                test: /node_modules[/\\](lzma)[/\\].+/,
                resolve: {
                    aliasFields: ["browser"]
                }
            },
            {
                test: /node_modules[/\\](iconv-lite)[/\\].+/,
                resolve: {
                    aliasFields: ["main"]
                }
            },
            {
                test: /\.js$/,
                include: /node_modules/,
                type: "javascript/auto",
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
