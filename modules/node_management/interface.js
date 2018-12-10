const cfg = require("../../config/config"),
    crypto = require("crypto"),
    {
        color: c,
        api_version: API_VERSION,
        store: {
            cols: { nm_nodes: nodes_col }
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

// Create emitter Object instance
let $node = new Emitter();
/*
 * Export observers Object (emitter Object instance)
 * - use observer pattern to operations without Promises
 * */
exports.$node = $node;

/** Observers */
$node.on("add", node => addNode(node));
$node.on("update", node => updateNode(node));
$node.on("best", (type, callback) => bestNode(type, callback));
$node.on("list", (type, callback) => listNodes(type, callback));
// $node.on("rm", node => addNode(node));

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
                if (!db_instance) return console.error(wid_ptrn("No db instance!"));
                db_instance
                    .collection(nodes_col)
                    .findOne({})
                    .then(node => {
                        if (!node) addNodes(bootstrapped_nodes);
                        resolve("DB bootstrap done!");
                    })
                    .catch(e => {
                        console.error("Mongo error on bootstrapping nodes: ", e);
                        reject(e);
                    });
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
        await _nodes.map((node, i, arr) => {
            // construct RPC payload
            let payload = { node_type: node.type, method: "getblockcount", config: node.config, nodeHash: node.nodeHash };
            console.log(`${c.magenta}Send request to ${c.yellow}${node.type}${c.magenta} node${c.white}`);
            p_list.push(nodeRequest(payload));
            if (i === arr.length - 1) return Promise.resolve();
        });
        let lastbloks = [];
        // resolve all JSON-RPC node requests in parallel
        await Promise.all(p_list)
            .then(
                result =>
                    (lastbloks = result.map(node =>
                        Object({
                            nodeType: node.node_type,
                            nodeHash: node.nodeHash,
                            lastBlock: node.msg.result
                        })
                    ))
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
 * @[Observer function] add node Object to DB
 * */
const addNode = node => {
    // hash nodeObject
    const nodeHash = crypto
        .createHmac("sha256", "(@)_(@)")
        .update(JSON.stringify(node.config))
        .digest("hex");
    console.log(
        wid_ptrn("addNode"),
        `
        node_type: ${c.magenta}${node.type}${c.white}
        node_stat: ${c.cyan}${node.status}${c.white}
        node_hash: ${c.yellow}${nodeHash}${c.white}`
    );
    node.nodeHash = nodeHash; // add node hash property
    node.updateTime = new Date(); // update dateTime (UTC)
    // insert node
    return db
        .get()
        .then(db_instance => {
            if (!db_instance) {
                console.error(wid_ptrn("No db instance!"));
                return false;
            }
            db_instance
                .collection(nodes_col)
                .updateOne({ nodeHash: nodeHash }, { $set: { ...node } }, { upsert: true })
                .then(() => {
                    console.log(wid_ptrn("addNode"), `\n${c.magenta}${node.type}${c.yellow} ${nodeHash}${c.green} inserted${c.white}`);
                    return nodeHash;
                })
                .catch(e => console.error(wid_ptrn(e)));
        })
        .catch(() => console.error(wid_ptrn("connection to MongoDB lost")));
};

/*
 * * @[Observer function] updateNode
 * UPSERT method
 * */
const updateNode = ({ nodeType, nodeHash, lastBlock }) => {
    let status = "online";
    console.log(
        wid_ptrn("updateNode"),
        `
        node_type: ${c.magenta}${nodeType}${c.white}
        lastBlock: ${c.cyan}${lastBlock}${c.white}
        status: ${c.cyan}${status}${c.white}
        node_hash: ${c.yellow}${nodeHash}${c.white}`
    );
    let node = {
        status,
        lastBlock,
        updateTime: new Date() // update dateTime (UTC)
    };
    // insert node
    return db
        .get()
        .then(db_instance => {
            if (!db_instance) {
                console.error(wid_ptrn("No db instance!"));
                return false;
            }
            db_instance
                .collection(nodes_col)
                .updateOne({ nodeHash: nodeHash }, { $set: { ...node } }, { upsert: true })
                .then(() => {
                    console.log(wid_ptrn("updateNode"), `\n${c.magenta}${nodeType}${c.yellow} ${nodeHash}${c.green} updated${c.white}`);
                    return nodeHash;
                })
                .catch(e => console.error(wid_ptrn(e)));
        })
        .catch(() => console.error(wid_ptrn("connection to MongoDB lost")));
};

/*
 * add nodes to DB (Observer emitter)
 * */
const addNodes = nodes => Object.keys(nodes).forEach(node_type => nodes[node_type].forEach(node => $node.emit("add", node)));
