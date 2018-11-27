/*
 * Create and exports configuration variables
 *
 * */

// Config container
const config = {};

// endPoints polymorphic curry function object instantiation
const service = type => {
    let names = {
        btc_rates: {
            host: "137.117.110.27",
            port: 8100,
            currencies: ["BTC", "LTC", "ETH", "BKX", "USD"],
            endpoint: "api/v1/"
        },
        btc_adapter: { host: "137.117.110.27", port: 8101, endpoint: "api/v1/" },
        ltc_adapter: { host: "137.117.110.27", port: 8102, endpoint: "api/v1/" }
    };
    // check if passed service name  exists
    let service = typeof names[type] == "undefined" ? undefined : names[type];
    return method => (typeof service == "undefined" ? "" : `http://${service.host}:${service.port}/${service.endpoint}${method}`);
};

/** Common config for all ENV */
const api_version = "v. 1.0",
    project = "BANKEX Payment-gateway-router",
    errors = {
        404: { errorCode: 404, errorMessage: "Not Found. Bad API URL" },
        401: { errorCode: 401, errorMessage: "SSO Authentication error. Bad Token" },
        409: { errorCode: 409, errorMessage: "Something went wrong during logout operation" }, //409 Conflict
        crash: err => Object({ errorCode: 500, errorMessage: err })
    };

// DB collections
const cols = {
    // common base cols
    base: {},
    // user collections
    user: {
        tokens: "user_tokens", // store user tokens
        users: "users" // store user data
    }
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

/** Staging (default) environment */
config.staging = {
    jwt: {
        ttl: 3600,
        secret: "123asd789ABCqwt"
    },
    user_pass_hash_secret: "sup4_Dup4#sEcreD", // user pass hash secret
    nodes: {
        btc: {
            protocol: "http",
            host: "34.217.183.33",
            port: 8332,
            user: "",
            pass: "",
            timeout: 30000
        },
        ltc: {
            protocol: "http",
            host: "34.219.117.248",
            port: 9332,
            user: "",
            pass: "",
            timeout: 30000
        }
    },
    services: {
        btc_rates: service("btc_rates"),
        btc_adapter: service("btc_adapter"),
        ltc_adapter: service("ltc_adapter")
    },
    restricted_endpoints: [
        "address",
        "address/all",
        "address/new",
        "block",
        "block/hash",
        "rates",
        "rates/all",
        "account/new",
        "account/balance"
    ],
    restricted_services: ["ltc", "btc"], // restricted services
    api_version: api_version,
    errors: errors,
    project: project,
    /** ============= NEED TO BE SPECIFIED ============= */
    server: {
        port: 3006,
        ip: "0.0.0.0"
    },
    /** ============= NEED TO BE SPECIFIED ============= */
    store: {
        mongo: {
            uri: "127.0.0.1:27017", // hardcoded
            dbname: "pgw",
            dbuser: "pgwUser",
            dbpass: "pgwPass",
            options: {
                // autoIndex: false,
                useNewUrlParser: true
                // poolSize: 10 // количество подключений в пуле
            }
        },
        cols: cols.base,
        user: cols.user
    },
    color: color
};
/** END OF Staging (default) environment */

/** Production environment */
config.production = {};
/** END OF Production environment */

/** Dev environment */
config.dev = {
    jwt: {
        ttl: 3600,
        secret: "123asd789ABCqwt"
    },
    user_pass_hash_secret: "sup4_Dup4#sEcreD", // user pass hash secret
    nodes: {
        btc: {
            protocol: "http",
            host: "34.217.183.33",
            port: 8332,
            user: "",
            pass: "",
            timeout: 30000
        },
        ltc: {
            protocol: "http",
            host: "34.219.117.248",
            port: 9332,
            user: "",
            pass: "",
            timeout: 30000
        }
    },
    services: {
        btc_rates: service("btc_rates"),
        btc_adapter: service("btc_adapter"),
        ltc_adapter: service("ltc_adapter")
    },
    restricted_endpoints: [
        "address",
        "address/all",
        "address/new",
        "block",
        "block/hash",
        "rates",
        "rates/all",
        "account/new",
        "account/balance"
    ],
    restricted_services: ["ltc", "btc"], // restricted services
    api_version: api_version,
    errors: errors,
    project: project,
    /** ============= NEED TO BE SPECIFIED ============= */
    server: {
        port: 3006,
        ip: "0.0.0.0"
    },
    /** ============= NEED TO BE SPECIFIED ============= */
    store: {
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
        cols: cols.base,
        user: cols.user
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
