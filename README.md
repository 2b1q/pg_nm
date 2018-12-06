# PaymentGateway node manager [PG_nm]

**PG_nm** is stateless async microservice with Redis RPC interaction  

### Components ###
* node.js vertical cluster ([MASTER] fork [WORKER] processes by worler types) 
* [MASTER] Redis RPC channel event handler. Cluster CMD routing
* [WORKER Checker] exec cluster RPC CMD.
* [WORKER Scheduled] task scheduler/runner/manager
    
### Master process behavior ###
     @Master process behavior
     - init cluster workers
     - respawn workers on 'die'
     0. [MASTER] init RPC channel connection. Pass CMDs from RedisRPC to workers
     1. [MASTER] handel RPC channel events
     2. [MASTER] pass events to workers using routing
     3. [MASTER] Forward events from worker to worker using routing
     4. [WORKER] do something
     5. [MASTER] handle MSG from worker
     6. [MASTER] exec RPC callback done(err,data)

### Scheduler process behavior ###
     @Scheduler (worker 1):
     1. handle RPC messages/CMDs from Master node
     2. execute CMDs
     [CMD executor]:
     - [cluster RPC CMD] 'bootstrap' => create task list and apply tasks (cold start)
     - [cluster RPC CMD] 'taskList'
     - [cluster RPC CMD] 'taskStop'
     - [cluster RPC CMD] 'taskRun'
     - [cluster RPC CMD] 'taskAdd'
     [Task scheduler]:
     - addTask to task list
     - apply task
     - run task
     [current tasks]:
     1. check -> check all nodes by timeout (send cluster RPC CMD to worker @checker)

### Checker process behavior ###
     @Checker (worker 2)
     1. handle RPC messages/CMDs from Master node
     2. execute CMDs
     [CMD executor]:
     - [cluster RPC CMD] 'bootstrap' => node CFG bootstrapper (load node cfg from file to DB) (cold start)
     - [cluster RPC CMD] 'check' => checkNode(type, cfg) -> exec RedisRPC to pg_jrpc-proxy -> result will update DB node status
     - [cluster RPC CMD] 'getBestNode(type)' -> get best node from DB
     - [cluster RPC CMD] 'getNodes' => get all nodes configs from DB
     - [cluster RPC CMD] 'getNodeConfig' by ID/nodeHash from DB
     - [cluster RPC CMD] 'addNode(type, config)' to DB
     - [cluster RPC CMD] 'rmNode by ID/nodeHash' from DB
     - [cluster RPC CMD] 'updateNode by ID/nodeHash' in DB

 
## architecture ##

