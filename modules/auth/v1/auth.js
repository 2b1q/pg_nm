/**
 * check AUTH model
 * */
/** get cfg */
const {
    nodes,
    api_version: API_VERSION,
    color: c,
    user_pass_hash_secret: secret,
    store: {
        user: { users: user_col }
    }
} = require("../../../config/config");

/** get modules */
const crypto = require("crypto"),
    moment = require("moment"),
    cluster = require("cluster"),
    db = require("../../../libs/db"),
    { error: log_err } = require("../../../utils/logger")(module);

// current module
const _module_ = "Auth model";
// cluster.worker.id
const wid = cluster.worker.id;
// worker id pattern
const wid_ptrn = endpoint =>
    `${c.green}worker[${wid}]${c.red}[AUTH]${c.yellow}[${API_VERSION}]${c.cyan}[${_module_}]${c.red} > ${c.green}[${endpoint}] ${c.white}`;

/** reg new user in all services Promise Object
 * 1. get user, pass
 * 2. hash the pass
 * 3. check user if exists
 * 3.1 compare hash
 * 3.2 resolve(<OK payload>) OR reject(401)
 * 4. get all services names from cfg
 * 5. generate new JWT pair using secret [deprecated]
 * 6. store <user_data> in 'user' collection
 *
 * <OK payload>
 *   {
 *      token: jwt_pair, // [deprecated]
 *      services: ['btc','ltc',...]
 *   }
 * if fail => reject()
 *
 * <user_data>
 *   {
 *     name: <user_name>,
 *     pass: <pass_hash>,
 *     services: ['btc','ltc',...],
 *     token: <jwt_token> // [deprecated]
 *   }
 *
 * */
exports.newUser = (user, pwd) =>
    new Promise(async (resolve, reject) => {
        console.log(wid_ptrn("newUser"));
        var msg_container = Object.create(null); // create unprototyped object container
        msg_container = {
            msg: "",
            error: null
        };
        // hash the pass from request
        const passHashFromRequest = crypto
            .createHmac("sha256", secret)
            .update(pwd)
            .digest("hex");
        // check if user already exists
        try {
            // getUser object
            var userObject = await getUser(user);
        } catch (e) {
            log_err(e);
            msg_container.error = 500;
            msg_container.msg = "Error on getUser";
            return reject(msg_container);
        }
        console.log("userObject, ", userObject);
        // destruct login and passHash
        let { passHash: passHashFromDB, login, services: user_services } = userObject;
        // if user not exists => create One
        if (!login) {
            // store user, hash and services
            createUser(user, passHashFromRequest, Object.keys(nodes))
                .then(({ services, login }) => {
                    msg_container.msg = "new user created successfully";
                    msg_container.reg_services = services;
                    msg_container.json_rpc_logins = services.map(service => service + "@" + login); // add virtual logins for RPC requests
                    msg_container.rest_services_login = login;
                    console.log(msg_container);
                    return resolve(msg_container);
                })
                .catch(e => {
                    log_err(e);
                    msg_container.error = 500;
                    msg_container.msg = "Error on createUser";
                    return reject(msg_container);
                });
        }
        // compare hash (check hash)
        else {
            console.log(`
         ${c.green}passHashFromRequest: ${c.magenta}${passHashFromRequest}
         ${c.green}passHashFromDB: ${c.magenta}${passHashFromDB}
         ${c.green}isEqual: ${c.magenta}${passHashFromRequest === passHashFromDB}${c.white}`);
            if (passHashFromRequest === passHashFromDB) {
                msg_container.msg = "user already exists";
                msg_container.reg_services = user_services;
                msg_container.json_rpc_logins = user_services.map(service => service + "@" + user); // add virtual logins for RPC requests
                msg_container.rest_services_login = user;
                return resolve(msg_container);
            }
            msg_container.error = 401;
            msg_container.msg = "Error bad password";
            return reject(msg_container);
        }
    });

/** get user object from DB */
const getUser = user =>
    new Promise((resolve, reject) =>
        db
            .get()
            .then(db_instance => {
                if (!db_instance) return reject(); // reject if no db instance empty after reconnect
                db_instance
                    .collection(user_col)
                    .findOne({ login: user })
                    .then(userObj => resolve(userObj ? userObj : {}))
                    .catch(e => {
                        console.error("Mongo error on getUser: ", e);
                        reject();
                    });
            })
            .catch(e => {
                reject();
                console.error("connection to MongoDB lost. Error ", e);
            })
    );

/** create new User and return user object from DB */
const createUser = (user, passHash, services) =>
    new Promise((resolve, reject) =>
        db
            .get()
            .then(db_instance => {
                if (!db_instance) return reject(); // reject if no db instance empty after reconnect
                db_instance
                    .collection(user_col)
                    .insertOne({
                        login: user,
                        passHash: passHash,
                        services: services
                    })
                    // get userObj
                    .then(() => {
                        console.log(`${c.green}New user ${c.magenta}${user}${c.green} successfully inserted${c.white}`);
                        return getUser(user)
                            .then(userObj => resolve(userObj))
                            .catch(() => reject());
                    })
                    .catch(e => {
                        console.error("Mongo error on getUser: ", e);
                        reject();
                    });
            })
            .catch(() => {
                reject();
                console.error("connection to MongoDB lost");
            })
    );

/**
 * Check client AUTH
 * - check AUTH JSON-RPC request
 * - check AUTH REST-API request
 * */
exports.checkAuth = (user, pass) =>
    new Promise(async (resolve, reject) => {
        console.log(wid_ptrn("common check user => AUTH request"));
        var msg_container = Object.create(null); // create unprototyped object container
        msg_container = {
            msg: "",
            error: null
        };
        // hash the pass from request
        const passHashFromRequest = crypto
            .createHmac("sha256", secret)
            .update(pass)
            .digest("hex");
        // check if user already exists
        try {
            // getUser object
            var userObject = await getUser(user);
        } catch (e) {
            log_err(e);
            msg_container.error = 500;
            msg_container.msg = "Error on getUser";
            return reject(msg_container);
        }
        // destruct login and passHash
        let { passHash: passHashFromDB } = userObject;
        // compare hashes
        if (passHashFromDB === passHashFromRequest) {
            console.log(c.yellow, "Authorized\n", c.white, userObject);
            return resolve(msg_container);
        }
        msg_container.error = 401;
        msg_container.msg = "Error. Not Authorized";
        console.error("Not Authorized => passHash invalid\n", c.white, userObject);
        return reject(msg_container);
    });

/** Check adapter client by JWT */
exports.adapter = token => new Promise((resolve, reject) => {});
