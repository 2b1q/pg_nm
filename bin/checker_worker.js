const cfg = require("../config/config"),
    { color: c, nodes: nodes_from_file } = cfg,
    worker = require("cluster").worker,
    { bootstrapNodes, getLastBlocks } = require("../modules/node_management/interface");
// { emit: nodeRequest} = require("../rpc_interaction/rpc_json-rpc_proxy");

const worker_name = "Node Checker";
// worker pattern
const cmd_ptrn = cmd => `${c.cyan}worker[${c.yellow}${worker_name}${c.cyan}] exec cmd [${c.magenta}${cmd}${c.cyan}]${c.white}`;
const cmd_done = (cmd, status) =>
    `${c.cyan}worker[${c.yellow}${worker_name}${c.cyan}] cmd [${c.magenta}${cmd}${c.cyan}] completed!
    ${c.green}Status: "${status}"${c.white}`;
const cmd_fail = (cmd, err) => `${c.cyan}worker[${c.yellow}${worker_name}${c.red}] cmd [${c.magenta}${cmd}${c.red} FAIL! Error:\n${err}${c.white}`;
// response RPC msg
const _msg = {
    error: null,
    msg: null,
    worker: worker_name,
    to: "master_rpc" // default MSG go to master
};

/*
 * Checker Bootstrap controller
 * load NODE CFG from config.js to MongoDB
 * */
const bootstrap = () =>
    new Promise((resolve, reject) => {
        console.log(cmd_ptrn("bootstrapping node configs"));
        // bootstrap node config
        const bootstrapped_nodes = {};
        Object.keys(nodes_from_file).forEach(type => {
            if (!bootstrapped_nodes[type + "_nodes"]) bootstrapped_nodes[type + "_nodes"] = [];
            bootstrapped_nodes[type + "_nodes"].push({
                type: type,
                status: "bootstrapping...",
                nodeHash: "",
                lastBlock: 0,
                updateTime: new Date(), // UTC
                config: nodes_from_file[type]
            });
        });
        console.log("bootstrapping nodes:\n", bootstrapped_nodes);
        bootstrapNodes(bootstrapped_nodes)
            .then(status => {
                console.log(cmd_done("bootstrapNodes", status));
                resolve(status);
            })
            .catch(err => reject(err));
    });

/*
 * get Best node executor with DB behavior
 * */
const getBestNode = node_type =>
    new Promise((resolve, reject) => {
        console.log(cmd_ptrn("getBestNode"));
        if (node_type === "btc") {
            setTimeout(() => resolve("BTC CFFFG"), 2000);
        } else reject("Bad node type");
    });

/*
 * check nodes executor with redis RPC behavior
 * */
const checkNodes = () =>
    new Promise((resolve, reject) => {
        console.log(cmd_ptrn("checkNodes"));
        getLastBlocks().then(() => resolve("OK"));
        // // simple LTC checker
        // nodeRequest({
        //     node_type: "ltc",
        //     method: "getblockcount"
        // }).then(response => resolve(response));
    });

/*
 * common MSG handler entry point
 * */
exports.sendMsg = msg => {
    console.log(`${c.cyan}worker[${c.yellow}${worker_name}${c.cyan}] handle message${c.white}\n`, msg);
    let { cmd, params, from } = msg;
    if (cmd === "bootstrap")
        bootstrap()
            .then(result => {
                _msg.msg = result;
                worker.send(_msg);
            })
            .catch(e => {
                _msg.error = e;
                worker.send(_msg);
            });

    if (cmd === "check")
        checkNodes()
            .then(result => {
                console.log("CHECK result:\n", result);
                let {
                    node_type,
                    msg: { result: lastBlock }
                } = result;
                console.log("UPSERT result to DB: ", { node_type, lastBlock });
            })
            .catch(err => cmd_fail("checkNodes", err));
};
