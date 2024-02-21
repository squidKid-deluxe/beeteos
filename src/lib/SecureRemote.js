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

export const getKey = async (enc_key) => {
    return new Promise(async (resolve, reject) => {
        window.electron.removeAllListeners('decrypt_success');
        window.electron.removeAllListeners('decrypt_fail');

        window.electron.onceSuccessfullyDecrypted((arg) => {
            console.log('decrypt_success')
            resolve(arg);
        })

        window.electron.onceFailedToDecrypt((arg) => {
            console.log('decrypt_fail')
            reject('decrypt_fail');
        });

        let signature = await getSignature('decrypt');
        if (!signature) {
          console.log('Signature failure')
          reject('signature failure');
        }

        let isValid;
        try {
          isValid = await secp.verify(
            signature.signedMessage,
            signature.msgHash,
            signature.pubk
          );
        } catch (error) {
          console.log(error);
        }

        if (isValid) {
          console.log("Was valid, proceeding to decrypt");
          ipcRenderer.send('decrypt', {data: enc_key});
        } else {
          console.log('invalid signature')
          reject('invalid signature');
        }
    })
}

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
