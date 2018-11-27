let cluster = require("cluster"),
    config = require("../config/config");

// if worker 'disconnect' from IPC channel
cluster.on("disconnect", (worker, code, signal) => {
    console.log("Worker %d died", worker.id);
    cluster.fork();
});

cluster.on("online", worker => console.log(config.color.magenta + "Worker %d " + config.color.white + "online", worker.id));

let cpuCount = 1;

// fork workers by CPU cores
for (let i = 0; i < cpuCount; ++i) cluster.fork();
