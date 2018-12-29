const cfg = require("../../config/config"),
    crypto = require("crypto"),
    ObjectId = require("mongodb").ObjectId,
    {
        color: c,
        api_version: API_VERSION,
        store: {
            cols: { nm_nodes: nodes_col, nm_tasks: tasks_col = "tasks" }
        }
    } = cfg,
    { emitUniq: nodeRequest } = require("../../rpc_interaction/rpc_json-rpc_proxy"),
    { id: wid } = require("cluster").worker, // access to cluster.worker.id
    db = require("../../libs/db");

// current module
const _module_ = "Interface module";
// worker id pattern
const wid_ptrn = msg =>
    `${c.green}worker[${wid}]${c.red}[node manager]${c.yellow}[${API_VERSION}]${c.cyan}[${_module_}]${c.red} > ${c.green}[${msg}] ${c.white}`;

/** Observer */
function Emitter() {
    this.events = {}; // observer list
}
// Event handler
Emitter.prototype.on = function(type, listener) {
    this.events[type] = this.events[type] || []; // create event type stack
    this.events[type].push(listener); // push executor
};
// Event emitter
Emitter.prototype.emit = function(type, arg, cb) {
    if (this.events[type]) this.events[type].forEach(listener => listener(arg, cb));
};

/*
 * Emitters instances
 * - node (node mgmt interface)
 * - task (task mgmt interface)
 * */
let $node = new Emitter();
let $task = new Emitter();
/*
 * Export observers Object (emitter Object instance)
 * - use observer pattern to operations without Promises
 * */
exports.$node = $node;
exports.$task = $task;

/** node Observers */
$node.on("addBootstrap", node => addNodeOnBootstrap(node));
$node.on("updateLastBlock", node => updateNodeBlock(node));
$node.on("best", (type, callback) => bestNode(type, callback));
$node.on("list", (type, callback) => listNodes(type, callback));
$node.on("add", (node, callback) => addNode(node, callback));
$node.on("get", (hid, callback) => getNode(hid, callback));
$node.on("rm", (hid, callback) => rmNode(hid, callback));
// $node.on("rm", node => addNode(node));
/** task Observers */
$task.on("list", callback => getTasks(callback)); // todo task paused
$task.on("addBootstrap", task => addTaskOnBootstrap(task)); // todo task paused

/*
 * @[Export Promise]
 * 1. get node config from DB
 *  OK => return
 *  FAIL => insert nodes from config
 * 2.
 * */
exports.bootstrapNodes = bootstrapped_nodes =>
    new Promise((resolve, reject) =>
        db
            .get()
            .then(db_instance => {
                console.log(wid_ptrn("Bootstrapping..."));
                if (!db_instance) {
                    let err = "No db instance!";
                    console.error(wid_ptrn(err));
                    return reject(err);
                }
                addNodes(bootstrapped_nodes); // add nodes anyWay
                resolve("DB bootstrap done!"); // resolve without waiting
            })
            .catch(() => {
                let err = "connection to MongoDB lost";
                console.error(wid_ptrn(err));
                reject(err);
            })
    );

/*
 * @[Export Promise] getLastBlocks
 * */
exports.getLastBlocks = () =>
    new Promise(async (resolve, reject) => {
        // cmd:  [ { method: 'getblockcount', params: [] } ]
        // nodeRequest(type, method, params)
        try {
            var _nodes = await getNodes();
        } catch (e) {
            console.error("getLastBlocks error: ", e);
            return reject(e);
        }
        // construct promise list
        let p_list = [];
        await _nodes.map(({ type, config, nodeHash }, i, arr) => {
            // construct RPC payload
            let payload =
                type !== "eth"
                    ? { node_type: type, method: "getblockcount", config: config, nodeHash: nodeHash }
                    : { node_type: type, method: "eth_blockNumber", config: config, nodeHash: nodeHash };
            console.log(`${c.magenta}Send request to ${c.yellow}${type}${c.magenta} node${c.white}`);
            p_list.push(nodeRequest(payload));
            if (i === arr.length - 1) return Promise.resolve();
        });
        let lastbloks = [];
        // resolve all JSON-RPC node requests in parallel
        await Promise.all(p_list)
            .then(
                result =>
                    (lastbloks = result.map(({ node_type: nodeType, nodeHash, msg }) => {
                        let { result: lastBlock, etherScanResult, error } = msg;
                        let response = Object({
                            nodeType,
                            nodeHash,
                            lastBlock,
                            etherScanResult,
                            error
                        });
                        return response;
                    }))
            )
            .catch(e => reject(e));
        resolve(lastbloks);
    });

