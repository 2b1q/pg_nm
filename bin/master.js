/*
 * @Scheduler (worker 1):
 * 1. handle Redis-RPC messages/CMDs from Master node
 * 2. execute CMDs
 * CMD executor:
 * - [cluster IPC CMD] 'bootstrap' => create task list and apply tasks (cold start)
 * - [cluster IPC CMD] 'taskList'
 * - [cluster IPC CMD] 'taskStop'
 * - [cluster IPC CMD] 'taskRun'
 * - [cluster IPC CMD] 'taskAdd'
 * Task scheduler:
 * - addTask to task list
 * - apply task
 * - run task
 * [current tasks]:
 * 1. check -> check all nodes by timeout (send cluster IPC CMD to worker @checker)
 * */

/*
 * @Checker (worker 2)
 * 1. handle IPC messages/CMDs from Master node
 * 2. execute CMDs
 * CMD executor:
 * - [cluster IPC CMD] 'bootstrap' => node CFG bootstrapper (load node cfg from file to DB) (cold start)
 * - [cluster IPC CMD] 'check' => checkNode(type, cfg) -> exec RedisRPC to pg_jrpc-proxy -> result will update DB node status
 * - [cluster IPC CMD] 'getBestNode(type)' -> get best node from DB
 * - [cluster IPC CMD] 'getNodes' => get all nodes configs from DB
 * - [cluster IPC CMD] 'getNodeConfig' by ID/nodeHash from DB
 * - [cluster IPC CMD] 'addNode(type, config)' to DB
 * - [cluster IPC CMD] 'rmNode by ID/nodeHash' from DB
 * - [cluster IPC CMD] 'updateNode by ID/nodeHash' in DB
 * */

/*
 * @Master process behavior
 * - init cluster workers
 * - respawn workers on 'die'
 * 0. [MASTER] init Redis-RPC channel connection. Pass CMDs [using IPC] from [Redis-RPC channel] to workers
 * 1. [MASTER] handel Redis-RPC channel events
 * 2. [MASTER] pass events to workers [IPC] using routing
 * 3. [MASTER] Forward events [using IPC] from worker to worker using routing
 * 4. [WORKER] do something and send MSG to master [using IPC]
 * 5. [MASTER] handle [IPC] MSG from worker
 * 6. [MASTER] exec Redis-RPC callback done(err,data)
 * */

let cluster = require("cluster"),
    cfg = require("../config/config"),
    { store, color: c } = cfg,
    { redis: redis_cfg, channel } = store;

const worker_name = "MASTER";

cluster.on("online", worker => console.log(c.magenta + "Worker %d " + c.white + "online", worker.id));

// Fork worker process
var worker;
let workers = 2; // create 2 workers (Scheduler and Checker)
for (let i = 0; i < workers; ++i) worker = cluster.fork();
let rpc_callback; // keep Redis callback
/*
 * Send payload to workers wrapper
 * pass CMD to Scheduler (cold bootstrap)
 * > Scheduler worker bootstrap task list to mongo DB
 * > (then) Scheduler apply tasks
 * > (then) Scheduler will pass CMD to worker CHECKER every TASK retry time
 * */
const sendMsgToScheduler = payload => worker.send({ payload, w1: true });
/*
 * Send payload to workers wrapper
 * pass CMD to Checker (cold bootstrap)
 * > Checker worker bootstrap CFG from config.js to mongo DB
 * > Checker handle CMDs from Scheduler and Master
 *      > (from Scheduler) => run task 'check'
 *      > (from Master) => bootstrap on cold start
 *      > (from RPC channel > Master) => runMethod => 'getBestNode'
 * */
const sendMsgToChecker = payload => worker.send({ payload, w2: true });
// default message to worker 'cmd': 'bootstrap'
const _msg = {
    from: "master",
    cmd: "bootstrap",
    params: {}
};

/*
 * WORKER message handler wrapper
 * - handle messages from workers
 * - route msg from worker to worker
 * - route msg from worker to Redis RPC
 * */
