const cfg = require("../config/config"),
    { color: c, nodes: nodes_from_file } = cfg,
    worker = require("cluster").worker,
    { bootstrapNodes, getLastBlocks, $node } = require("../modules/node_management/interface"),
    { getAzureNodes } = require("../modules/node_management/azure_api");

// debug azure api
// require("../modules/node_management/azure_api");

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
    new Promise(async (resolve, reject) => {
        console.log(cmd_ptrn("bootstrapping node configs"));
        // bootstrap node config
        const bootstrapped_nodes = {};
        Object.keys(nodes_from_file).forEach(type => {
            if (!bootstrapped_nodes[type + "_nodes"]) bootstrapped_nodes[type + "_nodes"] = [];
            bootstrapped_nodes[type + "_nodes"].push({
                type: type,
                status: "bootstrapping...",
                location: "BKX Lab net. Testing purpose",
                nodeHash: "",
                lastBlock: 0,
                updateTime: new Date(), // UTC
                config: nodes_from_file[type]
            });
        });
        // get azure nodes
        let azure_nodes = await new Promise(resolve =>
            getAzureNodes((err, nodes) => {
                console.log(cmd_ptrn("get nodes from Azure"));
                if (err) {
                    console.error(err);
                    return resolve([]);
                }
                resolve(nodes);
            })
        );
        // add azure nodes to bootstrapped_nodes object
        azure_nodes.forEach(azure_node => {
            if (!bootstrapped_nodes[azure_node.type + "_nodes"]) bootstrapped_nodes[azure_node.type + "_nodes"] = [];
            bootstrapped_nodes[azure_node.type + "_nodes"].push(azure_node);
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
        getLastBlocks().then(lastblocks => resolve(lastblocks));
    });

/*
 * common MSG handler entry point
 * */
exports.sendMsg = msg => {
    console.log(`${c.cyan}worker[${c.yellow}${worker_name}${c.cyan}] handle message${c.white}\n`, msg);
    let { cmd, params, from } = msg;
    // clear msg.error before each CMD
    _msg.error = null;
    // bootstrap CMD handler
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
    // check node CMD
    if (cmd === "check")
        checkNodes()
            .then(nodes => {
                console.log("CHECK result:\n", nodes);
                // for all nodes EMIT $node >update (Observer pattern)
                nodes.forEach(node => $node.emit("updateLastBlock", node));
            })
            .catch(err => cmd_fail("checkNodes", err));
    // getBestNode(type) CMD
    if (cmd === "getBestNode") {
        _msg.to = "redis_rpc"; // set callback response to Redis RPC
        const _node_types = ["btc", "ltc", "eth"];
        let { node_type: type } = params;
        // check if type passed
        if (!type) {
            _msg.error = "node type required";
            return worker.send(_msg);
        }
        // check if wrong node type
        if (!_node_types.includes(type)) {
            _msg.error = `bad node type ${type}`;
            return worker.send(_msg);
        }
        // emit (observer pattern) event with callback(err,data)
        $node.emit("best", type, (err, config) => {
            if (err) _msg.error = `on getBestNode ${type} node occurred. \n${err}`;
            else _msg.msg = config;
            worker.send(_msg); // send msg to master node (to: "master_rpc" => default MSG go to master)
        });
    }
    // list => get all nodes configs
    if (cmd === "list") {
        _msg.to = "redis_rpc"; // set callback response to Redis RPC
        const _node_types = ["btc", "ltc", "eth", "all"];
        let { node_type: type } = params;
        // check if type passed
        if (!type) {
            _msg.error = "node type required";
            return worker.send(_msg);
        }
        // check if wrong node type
        if (!_node_types.includes(type)) {
            _msg.error = `bad node type ${type}`;
            return worker.send(_msg);
        }
        // emit (observer pattern) event with callback(err,data)
        $node.emit("list", type, (err, result) => {
            if (err) _msg.error = `on listNodes ${type} node occurred. \n${err}`;
            else _msg.msg = result;
            worker.send(_msg); // send msg to master node (to: "master_rpc" => default MSG go to master)
        });
    }
    // get node config by node hash OR node Id (getNodeConfig by ID/nodeHash)
    if (cmd === "get") {
        _msg.to = "redis_rpc"; // set callback response to Redis RPC
        let { hid } = params;
        // check if hid passed
        if (!hid) {
            _msg.error = "node hid required";
            return worker.send(_msg);
        }
        console.log("hid.length: ", hid.length);
        // check hid by length
        if (hid.length !== 64 && hid.length !== 24) {
            _msg.error = `bad hid ${hid}. Use NodeHash or NodeId`;
            return worker.send(_msg);
        }
        // emit (observer pattern) event with callback(err,data)
        $node.emit("get", hid, (err, result) => {
            if (err) _msg.error = `on get Node by hid "${hid}". Error: ${err}`;
            else _msg.msg = result;
            worker.send(_msg); // send msg to master node (to: "master_rpc" => default MSG go to master)
        });
    }
    // todo test  this API
    if (cmd === "add") {
        _msg.to = "redis_rpc"; // set callback response to Redis RPC
        const _node_types = ["btc", "ltc", "eth"];
        let { config, type } = params;
        // check if type passed
        if (!type) {
            _msg.error = "node 'type' required";
            return worker.send(_msg);
        }
        // check if wrong node type
        if (!_node_types.includes(type)) {
            _msg.error = `bad node type ${type}`;
            return worker.send(_msg);
        }
        // check if config passed
        if (!config) {
            _msg.error = "node config required";
            return worker.send(_msg);
        }
        // check if config.port passed
        if (!config.port) {
            _msg.error = "node config 'port' property required";
            return worker.send(_msg);
        }
        // check if config.host passed
        if (!config.host) {
            _msg.error = "node config 'host' property required";
            return worker.send(_msg);
        }
        // check if config.user passed
        if (!config.user) {
            _msg.error = "node config 'user' property required";
            return worker.send(_msg);
        }
        // check if config.pass passed
        if (!config.pass) {
            _msg.error = "node config 'pass' property required";
            return worker.send(_msg);
        }
        // set default properties
        config.protocol = config.protocol || "http";
        config.timeout = config.timeout || 5000;
        console.log(`add ${type} node config: `, config);
        // emit (observer pattern) event with callback(err,data)
        $node.emit("add", { config: { ...config }, type, status: "added from API", error: "", lastBlock: 0 }, (err, result) => {
            if (err) _msg.error = `on add Node "${type}". Error: ${err}`;
            else _msg.msg = result;
            worker.send(_msg); // send msg to master node (to: "master_rpc" => default MSG go to master)
        });
    }
    // rmNode by ID/nodeHash
    if (cmd === "rm") {
        _msg.to = "redis_rpc"; // set callback response to Redis RPC
        let { hid } = params;
        // check if hid passed
        if (!hid) {
            _msg.error = "node hid required";
            return worker.send(_msg);
        }
        console.log("hid.length: ", hid.length);
        // check hid by length
        if (hid.length !== 64 && hid.length !== 24) {
            _msg.error = `bad hid ${hid}. Use NodeHash or NodeId`;
            return worker.send(_msg);
        }
        // emit (observer pattern) event with callback(err,data)
        $node.emit("rm", hid, (err, result) => {
            if (err) _msg.error = `on remove Node by hid "${hid}". Error: ${err}`;
            else _msg.msg = result;
            worker.send(_msg); // send msg to master node (to: "master_rpc" => default MSG go to master)
        });
    }
    // todo updateNode by ID/nodeHash
};
