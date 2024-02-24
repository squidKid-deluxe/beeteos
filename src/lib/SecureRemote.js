import * as secp from "@noble/secp256k1";
import sha256 from "crypto-js/sha256.js";

class proover {
    constructor() {
        this.regen();
    }

    async regen() {
        this.key = secp.utils.randomPrivateKey();
        let pubk;
        try {
          pubk = await secp.getPublicKey(this.key);
        } catch (error) {
          console.error(error);
          return;
        }
        this.pubk = pubk;
    }

    async sign(data) {
        let msgHash;
        try {
          msgHash = await sha256(data).toString();
        } catch (error) {
          console.log(error);
          return;
        }

        let signedMessage;
        try {
          signedMessage = await secp.sign(
            msgHash,
            this.key,
            {der: true, extraEntropy: true}
          )
        } catch (error) {
          console.log(error);
          return;
        }

        return {
          signedMessage: signedMessage,
          msgHash: msgHash,
          pubk: this.pubk
        };
    }
}

const proof = new proover();

export const getSignature = async (data) => {
  let signature;
  try {
    signature = await proof.sign(data);
  } catch (error) {
    console.log(error);
    return;
  }

  return signature;
}