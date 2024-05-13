import { blockchains } from "../../config/config.js";

import BitShares from "./BitShares.js";
import EOSmainnet from "./EOSmainnet.js";
import TLOS from "./TLOS.js";
import BEOS from "./BEOS.js";

let storedChain;
let lastChain;

export default function getBlockchainAPI(chain = null, node = null) {
    if (!lastChain) {
        lastChain = chain;
    } else if (lastChain && lastChain !== chain) {
        console.log("Switching blockchain!");
        storedChain = undefined;
        lastChain = chain;
    }

    let config;
    try {
        config = blockchains[chain];
    } catch (error) {
        console.log(error);
        return;
    }

    if (!storedChain) {
        try {
            if (chain === "EOS") {
                storedChain = new EOSmainnet(config, node);
            } else if (chain === "BEOS") {
                storedChain = new BEOS(config, node);
            } else if (chain === "TLOS") {
                storedChain = new TLOS(config, node);
            } else if (chain === "BTS" || chain === "BTS_TEST") {
                storedChain = new BitShares(config, node);
            }
        } catch (error) {
            console.log(error);
            return;
        }
    }

    return storedChain;
}