const messageHandler = ({ error, msg, worker, to, resend }) => {
    // cluster MSG debugger
    console.log(
        `${c.cyan}[[${c.yellow}${worker_name}${c.cyan}]] got IPC MSG from ${c.yellow}${worker}${c.cyan} to ${c.yellow}${to}${c.cyan} worker${c.white}\n`,
        {
            msg,
            error,
            resend
        }
    );
    /*
     *  REDIS RPC msg router
     *  - exec callback done(err, data)
     * */
    if (to === "redis_rpc") {
        // to avoid double callbacks. exec rpc_callback only once if rpc_callback === "function"
        if (typeof rpc_callback === "function") {
            // check error from worker
            if (error) {
                rpc_callback(error); // exec Redis RPC callback
                rpc_callback = null; // clear CB after each exec (avoid double callbacks)
                return console.error("RPC callback error:\n", error); // stop flow
            }
            console.log(`${c.magenta}[[${c.yellow}${worker_name}${c.magenta}]] Send MSG to ${c.yellow}${to}${c.magenta}${c.white}\n`, msg);
            // Trigger done handler to fire back rpc result
            // - first arg:  error status
            // - second arg: result data
            rpc_callback(null, {
                msg: msg,
                worker: worker,
                channel: node_rpc_channel
            });
            rpc_callback = null; // clear CB after each exec (avoid double callbacks)
        }
    }
    /*
     * MASTER msg router
     * - handle events to master
     * */
    if (to === "master_rpc") {
        // todo add master error event handler
        if (error) return console.error(`${c.red}Master handle ERROR: "${error}" from ${worker} worker${c.white}`);
        console.log(`${c.cyan}Master handle event from worker ${c.yellow}${worker}${c.white}\n`, msg);
    }
    /*
     * Worker to Worker msg router
     * - ReRout CMD from worker to another worker
     * */
    if (resend) {
        let { cmd, params } = resend;
        // construct internal RPC payload
        _msg.from = worker;
        _msg.cmd = cmd;
        _msg.params = params || {};
        // Rout MSG to workers
        if (to === "checker") sendMsgToChecker(_msg);
        if (to === "scheduler") sendMsgToScheduler(_msg);
    }
};
// forever message handler from workers
// for (const id in cluster.workers) cluster.workers[id].once("message", messageHandler);
cluster.on("message", (worker, message) => messageHandler(message));

// pass CMD to Scheduler (cold bootstrap)
sendMsgToScheduler(_msg);
// Checker cold bootstrap
sendMsgToChecker(_msg);

/** REDIS RPC + cluster IPC chatting behavior */
const node_rpc_channel = channel.nm("master");
const redisRpc = new (require("node-redis-rpc"))(redis_cfg);
console.log(`${c.yellow}[MASTER node]: Init Redis-RPC service "${node_rpc_channel}"${c.white}`);
/*
 * NM Redis RPC handler
 * */
redisRpc.on(node_rpc_channel, ({ payload }, channel, done) => {
    console.log(`${c.yellow}[MASTER node] channel: "${channel}". Redis-RPC Incoming Data>>>\n${c.white}`, payload);
    let { to = "checker", method, params } = payload;
    if (!method) return done("payload method required");
    rpc_callback = done;
    // construct internal RPC payload
    _msg.from = "Redis RPC channel:" + channel;
    _msg.cmd = method;
    _msg.params = params || {};
    // Rout MSG to workers
    if (to === "checker") sendMsgToChecker(_msg);
    if (to === "scheduler") sendMsgToScheduler(_msg);
    // handle messages from workers
    cluster.once("message", (worker, message) => messageHandler(message));
    // for (const id in cluster.workers) cluster.workers[id].once("message", messageHandler);
});

/*
 * [WORKER] respawner
 * if worker 'disconnect' from IPC channel
 * */
cluster.on("exit", (deadWorker, code, signal) => {
    console.error("Worker PID %d died with code %d. Respawn worker", deadWorker.process.pid, code);
    worker = cluster.fork();
    console.log("New Worker PID: ", worker.process.pid);
});
