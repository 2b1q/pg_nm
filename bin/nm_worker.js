// const express = require("express"),
//     { id: wid } = require("cluster").worker, // access to cluster.worker.id
//     http = require("http"),
//     bodyParser = require("body-parser"),
//     cfg = require("../config/config"),
//     c = cfg.color,
//     node_proxy = require("../modules/node_interaction/node_rpc_client"),
//     env = process.env.NODE_ENV;

const { id: wid } = require("cluster").worker; // access to cluster.worker.id

/** simple RPC behavior */
const _channel = 'node_mgmt';
const redisRpc = require('node-redis-rpc');
const config = {
    host: 'redis', // redis server hostname
    port: 6379,        // redis server port
    scope: 'test'      // use scope to prevent sharing messages between "node redis rpc"
};
const msg = {
    msg:'hello from '+ _channel,
    service: _channel
};
console.log(`Worker: [${wid}] Init RPC service "${_channel}"`);
const rpc = new redisRpc(config);
// RPC handler
rpc.on(_channel, (data, channel, done) =>{
    if(data) console.log(`Worker: [${wid}] channel: "${channel}". RPC Data>>>\n`, data);
    // Trigger done handler to fire back rpc result
    // - first arg:  error status
    // - second arg: result data
    done(null, msg);
});


// /**
//  * Setup Node HTTP server
//  */
// // Normalize a port into a number, string, or false
// const port = normalizePort(process.env.PORT || cfg.server.port); // HTTP SRV port
// function normalizePort(val) {
//     let p = parseInt(val, 10);
//     if (p >= 0) return p; // port number
//     if (isNaN(p)) return val; // named pipe
//     return false;
// }
//
// /** init express framework */
// const app = express();
// /** configure express app stack */
// app.use(bodyParser.json({ type: req => true })) // parse any Content-type as json
//     .use(bodyParser.urlencoded({ extended: false }))
//     // handle JSON parse error
//     .use((err, req, res, next) => (err ? res.status(400).json({ error: "invalid json" }) : next()))
//     .use((req, res, next) => {
//         if (env !== "production") {
//             console.log(`${c.green}WORKER[${c.cyan}${wid}${c.green}]${c.white}`);
//             console.log(c.green, "req headers\n", c.white, req.headers);
//             console.log(c.green, "req query\n", c.white, req.query);
//             console.log(c.green, "req body\n", c.white, req.body);
//             console.log(c.green, "req.url: ", c.white, req.url);
//         }
//         res.removeHeader("X-Powered-By"); // drop "X-Powered-By" header
//         next();
//     })
//     // proxying node-RPC requests
//     .use((req, res, next) => {
//         let { jsonrpc } = req.body;
//         !jsonrpc ? next() : node_proxy.proxy(req, res);
//     })
//     .use("/api", require("../routes/services")) // attach API router
//     .use((req, res) => res.status(404).json(cfg.errors["404"])) // Last ROUTE catch 404 and forward to error handler
//     // error handler
//     .use((err, req, res) => {
//         // set locals, only providing error in development
//         res.locals.message = err.message;
//         res.locals.error = env === "string" || env === "dev" ? err : {};
//         res.status(err.status || 500);
//         res.json(cfg.errors.crash(err));
//         console.error(err.message);
//     })
//     .set("port", cfg.server.ip + ":" + port); // set HTTP server port
//
// /** Create HTTP server */
// const server = http.createServer(app); // create HTTP server for REST API requests
// server.listen(port); // Listen Node server on provided port
//
// /** Server events ['error', 'listening'] handler */
// server
//     .on("error", error => {
//         if (error.syscall !== "listen") throw error;
//         let addr = server.address();
//         let bind = typeof addr === "string" ? "pipe " + addr : addr.port;
//         // handle specific listen errors with friendly messages
//         switch (error.code) {
//             case "EACCES":
//                 console.error(`${bind} requires elevated privileges`);
//                 process.exit(1);
//                 break;
//             case "EADDRINUSE":
//                 console.error(`${bind} is already in use`);
//                 process.exit(1);
//                 break;
//             default:
//                 throw error;
//         }
//     }) // server event hanlers 'on.error'
//     .on("listening", () => {
//         let addr = server.address();
//         let bind = typeof addr === "string" ? "pipe " + addr : addr.port;
//         console.log(`${c.cyan}WORKER[${wid}] ${c.green}REST API server${c.cyan} listen port ${c.green}${bind}${c.cyan}`);
//     });
