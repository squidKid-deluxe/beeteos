# Introduction

Interacting with any blockchain can be cumbersome if you are not familiar with how a blockchain works (private keys and signatures) and haven't dug through the plentiful features that each blockchain offers.

In general, every action on a blockchain requires a cryptographic signature of the required private keys for the action, and when you are using third party tools (especially closed source ones), the question about trust quickly arises ("Are they gonna steal my private keys?").

BeetEOS aims to solve these trust concerns, whilst additionally facilitating private key managament for the everyday EOS/Bitshares based blockchain user.

A general rule of thumb for the inexperienced: Never ever expose your private keys on the internet, and if that is ever needed, stay vigilant and do your due diligence.

# BeetEOS - Your Bitshares & EOS blockchain companion

BeetEOS is a locally installed stand-alone key and identity manager and signing app for both Bitshares and EOS based blockchains, heavily influenced by the [Beet](https://github.com/bitshares/beet) and [Scatter](https://github.com/GetScatter) wallets.

BeetEOS allows separate account management while being in full control of what data to expose to third parties.

Private keys are locally stored and encrypted, protected by a wallet master password.

All transactions suggested by third parties must be confirmed before being broadcast.

Telegram channel: https://t.me/beetapp

## Features / User Guide

On first run, you will be prompted to create a new wallet to hold your keys. You pick a name for the wallet,
enter your first account / address (in the case of BitShares that is the account name, active and memo private keys) and select a password to protect your wallet (AES encrypted). You can add several accounts
of different chains to one wallet.

The app will generate your public keys from those private keys and verify them against the ones stored on-chain for the account name / address you provided. Depending on the blockchain you are adding different import options are available.

Once your keys and account are verified, you will be redirected to the dashboard view which currently displays your account details and balances.

While logged-in, BeetEOS can optionally create a local socket.io server which can only be accessed by applications running on your computer (internet browser or any other third party application installed on your computer),
as long as it includes our client-side javascript library [BeeteosJS](https://github.com/beetapp/beeteos-js).

BeeteosJS allows any web-page to send requests to BeetEOS in order to retrieve identity (account id / address) or ask for an action to be taken (sign a transaction, vote or others).
Of-course, any incoming request has to be **explicitly** approved by the user inside the BeetEOS app and is clearly displayed.

The EOS blockchain has their own native javascript library that can be used (e.g. [eosjs](https://github.com/EOSIO/eosjs)) with BeetEOS. BeeteosJS can be injected into said native library to redirect all signature and broadcast requests to BeetEOS, i.e. you can simply use the native javascript library and inject BeetEOSJS when starting your application, and voila, BeetEOS is integrated.

The Bitshares blockchain also has [its own native javascript library](https://github.com/bitshares/bitsharesjs/) which can be used with BeetEOS. BeetEOSJS can similarly be injected into bitsharesjs to redirect important requests to BeetEOS.

The wallet now also supports deeplinks, encrypted deeplinks, qr codes and local json files for generating blockchain request prompts for approval & broadcast with the BeetEOS wallet. These input methods do not require external packages, and can be stored for later use.

Supported blockchains: Bitshares, Bitshares testnet, EOS, BEOS, TLOS.

## For end users

Releases are bundled as installers and are available at https://github.com/beetapp/beeteos/releases

    ATTENTION

BeetEOS binaries will never be hosted anywhere but within GitHub releases. If you find Beet binaries anywhere else, it is likely a phishing attempt.

## For developers

BeetEOS is an [electron-based app](https://www.electronjs.org) for [cross-platform compatibility](https://www.electron.build), utilising the [VueJS framework](https://blog.vuejs.org/posts/vue-3-as-the-new-default.html), [BalmUI design system](https://material.balmjs.com) and the [Socket.IO](https://socket.io) libraries.

To run BeetEOS it's simply a case of

```bash
# clone
git clone https://github.com/beetapp/beeteos
cd beeteos

# install dependencies
npm install

# start Beet
npm run start
```

If you are in linux you may need to do: `sudo apt-get install libudev-dev` before start BeetEOS.

## Current Limitations

BeetEOS currently only supports single-signature accounts (one private key to unlock the blockchain action), and depending on the blockchain different import options may be available.

Please open an issue to add support for your desired way.

## Encountered an issue? Want a new feature?

Open a [new issue](https://github.com/beetapp/beeteos/issues/) on github.

If you're skilled in Vue, electron or even just want to help localize the wallet, then fork the repo, create a new branch for your idea/task and submit a pull request for peer review.
