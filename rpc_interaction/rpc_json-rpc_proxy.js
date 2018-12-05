const cfg = require("../config/config"),
    rpc = require("./rpc"),
    moment = require("moment"),
    { color: c, api_version: API_VERSION, store } = cfg,
    { redis: redis_cfg, channel } = store,
    { id: wid } = require("cluster").worker; // access to cluster.worker.id

// current module
const _module_ = "JSON-RPC-proxy controller";
// worker id pattern
const wid_ptrn = endpoint => `${c.green}worker[${wid}]${c.yellow}[${API_VERSION}]${c.cyan}[${_module_}]${c.red} > ${c.green}[${endpoint}] ${c.white}`;
const wid_err_ptrn = endpoint =>
    `${c.green}worker[${wid}]${c.yellow}[${API_VERSION}]${c.cyan}[${_module_}]
${c.red}[ERROR] ${endpoint}] ${c.white}`;

// setup RPC channel
const node_rpc_channel = channel.jrpc("master"); // connect to master channel
// init RPC channel
rpc.init(node_rpc_channel);
/*
 * RPC emitter
 * arg1 - channel
 * arg2 - payload
 * arg3 - callback
 *  */
exports.emit = payload =>
    new Promise((resolve, reject) => {
        console.log(wid_ptrn("emit payload"));
        rpc.emit(node_rpc_channel, payload, (err, data) => {
            console.log(wid_ptrn("got RPC callback"));
            if (err) {
                console.log(wid_err_ptrn(err));
                return reject(err);
            }
            resolve(data);
        });
    });

// Emit uniq request by hash
exports.emitUniq = payload =>
    new Promise((resolve, reject) => {
        console.log(wid_ptrn(`emit uniq payload by nodeHash ${payload.nodeHash}`));
        rpc.emit(node_rpc_channel, payload, (err, data) => {
            // catch RPC callbacks only with nodeHash property
            if (data.hasOwnProperty("nodeHash")) {
                console.log(wid_ptrn(`got RPC callback with hash ${data.nodeHash}`));
                if (err) {
                    console.log(wid_err_ptrn(err));
                    return reject(err);
                }
                // check IF request nodeHash = response nodeHash
                if (payload.nodeHash == data.nodeHash) resolve(data);
            }
        });
    });
