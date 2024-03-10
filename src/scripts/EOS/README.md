# Readme

These scripts enable you to easily craft multi-operation transactions for EOS based blockchains.

Edit the contents of the `trx` actions array to reference your accounts, and to perform the actions you want.

For more info on how to construct an EOS blockchain based operation, [check these docs](https://github.com/EOSIO/eosjs/tree/master/docs/how-to-guides), and check out the [EOS beautify file](https://github.com/beetapp/beeteos/blob/master/src/lib/blockchains/EOS/beautify.js) to check the supported operations and their expected parameters.

## Pre-requisites

Install node.js on your computer, consider using [nvm](https://github.com/nvm-sh/nvm#install--update-script) to do so, unless you'd prefer to [install it via a package manger](https://nodejs.org/en/download/package-manager).

Once installed, launch a terminal command prompt and navigate to the BeetEOS folder and enter the following command:
```
npm install
```

This will install the required package dependencies for these scripts to run properly.

Once the packages are installed, navigate to this EOS script folder, then for example run the following command:
```
node ./buyrambytes.js
```

This will output the raw deeplink in your console window like the following:
```
rawbeeteos://api?chain=EOS&request=DATA
```

Copy the entire URL and paste it into a web browser URL bar & hit enter.

The web browser should now prompt you to "open electron", do so and your BeetEOS wallet will process the prompt and launch a prompt for you to verify the contents of the multi action transaction, which if approved will attempt to broadcast the operation.

If you requested a receipt but it doesn't show, then that means your operation was not successfully broadcast onto your blockchain of choice.

If your prompt doesn't show, then your actions are likely misconfigured, go over them again and if sure [raise an issue]([text](https://github.com/beetapp/beeteos/issues)).

You can debug issues by pressing the "alt" key in the wallet, then in the nav bar select "view", "dev tools", "console", to get to the full blockchain error.