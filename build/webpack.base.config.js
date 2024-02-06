const path = require("path");
const nodeExternals = require("webpack-node-externals");
const FriendlyErrorsWebpackPlugin = require("@soda/friendly-errors-webpack-plugin");
const { VueLoaderPlugin } = require('vue-loader');

const translateEnvToMode = (env) => {
  if (env === "production") {
    return "production";
  }
  return "development";
};

module.exports = env => {
  return {
    target: "electron-renderer",
    mode: translateEnvToMode(env),
    
    node: {
      __dirname: false,
      __filename: false
    },
    
    //node: true,
    
    externals: [nodeExternals({
       //this WILL include `jquery` and `webpack/hot/dev-server` in the bundle, as well as `lodash/*`
      allowlist: ['vue','typeface-roboto','typeface-rajdhani', '@babel/runtime']
    })],
    
    resolve: {
      extensions: ['*', '.js', '*.mjs', '.vue', '.json', '.css', '.scss'],
      mainFields: ["main", "browser"],
      alias: {
        vue: "vue/dist/vue.global.js",
        mitt: 'mitt/dist/mitt.mjs',
        //"vue-router": "vue-router/dist/vue-router.global.js",
        //"balm-ui": "balm-ui/dist/balm-ui.js",
        "flatpickr": "flatpickr/dist/flatpickr.min.css",
        "balm-gui": "balm-ui/dist/balm-ui.js",
        "balm-ui-plus": "balm-ui/dist/balm-ui-plus.esm.js",
        "balm-ui-css": "balm-ui/dist/balm-ui.css",
        vue$: 'vue/dist/vue.min.js',
        env: path.resolve(__dirname, `../config/env_${env}.json`),
        '~': path.resolve(__dirname, '../src/')
      }
    },
    devtool: "source-map",
    module: {
      rules: [{
        test: /node_modules[/\\](bytebuffer)[/\\].+/,
        resolve: {
          aliasFields: ["main"]
        }
      },{
          test: /node_modules[/\\](iconv-lite)[/\\].+/,
          resolve: {
            aliasFields: ["main"]
          }
        }, {
          test: /node_modules[/\\](lzma)[/\\].+/,
          resolve: {
            aliasFields: ["browser"]
          }
        },
        {
          test: /\.vue$/,
          loader: 'vue-loader'
        },
        {
          test: /\.mjs$/,
          exclude: /node_modules/,
          type: "javascript/auto", 
        },
        // Additional rule for .js files in node_modules
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
                implementation: require("sass"),
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
        clearConsole: env === "development"
      })
    ]
  };
};
