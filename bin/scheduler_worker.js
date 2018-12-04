const cfg = require("../config/config"),
    { color: c } = cfg,
    worker = require("cluster").worker;

const worker_name = "Task Scheduler";
// response RPC msg
const _msg = {
    error: null,
    msg: null,
    worker: worker_name
};

// // handle msg from master
// worker.on("message", msg => {
//     console.log(`${c.green}WORKER[${worker_name}] got MSG\n${c.white}`, msg);
//     // nodeRequest(node_type, method, params)
//     //     .then(node_response => worker.send({
//     //         msg: { ...node_response },
//     //         worker: wid,
//     //         node_type: node_type
//     //     })); // send node_response to master process
// });
//
// setTimeout(() => console.log(ddss), 1000);

exports.sendMsg = msg => console.log(`${c.cyan}WORKER[${c.yellow}${worker_name}${c.cyan}] got MSG${c.white}\n`, msg);
