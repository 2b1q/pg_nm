const cfg = require("../config/config"),
    { color: c } = cfg,
    worker = require("cluster").worker;

const worker_name = "Task Scheduler";
// worker pattern
const cmd_ptrn = cmd => `${c.cyan}WORKER[${c.yellow}${worker_name}${c.cyan}] exec cmd [${c.magenta}${cmd}${c.cyan}]${c.white}`;
const cmd_done = (cmd, status) =>
    `${c.cyan}WORKER[${c.yellow}${worker_name}${c.cyan}] cmd [${c.magenta}${cmd}${c.cyan}] completed!
    ${c.green}Status: "${status}"${c.white}`;
const cmd_fail = cmd => `${c.cyan}WORKER[${c.yellow}${worker_name}${c.red}] cmd [${c.magenta}${cmd}${c.red} FAIL!${c.white}`;
// response RPC msg
const _msg = {
    error: null,
    msg: null,
    worker: worker_name,
    to: "master_rpc" // default MSG go to master
};

/*
 * Scheduler Bootstrap controller
 * load task list to MongoDB
 * */
const bootstrap = () =>
    new Promise((resolve, reject) => {
        console.log(cmd_ptrn("bootstrapping task list..."));
        setTimeout(() => resolve("Task List bootstrapped"), 10000);
    });

/*
 * common Scheduler MSG handler entry point
 * */
exports.sendMsg = msg => {
    console.log(`${c.cyan}WORKER[${c.yellow}${worker_name}${c.cyan}] handle message${c.white}\n`, msg);
    let { cmd, params, from } = msg;
    if (cmd === "bootstrap")
        bootstrap()
            .then(result => {
                console.log(cmd_done("bootstrap", result));
                _msg.msg = result;

                worker.send(_msg);

                //    todo EXEC tasks
                //    run check every XXX ms
                //     _msg.to = "checker";
                //     _msg.resend = {
                //         cmd: "exec check"
                //     };
            })
            .catch(e => {
                _msg.error = e;
                worker.send(_msg);
            });
};
