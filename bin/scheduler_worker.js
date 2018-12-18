const cfg = require("../config/config"),
    { color: c, checkTimeout } = cfg,
    { $task } = require("../modules/node_management/interface"),
    worker = require("cluster").worker;

const worker_name = "Task Scheduler";
// worker pattern
const cmd_ptrn = cmd => `${c.cyan}worker[${c.yellow}${worker_name}${c.cyan}] exec cmd [${c.magenta}${cmd}${c.cyan}]${c.white}`;
const cmd_done = (cmd, status) =>
    `${c.cyan}worker[${c.yellow}${worker_name}${c.cyan}] cmd [${c.magenta}${cmd}${c.cyan}] completed!
    ${c.green}Status: "${status}"${c.white}`;
const cmd_fail = cmd => `${c.cyan}worker[${c.yellow}${worker_name}${c.red}] cmd [${c.magenta}${cmd}${c.red} FAIL!${c.white}`;
// response RPC msg
const _msg = {
    error: null,
    msg: null,
    worker: worker_name,
    to: "master_rpc" // default MSG go to master
};
// initial task list to bootstrap
const taskList = {
    check: {
        desc: "check all nodes task by timer interval",
        cmd: "check",
        timer: 10000 // 10 sec default timer
    }
};
// todo bootstrap tasks to DB
// add clearInterval(taskName); -> to delete task
// add task CRUD
Object.keys(taskList).forEach(task => {
    console.log(`=== Register new task name '${task}' ===`);
});

/*
 * Scheduler Bootstrap controller
 * load task list to MongoDB
 * */
const bootstrap = () =>
    new Promise((resolve, reject) => {
        console.log(cmd_ptrn("bootstrap task list"));
        // todo Add real bootstrap behavior from CFG to DB
        setTimeout(() => resolve("Task List bootstrapped"), 1000);
    });

/*
 * Task registration
 * - get task by name, timeout and apply to checker worker trough cluster RPC messaging
 * */
const addTask = (task, timeout) => {
    console.log(cmd_ptrn(`Registering new task "${task}" with timeout ${timeout} ms`));
    setInterval(() => {
        console.log(cmd_ptrn(`EXEC task "${task}"`));
        // task applier
        if (task === "checkNodes") {
            _msg.to = "checker";
            _msg.resend = {
                cmd: "check"
            };
            worker.send(_msg);
            //    clear TO,MSG
            _msg.to = "master_rpc";
            _msg.msg = null;
        }
    }, timeout);
};

/*
 * common Scheduler MSG handler entry point
 * */
exports.sendMsg = msg => {
    console.log(`${c.cyan}worker[${c.yellow}${worker_name}${c.cyan}] handle message${c.white}\n`, msg);
    let { cmd, params, from } = msg;
    /*
     * Bootstrap task lists
     * then apply tasks:
     * 1. addTask 'checkNodes' with timeout checkTimeout
     * */
    if (cmd === "bootstrap")
        bootstrap()
            .then(result => {
                console.log(cmd_done("bootstrap task list", result));
                _msg.msg = result;
                worker.send(_msg);
                // register new task
                addTask("checkNodes", checkTimeout);
            })
            .catch(e => {
                _msg.error = e;
                worker.send(_msg);
            });
};
