/*
 * RPC module
 * - RPC interaction with services [Auth, json-rpc-proxy, node-manager]
 * */
const cfg = require("../config/config"),
    { color: c, api_version: API_VERSION, store } = cfg,
    { redis: redis_cfg, channel } = store,
    { id: wid } = require("cluster").worker; // access to cluster.worker.id

// current module
const _module_ = "RPC interaction module";
// worker id pattern
const wid_ptrn = endpoint => `${c.green}worker[${wid}]${c.red}[${_module_}]${c.yellow}[${API_VERSION}]${c.red} > ${c.green}[${endpoint}] ${c.white}`;
const wid_err_ptrn = endpoint =>
    `${c.green}worker[${wid}]${c.red}[${_module_}]${c.yellow}[${API_VERSION}]
${c.red}[ERROR] ${endpoint}] ${c.white}`;

/** simple RPC behavior constructor */
const redisRpc = require("node-redis-rpc");
const rpc = new redisRpc(redis_cfg);
let node_rpc_channel;
let auth_channel;
let jrpc_channel;
let nm_channel;

// init rpc channels
exports.init = channel => {
    if (/jrpc:/.test(channel)) jrpc_channel = channel;
    if (/auth:/.test(channel)) auth_channel = channel;
    if (/nm:/.test(channel)) nm_channel = channel;
    node_rpc_channel = channel;
};

// exports RPC emitter
exports.emit = (channel, payload, callback) => {
    console.log(wid_ptrn(`send payload to service ${channel}`), "\n", payload);
    /* Trigger an event on the channel "node_rpc:<wid>"
     *  arg1 - channel
     *  arg2 - msg data JSON
     *  arg3 - options + cb (register a callback handler to be executed when the rpc result returns)
     * */
    rpc.emit(
        channel,
        { payload: payload },
        {
            type: "rpc", // trigger an event of type "rpc"
            callback: callback // register a callback handler to be executed when the rpc result returns
        }
    );
    // reqTimeout(channel); // reg Error callback timeout
};
