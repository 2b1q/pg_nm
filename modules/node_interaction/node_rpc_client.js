/*
* Node RPC proxy client
* */
const cfg = require("../../config/config"),
    { nodes, api_version: API_VERSION, project, color: c } = cfg,
    moment = require("moment"),
    { Client } = require("bitcoin"),
    check = require("../../utils/checker").cheker(), // check util singleton
    { checkAuth } = require("../auth/v1/auth"), // auth module
    { api_requests: log_api, error: log_err } = require("../../utils/logger")(module);

// empty response pattern
let empty = Object({ result: null, error: null, id: null });

// simple query logger
let logit = (req, msg = "") =>
    Object({
        msg: msg,
        api_version: API_VERSION,
        module: "address controller",
        project: project,
        req_headers: req.headers,
        post_params: req.body,
        get_params: req.query,
        timestamp: (() => moment())(), // UTC timestamp
        path: module.filename
            .split("/")
            .slice(-2)
            .join("/")
    });

/**
 * common node request wrapper
 * JSON-RPC node proxy client
 * */
const nodeRequester = (node_type, method, params) =>
    new Promise(resolve => {
        let cmd = Object([{ method: method, params: params }]);
        console.log("cmd: ", cmd);
        // define node type
        let con = typeof nodes[node_type] === "object" ? nodes[node_type] : undefined;
        // construct connection
        if (con) {
            // construct node client connection Object
            let client = new Client(con);
            client.cmd(cmd, (err, data) => {
                if (err) return resolve(empty);
                console.log(`${c.green}[${c.magenta}${node_type}${c.green}] node data: ${c.white}`, data);
                resolve({ result: data, error: null, id: null });
            });
        } else resolve(empty); // no config for this node_type
    });

/*
* JSON-RPC node proxy client (controller)
* 1. check AUTH
* 2. nodeRequester
* */
exports.proxy = async (req, res) => {
    // log req params
    log_api(logit(req));
    let { method, params } = req.body;
    // console.log("method: %s. params: %s", method, params);
    // dispatch user creds sync
    try {
        var { user, pass, node_type } = await check.get_creds(req.headers, { rpc: true });
    } catch (e) {
        log_err(e);
        return res.status(401).json(e);
    }
    console.log(
        `${c.green}AUTH check for JSON-RPC node User: ${c.magenta}${user}${c.green} pass: ${c.magenta}${pass}${c.green} node_type: ${
            c.magenta
        }${node_type}${c.white}`
    );
    // check node Authorization
    checkAuth(user, pass, node_type)
        .then(async () => {
            console.log(
                `${c.green}[${c.magenta}${node_type}${c.green}] Get data for user: ${c.magenta}${user}${c.green}, pass: ${
                    c.magenta
                }${pass}${c.white}`
            );
            res.json(await nodeRequester(node_type, method, params));
        })
        .catch(e => {
            log_err(e);
            res.status(401).json({});
        });
};

// export node CMD executor for ext modules
exports.nodeRequest = nodeRequester;
