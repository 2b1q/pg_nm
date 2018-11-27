const MongoClient = require("mongodb").MongoClient,
    cfg = require("../config/config");

let db = null, // reference to db
    { uri, dbname, options, dbpass, dbuser } = cfg.store.mongo,
    c = cfg.color;
let dsn = `mongodb://${dbuser}:${dbpass}@${uri}/${dbname}`;

/** get DB instance Promise */
exports.get = () =>
    new Promise((resolve, reject) => {
        if (db) {
            db.stats()
                .then(resolve(db)) // Try get stats from "DB instance" then resolve "DB instance object" reference
                .catch(e => {
                    db = null; // clear bad reference to "DB instance object"
                    reject(e);
                });
        } else {
            MongoClient.connect(
                dsn,
                options
            )
                .then(client => {
                    db = client.db(dbname);
                    console.log(`${c.green}[i] connected to MongoDB ${c.magenta}mongodb://${uri}/${dbname}${c.white}`);
                    resolve(db);
                })
                .catch(e => {
                    db = null; // clear bad reference to "DB instance object"
                    console.error(`${c.red}Failed connect to DB:\n${c.yellow}${e}${c.white}`);
                    reject(e);
                });
        }
    });

/** check DB connection under pgw user */
if (!db) {
    MongoClient.connect(
        dsn,
        options
    ).catch(e => {
        console.error(`${c.red}[E] Failed connect to DB:\n${c.yellow}${e}${c.white}`);
        console.log(`${c.green}[i] Creating mongo user: ${c.magenta}${dbuser}${c.green} in DB ${dbname}${c.white}`);
        MongoClient.connect(
            `mongodb://root:toor@${uri}/admin`,
            { useNewUrlParser: true }
        )
            .then(client => {
                let pgwdb = client.db(dbname);
                addUser(pgwdb)
                    .then(() => {})
                    .catch(({ errmsg }) => console.error(errmsg));
                client.close(); // Close the connection
            })
            .catch(e => console.error(`${c.red}[E] DB user create Failed. ${c.white}`, e.errmsg));
    });
}

// addUser
const addUser = db =>
    new Promise((resolve, reject) => {
        db.addUser(dbuser, dbpass, { roles: ["readWrite", "dbAdmin"] }, (err, result) => {
            if (err) return reject(err);
            console.log(`${c.green}[i] user ${c.magenta}${dbuser}${c.green} successfully created.\n ${c.magenta}`, c.white);
            resolve(result);
        });
    });
