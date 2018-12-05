/*
 * Create and exports configuration variables
 *
 * */

// Config container
const config = {};

/** Common config for all ENV */
const api_version = "v. 2.0",
    project = "BANKEX Payment-gateway-nomde manager",
    errors = {
        crash: err => Object({ errorCode: 500, errorMessage: err })
    };

// DB collections
const cols = {
    // node_manager_cols
    nm_tasks: "nm_tasks", // node manager tasks
    nm_nodes: "nodes" // nodes collections
};

// Redis RPC channels
const channels = {
    jrpc: wid => (typeof wid === "undefined" ? "pg_jrpc:" : "pg_jrpc:" + wid),
    auth: wid => (typeof wid === "undefined" ? "pg_auth:" : "pg_auth:" + wid),
    nm: wid => (typeof wid === "undefined" ? "pg_nm:" : "pg_nm:" + wid)
};

// colorize console
const color = {
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    black: "\x1b[30m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
    white: "\x1b[37m"
};

// bootstrap CFG nodes
const nodes = {
    btc: {
        protocol: "http",
        host: "34.217.183.33",
        port: 8332,
        user: "btcAdapter",
        pass: "AdapterBTC",
        timeout: 5000
    },
    ltc: {
        protocol: "http",
        host: "34.219.117.248",
        port: 9332,
        user: "litecoin",
        pass: "litecoin",
        timeout: 5000
    }
};

/** Staging (default) environment */
config.staging = {
    nodes: nodes,
    api_version: api_version,
    errors: errors,
    project: project,
    /** ============= NEED TO BE SPECIFIED ============= */
    store: {
        redis: {
            host: "localhost", // redis server hostname
            port: 6379, // redis server port
            scope: "dev" // use scope to prevent sharing messages between "node redis rpc"
        },
        channel: channels,
        mongo: {
            uri: "localhost:27017", // hardcoded
            dbname: "pgw",
            dbuser: "pgwUser",
            dbpass: "pgwPass",
            options: {
                // autoIndex: false,
                useNewUrlParser: true
                // poolSize: 10 // количество подключений в пуле
            }
        },
        cols: cols
    },
    color: color
};
/** END OF Staging (default) environment */

/** Production environment */
config.production = {};
/** END OF Production environment */

/** Dev environment */
config.dev = {
    nodes: nodes,
    api_version: api_version,
    errors: errors,
    project: project,
    /** ============= NEED TO BE SPECIFIED ============= */
    store: {
        redis: {
            host: "localhost", // redis server hostname
            port: 6379, // redis server port
            scope: "dev" // use scope to prevent sharing messages between "node redis rpc"
        },
        channel: channels,
        mongo: {
            uri: process.env.dburi || "mongo:27017",
            dbname: process.env.dbname || "pgw_dev",
            dbuser: process.env.dbuser || "pgwUser",
            dbpass: process.env.dbpass || "pgwPass",
            options: {
                // autoIndex: false,
                useNewUrlParser: true
                // poolSize: 10 // количество подключений в пуле
            }
        },
        cols: cols
    },
    color: color
};
/** END OF Dev environment */

// Determine passed ENV
const currentEnv = typeof process.env.NODE_ENV == "string" ? process.env.NODE_ENV.toLowerCase() : "";

// Check ENV to export (if ENV not passed => default ENV is 'staging')
const envToExport = typeof config[currentEnv] == "object" ? config[currentEnv] : config.staging;

// Exports config module
module.exports = envToExport;