/*
 * (Promise) Get all nodes from DB
 * */
const getNodes = () =>
    new Promise((resolve, reject) =>
        db
            .get()
            .then(db_instance => {
                console.log(wid_ptrn("getNodes"));
                if (!db_instance) return reject(console.error(wid_ptrn("No db instance!")));
                db_instance
                    .collection(nodes_col)
                    .find({})
                    .toArray((err, result) => {
                        if (err) return reject(console.error(wid_ptrn("Mongo error on getNodes"), err));
                        resolve(result);
                    });
            })
            .catch(() => reject("connection to MongoDB lost"))
    );

/*
 * Observer functions
 * */

/*
 * @[Observer with callback]  listNodes(type, callback(err,data))
 * node observer
 * */
const listNodes = (type, cb) =>
    db
        .get()
        .then(db_instance => {
            let query = type === "all" ? {} : { type: type };
            console.log(wid_ptrn(`List ${type} nodes`));
            if (!db_instance) {
                let err = "No db instance!";
                console.error(wid_ptrn(err));
                return cb(err);
            }
            db_instance
                .collection(nodes_col)
                .find(query)
                .sort({ lastBlock: -1 })
                .toArray((err, result) => {
                    if (err) {
                        console.error(wid_ptrn(`Mongo error on listNodes type ${type}`), err);
                        return cb(err);
                    }
                    console.log(wid_ptrn("listNodes"), result);
                    if (!result) return cb("listNodes empty"); // return cb(err) if result is undefined
                    cb(null, result); // return callback with result
                });
        })
        .catch(() => {
            let err = "connection to MongoDB lost";
            console.error(wid_ptrn(err));
            cb(err);
        });

/*
 * @[Observer with callback]  getTasks(callback(err,data))
 * task observer
 * */
const getTasks = cb =>
    db
        .get()
        .then(db_instance => {
            console.log(wid_ptrn(`List tasks`));
            if (!db_instance) {
                let err = "No db instance!";
                console.error(wid_ptrn(err));
                return cb(err);
            }
            db_instance
                .collection(tasks_col)
                .find({})
                .toArray((err, result) => {
                    if (err) {
                        console.error(wid_ptrn(`Mongo error on getTasks `), err);
                        return cb(err);
                    }
                    console.log(wid_ptrn("getTasks"), result);
                    if (!result) return cb("getTasks empty"); // return cb(err) if result is undefined
                    cb(null, result); // return callback with result
                });
        })
        .catch(() => {
            let err = "connection to MongoDB lost";
            console.error(wid_ptrn(err));
            cb(err);
        });

/*
 * @[Observer with callback]  getNode(hash, callback(err,data))
 * get node by hash or id
 * eg
 * "_id":"5c07884e9fc4e94a5db9dc9f", // length 24
 * "nodeHash":"96d72d068200a9fc0104dd43a10030d2858a0e0525cd3eecb9a89226e00b8cb6", // length 64
 * */
const getNode = (hid, cb) =>
    db
        .get()
        .then(db_instance => {
            // polymorphic query constructor
            let query = hid.length === 24 ? { _id: ObjectId(hid) } : { nodeHash: hid };
            console.log(wid_ptrn(`getNode by query: `), query);
            if (!db_instance) {
                let err = "No db instance!";
                console.error(wid_ptrn(err));
                return cb(err);
            }
            db_instance
                .collection(nodes_col)
                .findOne(query)
                .then(result => {
                    console.log(wid_ptrn("getNode"), result);
                    if (!result) return cb("not found"); // return cb(err) if result is undefined
                    cb(null, result); // return callback with result
                })
                .catch(e => {
                    console.error(wid_ptrn(`Mongo error on getNode `), e);
                    return cb(e);
                });
        })
        .catch(() => {
            let err = "connection to MongoDB lost";
            console.error(wid_ptrn(err));
            cb(err);
        });

/*
 * @[Observer with callback]  rmNode(hash, callback(err,data))
 * remove node by hash or id
 * eg
 * "_id":"5c07884e9fc4e94a5db9dc9f", // length 24
 * "nodeHash":"96d72d068200a9fc0104dd43a10030d2858a0e0525cd3eecb9a89226e00b8cb6", // length 64
 * */
