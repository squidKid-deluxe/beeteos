const { v4: uuidv4 } = require('uuid');

const trx = {
    actions: [
        {
            account: 'eosio',
            name: 'buyrambytes',
            authorization: [{
              actor: 'useraaaaaaaa', // change to your own account
              permission: 'active',
            }],
            data: {
              payer: 'useraaaaaaaa',
              receiver: 'useraaaaaaaa',
              bytes: 8192,
            },
        }
    ]
}

const request = {
    type: "api",
    id: (async () => await uuidv4())(),
    payload: {
        method: "injectedCall",
        params: ["signAndBroadcast", JSON.stringify(trx), []],
        appName: "Static Bitshares Astro web app",
        chain: "EOS",
        browser: "web browser",
        origin: "localhost",
    },
};

let encodedPayload;
try {
    encodedPayload = encodeURIComponent(JSON.stringify(request));
} catch (error) {
    console.log(error);
}

console.log(`rawbeet://api/${encodedPayload}`);