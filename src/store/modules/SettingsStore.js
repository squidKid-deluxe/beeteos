import {
    defaultLocale
} from '../../config/i18n.js'
import BeetDB from '../../lib/BeetDB.js';

const LOAD_SETTINGS = 'LOAD_SETTINGS';

const mutations = {
    [LOAD_SETTINGS] (state, settings) {
        state.settings = settings;
    }
};

const actions = {
    loadSettings({
        commit
    }) {
        return new Promise(async (resolve, reject) => {
            try {
                BeetDB.settings.get({id: 'settings'}).then((settings) => {
                    if (settings && settings.length > 0) {
                        commit(LOAD_SETTINGS, JSON.parse(settings));
                    } else {
                        BeetDB.settings.put({id: 'settings', value: JSON.stringify(initialState.settings)}).then(() => {
                            commit(LOAD_SETTINGS, JSON.parse(initialState.settings));
                        })
                    }
                });
                resolve();
            } catch (error) {
                console.log(error)
                reject();
            }
        });
    },
    setNode({
        commit
    }, payload) {
        return new Promise(async (resolve, reject) => {

            BeetDB.settings.get({id: 'settings'}).then((settings) => {
                if (settings && settings.length > 0) {
                    settings = JSON.parse(settings)
                } else {
                    settings = initialState.settings;
                }
  
                // backwards compatibility
                if (typeof settings.selected_node === "string") {
                    settings.selected_node = {}
                }
  
                try {
                  settings.selected_node[payload.chain] = payload.node;
                } catch (error) {
                  console.log(`setNode: ${error}`)
                }
                BeetDB.settings.put({id: 'settings', value: JSON.stringify(settings)}).then(() => {
                    commit(LOAD_SETTINGS, settings);
                    resolve();
                })
            }).catch((error) => {
                console.log(`setNode: ${error}`)
                reject(error);
            });
        });
    },
    setLocale({
        commit
    }, payload) {
        return new Promise(async (resolve, reject) => {

            BeetDB.settings.get({id: 'settings'}).then((settings) => {
                if (settings && settings.length > 0) {
                    settings = JSON.parse(settings)
                } else {
                    settings = initialState.settings;
                }

                settings.locale = payload.locale;

                BeetDB.settings.put({id: 'settings', value: JSON.stringify(settings)}).then(() => {
                    commit(LOAD_SETTINGS, settings);
                    resolve();
                })
            }).catch((error) => {
                console.log(`setLocale: ${error}`)
                reject(error);
            });
        });
    },
    /**
     * 
     * @param {Object} payload
     */
    setChainPermissions({
        commit
    }, payload) {
        return new Promise(async (resolve, reject) => {
            BeetDB.settings.get({id: 'settings'}).then((settings) => {
                if (settings && settings.length > 0) {
                    settings = JSON.parse(settings)
                } else {
                    settings = initialState.settings;
                }
    
                if (!settings.hasOwnProperty('chainPermissions')) {
                    settings['chainPermissions'] = {
                        BTS: [],
                        BTS_TEST: [],
                        EOS: [],
                        BEOS: [],
                        TLOS: []
                    }
                }
                settings.chainPermissions[payload.chain] = payload.rows;
                BeetDB.settings.put({id: 'settings', value: JSON.stringify(settings)}).then(() => {
                    commit(LOAD_SETTINGS, settings);
                    resolve();
                })
            }).catch((error) => {
                console.log(`setChainPermissions: ${error}`)
                reject(error);
            });
        });
    }
}


const getters = {
    getNode: (state) => state.settings.selected_node,
    getLocale: (state) => state.settings.locale,
    getChainPermissions: (state) => (chain) => {
        if (!state.settings.hasOwnProperty('chainPermissions')) {
            return [];
        }
        return state.settings.chainPermissions[chain];
    }
};

const initialState = {
    settings: {
        locale: defaultLocale,
        selected_node: {},
        chainPermissions: {
            BTS: [],
            BTS_TEST: [],
            EOS: [],
            BEOS: [],
            TLOS: [],
            BTC: [],
            BTC_TEST: []
        }
    }
};

export default {
    namespaced: true,
    state: initialState,
    actions,
    mutations,
    getters,
};
