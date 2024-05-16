import { ipcMain } from "electron";

export async function inject(blockchain, request, webContents) {
    let isBlocked = false;
    let blockedAccounts;
    let foundIDs = [];
    let regexBTS = /1.2.\d+/g;

    if (blockchain._config.identifier === "BTS") {
        // Decentralized warn list
        let stringifiedPayload = JSON.stringify(request);
        let regexMatches = stringifiedPayload.matchAll(regexBTS);
        for (const match of regexMatches) {
            foundIDs.push(match[0]);
        }

        if (foundIDs.length) {
            // Won't catch account names, only account IDs
            try {
                blockedAccounts = await blockchain.getBlockedAccounts();
            } catch (error) {
                console.log(error);
            }

            if (blockedAccounts) {
                const isBadActor = (actor) =>
                    blockedAccounts.find((x) => x === actor) ? true : false;
                isBlocked = foundIDs.some(isBadActor);
            }
        }
    }

    let visualizedParams;
    try {
        visualizedParams = await blockchain.visualize(request.payload.params);
    } catch (error) {
        console.log(error);
    }

    if (
        blockchain._config.identifier === "BTS" &&
        !isBlocked &&
        visualizedParams
    ) {
        // account names will have 1.2.x in parenthesis now - check again
        if (!blockedAccounts) {
            try {
                blockedAccounts = await blockchain.getBlockedAccounts();
            } catch (error) {
                console.log(error);
            }
        }

        let strVirtParams = JSON.stringify(visualizedParams);
        let regexMatches = strVirtParams.matchAll(regexBTS);

        for (const match of regexMatches) {
            foundIDs.push(match[0]);
        }

        if (blockedAccounts) {
            const isBadActor = (actor) =>
                blockedAccounts.find((x) => x === actor) ? true : false;
            isBlocked = foundIDs.some(isBadActor);
        }
    }

    let types = blockchain.getOperationTypes();

    let account = "";
    let visualizedAccount;
    if (["BTS", "BTS_TEST"].includes(blockchain._config.identifier)) {
        let fromField = types.find((type) => type.method === request.type).from;
        if (!fromField || !fromField.length) {
            const _account = async () => {
                return new Promise((resolve, reject) => {
                    webContents.send("getSafeAccount");
                    ipcMain.once("getSafeAccountResponse", (event, arg) => {
                        resolve(arg);
                    });
                });
            };

            account = await _account();
        } else {
            let visualizeContents = request.payload[fromField];
            try {
                visualizedAccount = await blockchain.visualize(
                    visualizeContents
                );
            } catch (error) {
                console.log(error);
            }
        }
    } else if (
        ["EOS", "BEOS", "TLOS"].includes(blockchain._config.identifier)
    ) {
        const params = request.payload.params[1];
        const _actions =
            typeof params === "string"
                ? JSON.parse(params).actions
                : params.actions;

        visualizedAccount = _actions[0].authorization[0].actor;
    }

    const _injectedCall = (
        _apiobj,
        _chain,
        _account,
        _visualizedAccount,
        _visualizedParams,
        _isBlocked,
        _blockedAccounts,
        _foundIDs
    ) => {
        return new Promise((resolve, reject) => {
            webContents.send("injectedCall", {
                request: _apiobj,
                chain: _chain,
                account: _account,
                visualizedAccount: _visualizedAccount,
                visualizedParams: _visualizedParams,
                isBlocked: _isBlocked,
                blockedAccounts: _blockedAccounts,
                foundIDs: _foundIDs,
            });
            ipcMain.once("injectedCallResponse", (event, arg) => {
                return resolve(arg);
            });
            ipcMain.once("injectedCallError", (event, error) => {
                return reject(error);
            });
        });
    };

    let injectedCallResult;
    try {
        injectedCallResult = await _injectedCall(
            request,
            blockchain._config.identifier,
            account,
            visualizedAccount,
            visualizedParams,
            isBlocked,
            blockedAccounts,
            foundIDs
        );
    } catch (error) {
        console.log({ error, location: "_injectedCall" });
    }

    return injectedCallResult;
}
