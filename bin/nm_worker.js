const worker = require("cluster").worker;
// cluster RPC message router
worker.on("message", ({ payload, w1, w2 }) => require(w1 ? "./scheduler_worker" : "./checker_worker").sendMsg(payload));
