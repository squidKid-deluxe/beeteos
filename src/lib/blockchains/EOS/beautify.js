//import { humanReadableFloat } from "../../assetUtils.js";

const allowedOperations = [
    "setalimits",
    "setacctram",
    "setacctnet",
    "setacctcpu",
    "activate",
    "delegatebw",
    "setrex",
    "deposit",
    "withdraw",
    "buyrex",
    "unstaketorex",
    "sellrex",
    "cnclrexorder",
    "rentcpu",
    "rentnet",
    "fundcpuloan",
    "fundnetloan",
    "defcpuloan",
    "defnetloan",
    "updaterex",
    "transfer",
    "rexexec",
    "consolidate",
    "mvtosavings",
    "mvfrsavings",
    "closerex",
    "undelegatebw",
    "buyram",
    "buyrambytes",
    "sellram",
    "refund",
    "regproducer",
    "unregprod",
    "setram",
    "setramrate",
    "voteproducer",
    "regproxy",
    "setparams",
    "claimrewards",
    "setpriv",
    "rmvproducer",
    "updtrevision",
    "bidname",
    "bidrefund",
    "ramtransfer",
];

/**
 * Convert an array of operations into a readable format
 * @param {Object} operation
 * @returns
 */
export default async function beautify(operation) {
    if (!operation || !operation.name) {
        return;
    }

    const opType = operation.name;

    if (!allowedOperations.includes(opType)) {
        return;
    }

    const currentOperation = {
        title: `operations.injected.EOS.${opType}.title`,
        opType: opType,
        method: opType,
        op: operation,
        operation: operation,
    };

    if (opType === "transfer") {
        /**
         * Transferring tokens action.
         *
         * @details Transfer tokens from account to account.
         *
         * @param from - the account to transfer from,
         * @param to - the account to be transferred to,
         * @param quantity - the quantity of tokens to be transferred,
         * @param memo - the memo for the transfer (optional)
         */
        const from = operation.data.from;
        const to = operation.data.to;
        const quantity = operation.data.quantity;
        const memo = operation.data.memo;
        currentOperation["rows"] = [
            { key: "from", params: { from: from } },
            { key: "to", params: { to: to } },
            { key: "quantity", params: { quantity: quantity } },
            { key: "memo", params: { memo: memo ?? "" } },
        ];
    } else if (opType === "setalimits") {
        /**
         * Set account limits action.
         *
         * @details Set the resource limits of an account
         *
         * @param account - name of the account whose resource limit to be set,
         * @param ram_bytes - ram limit in absolute bytes,
         * @param net_weight - fractionally proportionate net limit of available resources based on (weight / total_weight_of_all_accounts),
         * @param cpu_weight - fractionally proportionate cpu limit of available resources based on (weight / total_weight_of_all_accounts).
         */
        const account = operation.data.account;
        const ram_bytes = operation.data.ram_bytes;
        const net_weight = operation.data.net_weight;
        const cpu_weight = operation.data.cpu_weight;
        currentOperation["rows"] = [
            { key: "account", params: { account: account } },
            { key: "ram_bytes", params: { ram_bytes: ram_bytes } },
            { key: "net_weight", params: { net_weight: net_weight } },
            { key: "cpu_weight", params: { cpu_weight: cpu_weight } },
        ];
    } else if (opType === "setacctram") {
        /**
         * Set account RAM limits action.
         *
         * @details Set the RAM limits of an account
         *
         * @param account - name of the account whose resource limit to be set,
         * @param ram_bytes - ram limit in absolute bytes.
         */
        const account = operation.data.account;
        const ram_bytes = operation.data.ram_bytes;
        currentOperation["rows"] = [
            { key: "account", params: { account: account } },
            { key: "ram_bytes", params: { ram_bytes: ram_bytes } },
        ];
    } else if (opType === "setacctnet") {
        /**
         * Set account NET limits action.
         *
         * @details Set the NET limits of an account
         *
         * @param account - name of the account whose resource limit to be set,
         * @param net_weight - fractionally proportionate net limit of available resources based on (weight / total_weight_of_all_accounts).
         */
        const account = operation.data.account;
        const net_weight = operation.data.net_weight;
        currentOperation["rows"] = [
            { key: "account", params: { account: account } },
            { key: "net_weight", params: { net_weight: net_weight } },
        ];
    } else if (opType === "setacctcpu") {
        /**
         * Set account CPU limits action.
         *
         * @details Set the CPU limits of an account
         *
         * @param account - name of the account whose resource limit to be set,
         * @param cpu_weight - fractionally proportionate cpu limit of available resources based on (weight / total_weight_of_all_accounts).
         */
        const account = operation.data.account;
        const cpu_weight = operation.data.cpu_weight;
        currentOperation["rows"] = [
            { key: "account", params: { account: account } },
            { key: "cpu_weight", params: { cpu_weight: cpu_weight } },
        ];
    } else if (opType === "activate") {
        /**
         * Activates a protocol feature.
         *
         * @details Activates a protocol feature
         *
         * @param feature_digest - hash of the protocol feature to activate.
         */
        const feature_digest = operation.data.feature_digest;
        currentOperation["rows"] = [
            {
                key: "feature_digest",
                params: { feature_digest: feature_digest },
            },
        ];
    } else if (opType === "delegatebw") {
        // functions defined in delegate_bandwidth.cpp

        /**
         * Delegate bandwidth and/or cpu action.
         *
         * @details Stakes SYS from the balance of `from` for the benefit of `receiver`.
         *
         * @param from - the account to delegate bandwidth from, that is, the account holding
         *    tokens to be staked,
         * @param receiver - the account to delegate bandwith to, that is, the account to
         *    whose resources staked tokens are added
         * @param stake_net_quantity - tokens staked for NET bandwidth,
         * @param stake_cpu_quantity - tokens staked for CPU bandwidth,
         * @param transfer - if true, ownership of staked tokens is transfered to `receiver`.
         *
         * @post All producers `from` account has voted for will have their votes updated immediately.
         */
        const from = operation.data.from;
        const receiver = operation.data.receiver;
        const stake_net_quantity = operation.data.stake_net_quantity;
        const stake_cpu_quantity = operation.data.stake_cpu_quantity;
        const transfer = operation.data.transfer;
        currentOperation["rows"] = [
            { key: "from", params: { from: from } },
            { key: "receiver", params: { receiver: receiver } },
            {
                key: "stake_net_quantity",
                params: { stake_net_quantity: stake_net_quantity },
            },
            {
                key: "stake_cpu_quantity",
                params: { stake_cpu_quantity: stake_cpu_quantity },
            },
            { key: "transfer", params: { transfer: transfer } },
        ];
    } else if (opType === "setrex") {
        /**
         * Setrex action.
         *
         * @details Sets total_rent balance of REX pool to the passed value.
         * @param balance - amount to set the REX pool balance.
         */
        const balance = operation.data.balance;
        currentOperation["rows"] = [
            { key: "balance", params: { balance: balance } },
        ];
    } else if (opType === "deposit") {
        /**
         * Deposit to REX fund action.
         *
         * @details Deposits core tokens to user REX fund.
         * All proceeds and expenses related to REX are added to or taken out of this fund.
         * An inline transfer from 'owner' liquid balance is executed.
         * All REX-related costs and proceeds are deducted from and added to 'owner' REX fund,
         *    with one exception being buying REX using staked tokens.
         * Storage change is billed to 'owner'.
         *
         * @param owner - REX fund owner account,
         * @param amount - amount of tokens to be deposited.
         */
        const owner = operation.data.owner;
        const amount = operation.data.amount;
        currentOperation["rows"] = [
            { key: "owner", params: { owner: owner } },
            { key: "amount", params: { amount: amount } },
        ];
    } else if (opType === "withdraw") {
        /**
         * Withdraw from REX fund action.
         *
         * @details Withdraws core tokens from user REX fund.
         * An inline token transfer to user balance is executed.
         *
         * @param owner - REX fund owner account,
         * @param amount - amount of tokens to be withdrawn.
         */
        const owner = operation.data.owner;
        const amount = operation.data.amount;
        currentOperation["rows"] = [
            { key: "owner", params: { owner: owner } },
            { key: "amount", params: { amount: amount } },
        ];
    } else if (opType === "buyrex") {
        /**
         * Buyrex action.
         *
         * @details Buys REX in exchange for tokens taken out of user's REX fund by transfering
         * core tokens from user REX fund and converts them to REX stake. By buying REX, user is
         * lending tokens in order to be rented as CPU or NET resourses.
         * Storage change is billed to 'from' account.
         *
         * @param from - owner account name,
         * @param amount - amount of tokens taken out of 'from' REX fund.
         *
         * @pre A voting requirement must be satisfied before action can be executed.
         * @pre User must vote for at least 21 producers or delegate vote to proxy before buying REX.
         *
         * @post User votes are updated following this action.
         * @post Tokens used in purchase are added to user's voting power.
         * @post Bought REX cannot be sold before 4 days counting from end of day of purchase.
         */
        const from = operation.data.from;
        const amount = operation.data.amount;
        currentOperation["rows"] = [
            { key: "from", params: { from: from } },
            { key: "amount", params: { amount: amount } },
        ];
    } else if (opType === "unstaketorex") {
        /**
         * Unstaketorex action.
         *
         * @details Use staked core tokens to buy REX.
         * Storage change is billed to 'owner' account.
         *
         * @param owner - owner of staked tokens,
         * @param receiver - account name that tokens have previously been staked to,
         * @param from_net - amount of tokens to be unstaked from NET bandwidth and used for REX purchase,
         * @param from_cpu - amount of tokens to be unstaked from CPU bandwidth and used for REX purchase.
         *
         * @pre A voting requirement must be satisfied before action can be executed.
         * @pre User must vote for at least 21 producers or delegate vote to proxy before buying REX.
         *
         * @post User votes are updated following this action.
         * @post Tokens used in purchase are added to user's voting power.
         * @post Bought REX cannot be sold before 4 days counting from end of day of purchase.
         */
        const owner = operation.data.owner;
        const receiver = operation.data.receiver;
        const from_net = operation.data.from_net;
        const from_cpu = operation.data.from_cpu;
        currentOperation["rows"] = [
            { key: "owner", params: { owner: owner } },
            { key: "receiver", params: { receiver: receiver } },
            { key: "from_net", params: { from_net: from_net } },
            { key: "from_cpu", params: { from_cpu: from_cpu } },
        ];
    } else if (opType === "sellrex") {
        /**
         * Sellrex action.
         *
         * @details Sells REX in exchange for core tokens by converting REX stake back into core tokens
         * at current exchange rate. If order cannot be processed, it gets queued until there is enough
         * in REX pool to fill order, and will be processed within 30 days at most. If successful, user
         * votes are updated, that is, proceeds are deducted from user's voting power. In case sell order
         * is queued, storage change is billed to 'from' account.
         *
         * @param from - owner account of REX,
         * @param rex - amount of REX to be sold.
         */
        const from = operation.data.from;
        const rex = operation.data.rex;
        currentOperation["rows"] = [
            { key: "from", params: { from: from } },
            { key: "rex", params: { rex: rex } },
        ];
    } else if (opType === "cnclrexorder") {
        /**
         * Cnclrexorder action.
         *
         * @details Cancels unfilled REX sell order by owner if one exists.
         *
         * @param owner - owner account name.
         *
         * @pre Order cannot be cancelled once it's been filled.
         */
        const owner = operation.data.owner;
        currentOperation["rows"] = [{ key: "owner", params: { owner: owner } }];
    } else if (opType === "rentcpu") {
        /**
         * Rentcpu action.
         *
         * @details Use payment to rent as many SYS tokens as possible as determined by market price and
         * stake them for CPU for the benefit of receiver, after 30 days the rented core delegation of CPU
         * will expire. At expiration, if balance is greater than or equal to `loan_payment`, `loan_payment`
         * is taken out of loan balance and used to renew the loan. Otherwise, the loan is closed and user
         * is refunded any remaining balance.
         * Owner can fund or refund a loan at any time before its expiration.
         * All loan expenses and refunds come out of or are added to owner's REX fund.
         *
         * @param from - account creating and paying for CPU loan, 'from' account can add tokens to loan
         *    balance using action `fundcpuloan` and withdraw from loan balance using `defcpuloan`
         * @param receiver - account receiving rented CPU resources,
         * @param loan_payment - tokens paid for the loan, it has to be greater than zero,
         *    amount of rented resources is calculated from `loan_payment`,
         * @param loan_fund - additional tokens can be zero, and is added to loan balance.
         *    Loan balance represents a reserve that is used at expiration for automatic loan renewal.
         */
        const from = operation.data.from;
        const receiver = operation.data.receiver;
        const loan_payment = operation.data.loan_payment;
        const loan_fund = operation.data.loan_fund;
        currentOperation["rows"] = [
            { key: "from", params: { from: from } },
            { key: "receiver", params: { receiver: receiver } },
            { key: "loan_payment", params: { loan_payment: loan_payment } },
            { key: "loan_fund", params: { loan_fund: loan_fund } },
        ];
    } else if (opType === "rentnet") {
        /**
         * Rentnet action.
         *
         * @details Use payment to rent as many SYS tokens as possible as determined by market price and
         * stake them for NET for the benefit of receiver, after 30 days the rented core delegation of NET
         * will expire. At expiration, if balance is greater than or equal to `loan_payment`, `loan_payment`
         * is taken out of loan balance and used to renew the loan. Otherwise, the loan is closed and user
         * is refunded any remaining balance.
         * Owner can fund or refund a loan at any time before its expiration.
         * All loan expenses and refunds come out of or are added to owner's REX fund.
         *
         * @param from - account creating and paying for NET loan, 'from' account can add tokens to loan
         *    balance using action `fundnetloan` and withdraw from loan balance using `defnetloan`,
         * @param receiver - account receiving rented NET resources,
         * @param loan_payment - tokens paid for the loan, it has to be greater than zero,
         *    amount of rented resources is calculated from `loan_payment`,
         * @param loan_fund - additional tokens can be zero, and is added to loan balance.
         *    Loan balance represents a reserve that is used at expiration for automatic loan renewal.
         */
        const from = operation.data.from;
        const receiver = operation.data.receiver;
        const loan_payment = operation.data.loan_payment;
        const loan_fund = operation.data.loan_fund;
        currentOperation["rows"] = [
            { key: "from", params: { from: from } },
            { key: "receiver", params: { receiver: receiver } },
            { key: "loan_payment", params: { loan_payment: loan_payment } },
            { key: "loan_fund", params: { loan_fund: loan_fund } },
        ];
    } else if (opType === "fundcpuloan") {
        /**
         * Fundcpuloan action.
         *
         * @details Transfers tokens from REX fund to the fund of a specific CPU loan in order to
         * be used for loan renewal at expiry.
         *
         * @param from - loan creator account,
         * @param loan_num - loan id,
         * @param payment - tokens transfered from REX fund to loan fund.
         */
        const from = operation.data.from;
        const loan_num = operation.data.loan_num;
        const payment = operation.data.payment;
        currentOperation["rows"] = [
            { key: "from", params: { from: from } },
            { key: "loan_num", params: { loan_num: loan_num } },
            { key: "payment", params: { payment: payment } },
        ];
    } else if (opType === "fundnetloan") {
        /**
         * Fundnetloan action.
         *
         * @details Transfers tokens from REX fund to the fund of a specific NET loan in order to
         * be used for loan renewal at expiry.
         *
         * @param from - loan creator account,
         * @param loan_num - loan id,
         * @param payment - tokens transfered from REX fund to loan fund.
         */
        const from = operation.data.from;
        const loan_num = operation.data.loan_num;
        const payment = operation.data.payment;
        currentOperation["rows"] = [
            { key: "from", params: { from: from } },
            { key: "loan_num", params: { loan_num: loan_num } },
            { key: "payment", params: { payment: payment } },
        ];
    } else if (opType === "defcpuloan") {
        /**
         * Defcpuloan action.
         *
         * @details Withdraws tokens from the fund of a specific CPU loan and adds them to REX fund.
         *
         * @param from - loan creator account,
         * @param loan_num - loan id,
         * @param amount - tokens transfered from CPU loan fund to REX fund.
         */
        const from = operation.data.from;
        const loan_num = operation.data.loan_num;
        const amount = operation.data.amount;
        currentOperation["rows"] = [
            { key: "from", params: { from: from } },
            { key: "loan_num", params: { loan_num: loan_num } },
            { key: "amount", params: { amount: amount } },
        ];
    } else if (opType === "defnetloan") {
        /**
         * Defnetloan action.
         *
         * @details Withdraws tokens from the fund of a specific NET loan and adds them to REX fund.
         *
         * @param from - loan creator account,
         * @param loan_num - loan id,
         * @param amount - tokens transfered from NET loan fund to REX fund.
         */
        const from = operation.data.from;
        const loan_num = operation.data.loan_num;
        const amount = operation.data.amount;
        currentOperation["rows"] = [
            { key: "from", params: { from: from } },
            { key: "loan_num", params: { loan_num: loan_num } },
            { key: "amount", params: { amount: amount } },
        ];
    } else if (opType === "updaterex") {
        /**
         * Updaterex action.
         *
         * @details Updates REX owner vote weight to current value of held REX tokens.
         *
         * @param owner - REX owner account.
         */

        const owner = operation.data.owner;
        currentOperation["rows"] = [{ key: "owner", params: { owner: owner } }];
    } else if (opType === "rexexec") {
        /**
         * Rexexec action.
         *
         * @details Processes max CPU loans, max NET loans, and max queued sellrex orders.
         * Action does not execute anything related to a specific user.
         *
         * @param user - any account can execute this action,
         * @param max - number of each of CPU loans, NET loans, and sell orders to be processed.
         */
        const user = operation.data.user;
        const max = operation.data.max;
        currentOperation["rows"] = [
            { key: "user", params: { user: user } },
            { key: "max", params: { max: max } },
        ];
    } else if (opType === "consolidate") {
        /**
         * Consolidate action.
         *
         * @details Consolidates REX maturity buckets into one bucket that can be sold after 4 days
         * starting from the end of the day.
         *
         * @param owner - REX owner account name.
         */
        const owner = operation.data.owner;
        currentOperation["rows"] = [{ key: "owner", params: { owner: owner } }];
    } else if (opType === "mvtosavings") {
        /**
         * Mvtosavings action.
         *
         * @details Moves a specified amount of REX into savings bucket. REX savings bucket
         * never matures. In order for it to be sold, it has to be moved explicitly
         * out of that bucket. Then the moved amount will have the regular maturity
         * period of 4 days starting from the end of the day.
         *
         * @param owner - REX owner account name.
         * @param rex - amount of REX to be moved.
         */
        const owner = operation.data.owner;
        const rex = operation.data.rex;
        currentOperation["rows"] = [
            { key: "owner", params: { owner: owner } },
            { key: "rex", params: { rex: rex } },
        ];
    } else if (opType === "mvfrsavings") {
        /**
         * Mvfrsavings action.
         *
         * @details Moves a specified amount of REX out of savings bucket. The moved amount
         * will have the regular REX maturity period of 4 days.
         *
         * @param owner - REX owner account name.
         * @param rex - amount of REX to be moved.
         */
        const owner = operation.data.owner;
        const rex = operation.data.rex;
        currentOperation["rows"] = [
            { key: "owner", params: { owner: owner } },
            { key: "rex", params: { rex: rex } },
        ];
    } else if (opType === "closerex") {
        /**
         * Closerex action.
         *
         * @details Deletes owner records from REX tables and frees used RAM. Owner must not have
         * an outstanding REX balance.
         *
         * @param owner - user account name.
         *
         * @pre If owner has a non-zero REX balance, the action fails; otherwise,
         *    owner REX balance entry is deleted.
         * @pre If owner has no outstanding loans and a zero REX fund balance,
         *    REX fund entry is deleted.
         */
        const owner = operation.data.owner;
        currentOperation["rows"] = [{ key: "owner", params: { owner: owner } }];
    } else if (opType === "undelegatebw") {
        /**
         * Undelegate bandwitdh action.
         *
         * @details Decreases the total tokens delegated by `from` to `receiver` and/or
         * frees the memory associated with the delegation if there is nothing
         * left to delegate.
         * This will cause an immediate reduction in net/cpu bandwidth of the
         * receiver.
         * A transaction is scheduled to send the tokens back to `from` after
         * the staking period has passed. If existing transaction is scheduled, it
         * will be canceled and a new transaction issued that has the combined
         * undelegated amount.
         * The `from` account loses voting power as a result of this call and
         * all producer tallies are updated.
         *
         * @param from - the account to undelegate bandwidth from, that is,
         *    the account whose tokens will be unstaked,
         * @param receiver - the account to undelegate bandwith to, that is,
         *    the account to whose benefit tokens have been staked,
         * @param unstake_net_quantity - tokens to be unstaked from NET bandwidth,
         * @param unstake_cpu_quantity - tokens to be unstaked from CPU bandwidth,
         *
         * @post Unstaked tokens are transferred to `from` liquid balance via a
         *    deferred transaction with a delay of 3 days.
         * @post If called during the delay period of a previous `undelegatebw`
         *    action, pending action is canceled and timer is reset.
         * @post All producers `from` account has voted for will have their votes updated immediately.
         * @post Bandwidth and storage for the deferred transaction are billed to `from`.
         */
        const from = operation.data.from;
        const receiver = operation.data.receiver;
        const unstake_net_quantity = operation.data.unstake_net_quantity;
        const unstake_cpu_quantity = operation.data.unstake_cpu_quantity;
        currentOperation["rows"] = [
            { key: "from", params: { from: from } },
            { key: "receiver", params: { receiver: receiver } },
            {
                key: "unstake_net_quantity",
                params: { unstake_net_quantity: unstake_net_quantity },
            },
            {
                key: "unstake_cpu_quantity",
                params: { unstake_cpu_quantity: unstake_cpu_quantity },
            },
        ];
    } else if (opType === "buyram") {
        /**
         * Buy ram action.
         *
         * @details Increases receiver's ram quota based upon current price and quantity of
         * tokens provided. An inline transfer from receiver to system contract of
         * tokens will be executed.
         *
         * @param payer - the ram buyer,
         * @param receiver - the ram receiver,
         * @param quant - the quntity of tokens to buy ram with.
         */
        const payer = operation.data.payer;
        const receiver = operation.data.receiver;
        const quant = operation.data.quant;
        currentOperation["rows"] = [
            { key: "payer", params: { payer: payer } },
            { key: "receiver", params: { receiver: receiver } },
            { key: "quant", params: { quant: quant } },
        ];
    } else if (opType === "buyrambytes") {
        /**
         * Buy a specific amount of ram bytes action.
         *
         * @details Increases receiver's ram in quantity of bytes provided.
         * An inline transfer from receiver to system contract of tokens will be executed.
         *
         * @param payer - the ram buyer,
         * @param receiver - the ram receiver,
         * @param bytes - the quntity of ram to buy specified in bytes.
         */
        const payer = operation.data.payer;
        const receiver = operation.data.receiver;
        const bytes = operation.data.bytes;
        currentOperation["rows"] = [
            { key: "payer", params: { payer: payer } },
            { key: "receiver", params: { receiver: receiver } },
            { key: "bytes", params: { bytes: bytes } },
        ];
    } else if (opType === "sellram") {
        /**
         * Sell ram action.
         *
         * @details Reduces quota by bytes and then performs an inline transfer of tokens
         * to receiver based upon the average purchase price of the original quota.
         *
         * @param account - the ram seller account,
         * @param bytes - the amount of ram to sell in bytes.
         */
        const account = operation.data.account;
        const bytes = operation.data.bytes;
        currentOperation["rows"] = [
            { key: "account", params: { account: account } },
            { key: "bytes", params: { bytes: bytes } },
        ];
    } else if (opType === "refund") {
        /**
         * Refund action.
         *
         * @details This action is called after the delegation-period to claim all pending
         * unstaked tokens belonging to owner.
         *
         * @param owner - the owner of the tokens claimed.
         */
        const owner = operation.data.owner;
        currentOperation["rows"] = [{ key: "owner", params: { owner: owner } }];
    } else if (opType === "regproducer") {
        // functions defined in voting.cpp

        /**
         * Register producer action.
         *
         * @details Register producer action, indicates that a particular account wishes to become a producer,
         * this action will create a `producer_config` and a `producer_info` object for `producer` scope
         * in producers tables.
         *
         * @param producer - account registering to be a producer candidate,
         * @param producer_key - the public key of the block producer, this is the key used by block producer to sign blocks,
         * @param url - the url of the block producer, normally the url of the block producer presentation website,
         * @param location - is the country code as defined in the ISO 3166, https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes
         *
         * @pre Producer is not already registered
         * @pre Producer to register is an account
         * @pre Authority of producer to register
         */
        const producer = operation.data.producer;
        const producer_key = operation.data.producer_key;
        const url = operation.data.url;
        const location = operation.data.location;
        currentOperation["rows"] = [
            { key: "producer", params: { producer: producer } },
            { key: "producer_key", params: { producer_key: producer_key } },
            { key: "url", params: { url: url } },
            { key: "location", params: { location: location } },
        ];
    } else if (opType === "unregprod") {
        /**
         * Unregister producer action.
         *
         * @details Deactivate the block producer with account name `producer`.
         * @param producer - the block producer account to unregister.
         */
        const producer = operation.data.producer;
        currentOperation["rows"] = [
            { key: "producer", params: { producer: producer } },
        ];
    } else if (opType === "setram") {
        /**
         * Set ram action.
         *
         * @details Set the ram supply.
         * @param max_ram_size - the amount of ram supply to set.
         */
        const max_ram_size = operation.data.max_ram_size;
        currentOperation["rows"] = [
            { key: "max_ram_size", params: { max_ram_size: max_ram_size } },
        ];
    } else if (opType === "setramrate") {
        /**
         * Set ram rate action.

        * @details Sets the rate of increase of RAM in bytes per block. It is capped by the uint16_t to
        * a maximum rate of 3 TB per year. If update_ram_supply hasn't been called for the most recent block,
        * then new ram will be allocated at the old rate up to the present block before switching the rate.
        *
        * @param bytes_per_block - the amount of bytes per block increase to set.
        */
        const bytes_per_block = operation.data.bytes_per_block;
        currentOperation["rows"] = [
            {
                key: "bytes_per_block",
                params: { bytes_per_block: bytes_per_block },
            },
        ];
    } else if (opType === "voteproducer") {
        /**
         * Vote producer action.
         *
         * @details Votes for a set of producers. This action updates the list of `producers` voted for,
         * for `voter` account. If voting for a `proxy`, the producer votes will not change until the
         * proxy updates their own vote. Voter can vote for a proxy __or__ a list of at most 30 producers.
         * Storage change is billed to `voter`.
         *
         * @param voter - the account to change the voted producers for,
         * @param proxy - the proxy to change the voted producers for,
         * @param producers - the list of producers to vote for, a maximum of 30 producers is allowed.
         *
         * @pre Producers must be sorted from lowest to highest and must be registered and active
         * @pre If proxy is set then no producers can be voted for
         * @pre If proxy is set then proxy account must exist and be registered as a proxy
         * @pre Every listed producer or proxy must have been previously registered
         * @pre Voter must authorize this action
         * @pre Voter must have previously staked some EOS for voting
         * @pre Voter->staked must be up to date
         *
         * @post Every producer previously voted for will have vote reduced by previous vote weight
         * @post Every producer newly voted for will have vote increased by new vote amount
         * @post Prior proxy will proxied_vote_weight decremented by previous vote weight
         * @post New proxy will proxied_vote_weight incremented by new vote weight
         */
        const voter = operation.data.voter;
        const proxy = operation.data.proxy;
        const producers = JSON.stringify(operation.data.producers, 2);
        currentOperation["rows"] = [
            { key: "voter", params: { voter: voter } },
            { key: "proxy", params: { proxy: proxy } },
            { key: "producers", params: { producers: producers } },
        ];
    } else if (opType === "regproxy") {
        /**
         * Register proxy action.
         *
         * @details Set `proxy` account as proxy.
         * An account marked as a proxy can vote with the weight of other accounts which
         * have selected it as a proxy. Other accounts must refresh their voteproducer to
         * update the proxy's weight.
         * Storage change is billed to `proxy`.
         *
         * @param rpoxy - the account registering as voter proxy (or unregistering),
         * @param isproxy - if true, proxy is registered; if false, proxy is unregistered.
         *
         * @pre Proxy must have something staked (existing row in voters table)
         * @pre New state must be different than current state
         */
        const proxy = operation.data.proxy;
        const isproxy = operation.data.isproxy;
        currentOperation["rows"] = [
            { key: "proxy", params: { proxy: proxy } },
            { key: "isproxy", params: { isproxy: isproxy } },
        ];
    } else if (opType === "setparams") {
        /**
         * Set the blockchain parameters
         *
         * @details Set the blockchain parameters. By tunning these parameters a degree of
         * customization can be achieved.
         * @param params - New blockchain parameters to set.
         */
        const params = JSON.stringify(operation.data.params, null, 2);
        currentOperation["rows"] = [
            {
                key: "params",
                params: { params: JSON.stringify(params, null, 2) },
            },
        ];
    } else if (opType === "claimrewards") {
        // functions defined in producer_pay.cpp
        /**
         * Claim rewards action.
         *
         * @details Claim block producing and vote rewards.
         * @param owner - producer account claiming per-block and per-vote rewards.
         */
        const owner = operation.data.owner;
        currentOperation["rows"] = [{ key: "owner", params: { owner: owner } }];
    } else if (opType === "setpriv") {
        /**
         * Set privilege status for an account.
         *
         * @details Allows to set privilege status for an account (turn it on/off).
         * @param account - the account to set the privileged status for.
         * @param is_priv - 0 for false, > 0 for true.
         */
        const account = operation.data.account;
        const is_priv = operation.data.is_priv;
        currentOperation["rows"] = [
            { key: "account", params: { account: account } },
            { key: "is_priv", params: { is_priv: is_priv } },
        ];
    } else if (opType === "rmvproducer") {
        /**
         * Remove producer action.
         *
         * @details Deactivates a producer by name, if not found asserts.
         * @param producer - the producer account to deactivate.
         */
        const producer = operation.data.producer;
        currentOperation["rows"] = [
            { key: "producer", params: { producer: producer } },
        ];
    } else if (opType === "updtrevision") {
        /**
         * Update revision action.
         *
         * @details Updates the current revision.
         * @param revision - it has to be incremented by 1 compared with current revision.
         *
         * @pre Current revision can not be higher than 254, and has to be smaller
         * than or equal 1 (“set upper bound to greatest revision supported in the code”).
         */
        const revision = operation.data.revision;
        currentOperation["rows"] = [
            { key: "revision", params: { revision: revision } },
        ];
    } else if (opType === "bidname") {
        /**
         * Bid name action.
         *
         * @details Allows an account `bidder` to place a bid for a name `newname`.
         * @param bidder - the account placing the bid,
         * @param newname - the name the bid is placed for,
         * @param bid - the amount of system tokens payed for the bid.
         *
         * @pre Bids can be placed only on top-level suffix,
         * @pre Non empty name,
         * @pre Names longer than 12 chars are not allowed,
         * @pre Names equal with 12 chars can be created without placing a bid,
         * @pre Bid has to be bigger than zero,
         * @pre Bid's symbol must be system token,
         * @pre Bidder account has to be different than current highest bidder,
         * @pre Bid must increase current bid by 10%,
         * @pre Auction must still be opened.
         */
        const bidder = operation.data.bidder;
        const newname = operation.data.newname;
        const bid = operation.data.bid;
        currentOperation["rows"] = [
            { key: "bidder", params: { bidder: bidder } },
            { key: "newname", params: { newname: newname } },
            { key: "bid", params: { bid: bid } },
        ];
    } else if (opType === "bidrefund") {
        /**
         * Bid refund action.
         *
         * @details Allows the account `bidder` to get back the amount it bid so far on a `newname` name.
         *
         * @param bidder - the account that gets refunded,
         * @param newname - the name for which the bid was placed and now it gets refunded for.
         */
        const bidder = operation.data.bidder;
        const newname = operation.data.newname;
        currentOperation["rows"] = [
            { key: "bidder", params: { bidder: bidder } },
            { key: "newname", params: { newname: newname } },
        ];
    } else if (opType === "ramtransfer") {
        /**
         * Ram transfer action.
         *
         * @details Allows an account `from` to transfer ram to another account `to`.
         *
         * @param from - the account sending ram,
         * @param to - the account receiving ram,
         * @param bytes - the amount of ram to be sent.
         */
        const from = operation.data.from;
        const to = operation.data.to;
        const bytes = operation.data.bytes;
        currentOperation["rows"] = [
            { key: "from", params: { from: from } },
            { key: "to", params: { to: to } },
            { key: "bytes", params: { bytes: bytes } },
        ];
    }

    return currentOperation;
}
