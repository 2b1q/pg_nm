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

cluster.on("online", worker => {
    console.log(c.magenta + "Worker %d " + c.white + "online", worker.id);
});

// Fork worker process
var worker;
let workers = 2; // create 2 workers (Scheduler and Checker)
for (let i = 0; i < workers; ++i) worker = cluster.fork();

// Send payload to workers
const sendMsgToScheduler = payload => worker.send({ payload: payload, w1: true });
const sendMsgToChecker = payload => worker.send({ payload: payload, w2: true });

//debug
// console.log(Object.keys(cluster.workers).forEach(key => console.log(key)));
sendMsgToChecker("test 1111111");
sendMsgToScheduler("hello On start");
sendMsgToChecker("test 1111111");
setTimeout(() => sendMsgToScheduler("hello after respawn"), 3000);

/** REDIS RPC + cluster RPC chatting behavior */
const node_rpc_channel = channel.nm("master");
const redisRpc = require("node-redis-rpc");
console.log(`[MASTER node]: Init RPC service "${node_rpc_channel}"`);
const rpc = new redisRpc(redis_cfg);
// RPC handler
rpc.on(node_rpc_channel, ({ payload }, channel, done) => {
    if (payload) console.log(`${c.yellow}[MASTER node] channel: "${channel}". RPC Data>>>\n${c.white}`, payload);
    else return done("no payload");
    // send MSG to Random Worker
    sendMsgToScheduler(payload);
    // MSG handler from WORKER
    const messageHandler = ({ msg, worker, node_type }) => {
        // check error from worker
        if (msg.error) return done(error);
        // Trigger done handler to fire back rpc result
        // - first arg:  error status
        // - second arg: result data
        done(null, {
            msg: msg,
            worker: worker,
            channel: node_rpc_channel,
            node_type: node_type
        });
    };
    // handle message from worker
    for (const id in cluster.workers) cluster.workers[id].once("message", messageHandler);
});

/*
 * [WORKER] respawner
 * if worker 'disconnect' from IPC channel
 * */
cluster.on("exit", (deadWorker, code, signal) => {
        console.log("Worker PID %d died. Respawn worker", deadWorker.process.pid);
        worker = cluster.fork();
        console.log("New Worker PID: ", worker.process.pid);
});
