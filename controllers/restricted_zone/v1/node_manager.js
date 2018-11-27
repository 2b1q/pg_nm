const node = require("../../../modules/node_management/interface"),
    cfg = require("../../../config/config"),
    moment = require("moment"),
    { color: c, api_version: API_VERSION, nodes } = cfg,
    { id: wid } = require("cluster").worker; // access to cluster.worker.id

// current module
const _module_ = "Controller";
// worker id pattern
const wid_ptrn = msg =>
    `${c.green}worker[${wid}]${c.red}[node manager]${c.yellow}[${API_VERSION}]${c.cyan}[${_module_}]${c.red} > ${c.green}[${msg}] ${
        c.white
    }`;
// error object constructor
const error = (errCode, msg) => Object({ errCode, msg });

/*
*  check API_KEY for node management requests
* */
const chekApiKey = ({ api_key }) => api_key === process.env.mgmt_api_key && process.env.mgmt_api_key !== undefined;

// debug node config
const nodes_ = {};
Object.keys(nodes).forEach(type => {
    if (!nodes_[type + "_nodes"]) nodes_[type + "_nodes"] = [];
    nodes_[type + "_nodes"].push({ type: type, status: "bootstrapping...", lastBlock: 0, updateTime: moment(), config: nodes[type] });
});

/*
* get all nodes
* */
exports.getNodes = async (req, res) => {
    console.log(wid_ptrn("getNodes"));
    if (chekApiKey(req.headers)) return res.json(nodes_);
    res.status(401).json(error(401, "Bad API_KEY"));
};

/*
* add node
* */
exports.addNode = async (req, res) => {
    console.log(wid_ptrn("addNode"));
    res.json(nodes_);
};

/*
* update node
* */
exports.updNode = async (req, res) => {
    console.log(wid_ptrn("updNode"));
    res.json(nodes_);
};

/*
* remove node
* */
exports.remNode = async (req, res) => {
    console.log(wid_ptrn("remNode"));
    res.json(nodes_);
};