const rmNode = (hid, cb) =>
    db
        .get()
        .then(db_instance => {
            // polymorphic query constructor
            let query = hid.length === 24 ? { _id: ObjectId(hid) } : { nodeHash: hid };
            console.log(wid_ptrn(`removeNode by query: `), query);
            if (!db_instance) {
                let err = "No db instance!";
                console.error(wid_ptrn(err));
                return cb(err);
            }
            db_instance
                .collection(nodes_col)
                .deleteOne(query)
                .then(({ result }) => {
                    let status = `removeNode by hid "${hid}" success`;
                    console.log(wid_ptrn(status));
                    cb(null, {
                        configsRemoved: result.n,
                        status: "OK"
                    }); // return callback with result
                })
                .catch(e => {
                    console.error(wid_ptrn(`Mongo error on removeNode `), e);
                    return cb(e);
                });
        })
        .catch(() => {
            let err = "connection to MongoDB lost";
            console.error(wid_ptrn(err));
            cb(err);
        });

/*
 * @[Observer with callback] get bestNode(type, callback(err,data))
 * */
const bestNode = (type, cb) =>
    db
        .get()
        .then(db_instance => {
            console.log(wid_ptrn(`Get best ${type} node`));
            if (!db_instance) {
                let err = "No db instance!";
                console.error(wid_ptrn(err));
                return cb(err);
            }
            db_instance
                .collection(nodes_col)
                .find({ type: type, status: "online" })
                .sort({ lastBlock: -1 })
                .limit(1)
                .toArray((err, [result]) => {
                    if (err) {
                        console.error(wid_ptrn(`Mongo error on getBestNode type ${type}`), err);
                        return cb(err);
                    }
                    console.log(wid_ptrn("bestNode"), result);
                    if (!result) return cb("best node not found"); // return cb(err) if result is undefined
                    let { config } = result; // destruct config object
                    cb(null, config); // return callback with config
                });
        })
        .catch(() => {
            let err = "connection to MongoDB lost";
            console.error(wid_ptrn(err));
            cb(err);
        });

/*
 * @[Observer with callback] addNode(type, callback(err,data))
 * addNode with callback
 * from RPC API
 * */
const addNode = (node, cb) => {
    // hash nodeObject
    const nodeHash = crypto
        .createHmac("sha256", "(@)_(@)")
        .update(JSON.stringify(node.config))
        .digest("hex");
    console.log(
        wid_ptrn("addNode exec"),
        `
        node_type: ${c.magenta}${node.type}${c.white}
        node_stat: ${c.cyan}${node.status}${c.white}
        node_hash: ${c.yellow}${nodeHash}${c.white}`
    );
    node.nodeHash = nodeHash; // add node hash property
    node.updateTime = new Date(); // update dateTime (UTC)
    // insert node
    db.get()
        .then(db_instance => {
            if (!db_instance) {
                let err = "No db instance!";
                console.error(wid_ptrn(err));
                return cb(err);
            }
            db_instance
                .collection(nodes_col)
                .updateOne({ nodeHash: nodeHash }, { $set: { ...node } }, { upsert: true })
                .then(() => {
                    console.log(wid_ptrn("addNode done"), `\n${c.magenta}${node.type}${c.yellow} ${nodeHash}${c.green} inserted${c.white}`);
                    return cb(null, nodeHash);
                })
                .catch(e => {
                    console.error(wid_ptrn(e));
                    return cb(e);
                });
        })
        .catch(() => {
            let err = "connection to MongoDB lost";
            console.error(wid_ptrn(err));
            cb(err);
        });
};

/*
 * @[Observer function] add node Object to DB on bootstrap
 * add node on bootstrap
 * no callback
 * */
