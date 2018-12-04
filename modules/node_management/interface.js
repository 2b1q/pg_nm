const cfg = require("../../config/config"),
    crypto = require("crypto"),
    {
        color: c,
        api_version: API_VERSION,
        store: {
            cols: { nm_nodes: nodes_col }
        }
    } = cfg,
    { emit: nodeRequest } = require("../../rpc_interaction/rpc_json-rpc_proxy"),
    { id: wid } = require("cluster").worker, // access to cluster.worker.id
    db = require("../../libs/db");
// { emit } = require("../../rpc_interaction/rpc_json-rpc_proxy");

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
Emitter.prototype.emit = function(type, arg) {
    if (this.events[type]) this.events[type].forEach(listener => listener(arg));
};

// Create emitter Object instance
let $node = new Emitter();

/** Observers */
$node.on("add", node => addNode(node));
// $node.on("list", node => addNode(node));
// $node.on("rm", node => addNode(node));

/*
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
                    .then(nodes => {
                        // if nodes === null => addNodes(bootstrapped_nodes)
                        if (!nodes) addNodes(bootstrapped_nodes);
                        // getLastBlocks();
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
 * get best BTC node
 * */
const getBtcNode = () => new Promise((resolve, reject) => {});

/*
 * get best LTC node
 * */
const getLtcNode = () => new Promise((resolve, reject) => {});

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
        _nodes.forEach(async node =>
            console.log({
                ...node,
                _lastblock: await nodeRequest({ node_type: node.type, method: "getblockcount" })
            })
        );
        resolve("123");
    });

// nodeRequest({
//     node_type: "ltc",
//     method: "getblockcount"
// }).then(response => resolve(response));

/*
 * Get all nodes from DB
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
 * add node Object to DB
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
 * add nodes to DB
 * */
const addNodes = nodes => Object.keys(nodes).forEach(node_type => nodes[node_type].forEach(node => $node.emit("add", node)));
