const cfg = require("../config/config"),
    { color: c } = cfg,
    worker = require("cluster").worker;

const worker_name = "Node Checker";
// response RPC msg
const _msg = {
    error: null,
    msg: null,
    worker: worker_name,
    to: "master_rpc" // default MSG go to master
};

const bootstrap = () =>
    new Promise((resolve, reject) => {
        console.log("bootsraping...");
        setTimeout(() => resolve("done"), 3000);
    });
// handle msg from master
// worker.on("message", msg => {
//     console.log(`${c.green}WORKER[${worker_name}] got MSG\n${c.white}`, msg);
//     // nodeRequest(node_type, method, params)
//     //     .then(node_response => worker.send({
//     //         msg: { ...node_response },
//     //         worker: wid,
//     //         node_type: node_type
//     //     })); // send node_response to master process
// });

exports.sendMsg = msg => {
    console.log(`${c.cyan}WORKER[${c.yellow}${worker_name}${c.cyan}] got MSG${c.white}\n`, msg);
    let { cmd, params } = msg;
    if (cmd === "bootstrap")
        bootstrap().then(result => {
            _msg.msg = "bootstrap " + result;
            worker.send(_msg);
        });
};