const addNodeOnBootstrap = node => {
    // hash nodeObject
    const nodeHash = crypto
        .createHmac("sha256", "(@)_(@)")
        .update(JSON.stringify(node.config))
        .digest("hex");
    console.log(
        wid_ptrn("addNodeOnBootstrap exec"),
        `
        node_type: ${c.magenta}${node.type}${c.white}
        node_stat: ${c.cyan}${node.status}${c.white}
        node_hash: ${c.yellow}${nodeHash}${c.white}`
    );
    node.nodeHash = nodeHash; // add node hash property
    node.updateTime = new Date(); // update dateTime (UTC)
    node.error = ""; // set error to empty string on bootstrap
    let nc = node.config;
    let { host, protocol, port, user, pass } = nc;
    // cURL check CMD e.g. curl http://172.20.0.6:9332 --data-binary $'{"jsonrpc":"1.0","method":"getblockcount","params":[]}' -u ltc:ltc
    node.curlCheck = `curl ${protocol}://${host}:${port} --data-binary $'{"jsonrpc":"1.0","method":"getblockcount","params":[]}' -u ${user}:${pass}`;
    // insert node
    db.get()
        .then(db_instance => {
            if (!db_instance) {
                console.error(wid_ptrn("No db instance!"));
                return false;
            }
            db_instance
                .collection(nodes_col)
                .updateOne({ nodeHash: nodeHash }, { $set: { ...node } }, { upsert: true })
                .then(() => {
                    console.log(wid_ptrn("addNodeOnBootstrap done"), `\n${c.magenta}${node.type}${c.yellow} ${nodeHash}${c.green} inserted${c.white}`);
                    return nodeHash;
                })
                .catch(e => console.error(wid_ptrn(e)));
        })
        .catch(() => console.error(wid_ptrn("connection to MongoDB lost")));
};

/*
 * @[Observer function] add task Object to DB on bootstrap
 * add task on bootstrap
 * no callback
 * */
const addTaskOnBootstrap = task => {
    console.log(
        wid_ptrn("addTaskOnBootstrap exec"),
        `
        task_name: ${c.magenta}${task.name}${c.white}
        task_desc: ${c.cyan}${task.desc}${c.white}
        task_interval: ${c.yellow}${task.timer}${c.white}`
    );
    task.updateTime = new Date(); // update dateTime (UTC)
    task.error = ""; // set error to empty string on bootstrap
    // insert node
    db.get()
        .then(db_instance => {
            if (!db_instance) {
                console.error(wid_ptrn("No db instance!"));
                return false;
            }
            db_instance
                .collection(tasks_col)
                .updateOne({ name: task.name }, { $set: { ...task } }, { upsert: true })
                .then(() => {
                    console.log(wid_ptrn("addTaskOnBootstrap done"), `\n${c.magenta}${task.name}${c.yellow} ${task.timer}${c.green} inserted${c.white}`);
                })
                .catch(e => console.error(wid_ptrn(e)));
        })
        .catch(() => console.error(wid_ptrn("connection to MongoDB lost")));
};

/*
 * * @[Observer function] updateNode
 * UPSERT method
 * */
const updateNodeBlock = ({ nodeType, nodeHash, lastBlock, etherScanResult, error }) => {
    let status = lastBlock ? "online" : "down"; // if lastBlock null (from check) => set status to down
    lastBlock = lastBlock ? lastBlock : 0; // if lastBlock undefined => set lastBlock = 0
    error = error ? error : ""; // if error undefined => set error to empty string
    let color_status = status === "online" ? `${c.green}${status}${c.white}` : `${c.red}${status}${c.white}`;
    console.log(
        wid_ptrn("updateNodeBlock exec"),
        `
        node_type: ${c.magenta}${nodeType}${c.white}
        lastBlock: ${c.cyan}${lastBlock}${c.white}
        etherScanResult: ${c.cyan}${etherScanResult}${c.white}
        status: ${color_status}
        node_hash: ${c.yellow}${nodeHash}${c.white}`
    );
    let node = {
        error,
        status,
        lastBlock: {
            hex: /0x/.test(lastBlock) ? lastBlock : "", // set original HEX value from ETH node
            number: typeof lastBlock === "number" ? lastBlock : parseInt(lastBlock, 16), // convert to number
            etherScan: etherScanResult ? etherScanResult : ""
        },
        updateTime: new Date() // update dateTime (UTC)
    };
    // insert node
    db.get()
        .then(db_instance => {
            if (!db_instance) {
                console.error(wid_ptrn("No db instance!"));
                return false;
            }
            db_instance
                .collection(nodes_col)
                .updateOne({ nodeHash: nodeHash }, { $set: { ...node } }, { upsert: true })
                .then(() => {
                    console.log(wid_ptrn("updateNodeBlock done"), `\n${c.magenta}${nodeType}${c.yellow} ${nodeHash}${c.green} updated${c.white}`);
                    return nodeHash;
                })
                .catch(e => console.error(wid_ptrn(e)));
        })
        .catch(() => console.error(wid_ptrn("connection to MongoDB lost")));
};

/*
 * add nodes to DB (Observer emitter)
 * no callbacks
 * */
const addNodes = nodes => Object.keys(nodes).forEach(node_type => nodes[node_type].forEach(node => $node.emit("addBootstrap", node)));
