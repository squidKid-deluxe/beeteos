import {
    PrivateKey,
    PublicKey,
    Aes
} from "bitsharesjs";
import {
    decompress
} from "lzma";

class BTSWalletHandler {

    constructor(backup) {
        this.wallet_buffer = Buffer.from(backup, "binary");
    }

    unlock(wallet_pass) {
        try {
            this.wallet_pass = wallet_pass;
            let private_key = PrivateKey.fromSeed(this.wallet_pass);
            let public_key = PublicKey.fromBuffer(this.wallet_buffer.slice(0, 33));
            this.wallet_buffer = this.wallet_buffer.slice(33);
            this.wallet_buffer = Aes.decrypt_with_checksum(
                private_key,
                public_key,
                null /*nonce*/ ,
                this.wallet_buffer
            );
            let wallet_string = decompress(this.wallet_buffer);
            this.wallet_object = JSON.parse(wallet_string);
            let password_aes = Aes.fromSeed(this.wallet_pass);
            let encryption_plainbuffer = password_aes.decryptHexToBuffer(
                this.wallet_object.wallet[0].encryption_key
            );
            this.aes_private = Aes.fromSeed(encryption_plainbuffer);
            this.keypairs = [];
            for (let i = 0; i < this.wallet_object.private_keys.length; i++) {
                let private_key_hex = this.aes_private.decryptHex(
                    this.wallet_object.private_keys[i].encrypted_key
                );
                let pkey = PrivateKey.fromBuffer(Buffer.from(private_key_hex, "hex"));
                let keypair = {
                    'priv': pkey.toWif(),
                    'pub': this.wallet_object.private_keys[i].pubkey
                };
                this.keypairs.push(keypair);
            }
            this.public = [];
            this.keypairs.forEach(keypair => {
                this.public.push(keypair.pub);
            });
            return true;
        } catch (e) {
            throw new Error('Could not decrypt wallet');
        }
    }
}
export default BTSWalletHandler;
