const cfg = require("../config/config"),
    { color: c } = cfg,
    worker = require("cluster").worker;

const worker_name = "Node Checker";
// worker pattern
const cmd_ptrn = cmd => `${c.cyan}worker[${c.yellow}${worker_name}${c.cyan}] exec cmd [${c.magenta}${cmd}${c.cyan}]${c.white}`;
const cmd_done = (cmd, status) =>
    `${c.cyan}worker[${c.yellow}${worker_name}${c.cyan}] cmd [${c.magenta}${cmd}${c.cyan}] completed!
    ${c.green}Status: "${status}"${c.white}`;
const cmd_fail = cmd => `${c.cyan}worker[${c.yellow}${worker_name}${c.red}] cmd [${c.magenta}${cmd}${c.red} FAIL!${c.white}`;
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
        setTimeout(() => resolve("node config bootstrapped"), 3000);
    });

/*
 * get Best node executor
 * */
const getBestNode = node_type =>
    new Promise((resolve, reject) => {
        console.log(cmd_ptrn(getBestNode));
        if (node_type === "btc") {
            setTimeout(() => resolve("BTC CFFFG"), 2000);
        } else reject("Bad node type");
    });

/*
 * check nodes executor
 * */
const checkNodes = () =>
    new Promise((resolve, reject) => {
        console.log(cmd_ptrn(checkNodes));
        setTimeout(() => resolve("All nodes checked."), 500);
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
};
