// todo add Scheduler (worker 1):
//  - taskBootstrapper (cold start)
//  - task List
//  - task applier (on RPC redis MSG (on demand), OR by schedule (every 5 min))
// todo add Checker (worker 2)
//  - node CFG bootstrapper (load node cfg from file to DB) (cold start)
//  - [TASK] checker (exec redis RPC lastblock for all nodes)
//  - [method] getBestNode
//  - task runner (check task from list, run task)
// todo Master RPC handler
// todo ADD msging with workers trough redis channels (after respawning worker have new pids and IDs)

/*
 * Master process behavior
 * 0. [MASTER] init RPC channel connection
 * 1. [MASTER] handel RPC channel events
 * 2. [MASTER] pass events to random [WORKER] process
 * 3. [WORKER] do something
 * 4. [MASTER] handle MSG from worker
 * 5. [MASTER] exec RPC callback done(err,data)
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

// MSG handler from WORKER
const messageHandler = ({ msg, worker, to }) => {
    console.log(
        `${c.cyan}[[${c.yellow}${worker_name}${c.cyan}]] got MSG from ${c.magenta}${worker}${c.cyan} to ${c.magenta}${to}${c.cyan} worker${c.white}\n`,
        {
            msg: msg
        }
    );
    // handle events to REDIS RPC
    if (to === "redis_rpc") {
        // check error from worker
        if (msg.error) return done(error);
        // Trigger done handler to fire back rpc result
        // - first arg:  error status
        // - second arg: result data
        done(null, {
            msg: msg,
            worker: worker,
            channel: node_rpc_channel
        });
    }
    // handle events to master
    if (to === "master_rpc") {
        console.log("got internal message from %s worker. MSG:\n", worker, msg);
    }
};
// handle message from workers
for (const id in cluster.workers) cluster.workers[id].once("message", messageHandler);

// Send payload to workers
const sendMsgToScheduler = payload => worker.send({ payload, w1: true });
const sendMsgToChecker = payload => worker.send({ payload, w2: true });
// message to worker
const _msg = {
    from: "master",
    cmd: "bootstrap",
    params: {}
};
// pass CMD to Scheduler (cold bootstrap)
sendMsgToScheduler(_msg);
// pass CMD to Checker(cold bootstrap)
sendMsgToChecker(_msg);

/** REDIS RPC + cluster RPC chatting behavior */
const node_rpc_channel = channel.nm("master");
const redisRpc = require("node-redis-rpc");
console.log(`[MASTER node]: Init RPC service "${node_rpc_channel}"`);
const rpc = new redisRpc(redis_cfg);
// RPC handler
rpc.on(node_rpc_channel, ({ payload }, channel, done) => {
    if (payload) console.log(`${c.yellow}[MASTER node] channel: "${channel}". RPC Data>>>\n${c.white}`, payload);
    else return done("no payload");
    // construct internal RPC payload
    _msg.from = "Redis RPC channel:" + channel;
    _msg.cmd = payload.method;
    _msg.params = payload.params || {};
    let to = payload.to || "checker"; // 'checker' OR 'scheduler'
    // Rout MSG to workers
    if (to === "checker") sendMsgToChecker(payload);
    if (to === "scheduler") sendMsgToScheduler(payload);
    // handle message from worker
    for (const id in cluster.workers) cluster.workers[id].once("message", messageHandler);
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
