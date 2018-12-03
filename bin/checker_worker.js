const cfg = require("../config/config"),
    { color: c } = cfg;
const worker = require("cluster").worker,
    { id: wid } = worker; // access to cluster.worker.id

const worker_name = "Checker";

// handle msg from master
worker.on("message", msg => {
    console.log(`${c.green}WORKER[${worker_name}] got MSG\n${c.white}`, msg);
    // nodeRequest(node_type, method, params)
    //     .then(node_response => worker.send({
    //         msg: { ...node_response },
    //         worker: wid,
    //         node_type: node_type
    //     })); // send node_response to master process
});
