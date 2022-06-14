var total_proxy_time = 0;
var compute_time = 0;
var inner_worker_running_time = 0;
var outer_worker_running_time = 0;
var init_worker_time = 0;
var io_time = 0;
var message_time = 0;

var thread_num;

addEventListener('message', async function (e) {
    await main({
        thread_num: 4,
        filename: "data.txt"
    });

    postMessage({
        "done": true,
        total_proxy_time,
        compute_time,
        inner_worker_running_time,
        outer_worker_running_time,
        init_worker_time,
        io_time,
        message_time,
        thread_num
    })
}, false);

//Structure to hold a node information
var Node = {
    starting: null,
    no_of_edges: null
};

////////////////////////////////////////////////////////////////////////////////
// Main Program
////////////////////////////////////////////////////////////////////////////////
async function main(argc) {
    var start_time = performance.now();
    const result = await BFSGraph(argc);
    var end_time = performance.now();

    total_proxy_time = end_time - start_time;
    console.log("Total proxy time:", total_proxy_time);

    // await checkResult(result);
}

async function init_workers(thread_num, params) {
    // const time_marker = performance.now();

    return new Promise((resolve, reject) => {
        function handleWorker( /* args */) {
            return new Promise((resolve, reject) => {
                // create worker, do stuff
                const worker = new Worker("web_worker.js");

                worker.postMessage(params);
                worker.onmessage = function (e) {
                    // inner_worker_running_time += e.data.run_time;
                    // outer_worker_running_time += performance.now() - time_marker;
                    resolve(worker);
                }

                worker.onerror = function (err) {
                    reject(err)
                }
            })
        }

        var workers = [];

        for (var i = 0; i < thread_num; i++) {
            workers.push(handleWorker( /* arg */))
        }

        Promise.all(workers)
            .then(res => {
                console.log("all workers started")
                resolve(res);
            })
            // handle error
            .catch(err => {
                reject(err)
            });
    });
}

////////////////////////////////////////////////////////////////////////////////
//Apply BFS on a Graph using CUDA
////////////////////////////////////////////////////////////////////////////////
async function BFSGraph(argc) {
    var no_of_nodes = 0;
    var edge_list_size = 0;
    thread_num = argc.thread_num;
    var workers;

    // num_omp_threads = argc.num_omp_threads;
    // input_f = argc.input_f;

    var io_time_marker = performance.now();
    console.log("Reading File\n");
    //Read in Graph from a file
    var data = await fetch(argc.filename);

    var text = await data.text();

    data = text.toString().split("\n");

    var source = 0;

    var line_counter = 0;
    no_of_nodes = Number(data[line_counter++]);

    // allocate host memory
    var h_graph_nodes = [];
    var h_graph_mask_buf = new SharedArrayBuffer(no_of_nodes * Int8Array.BYTES_PER_ELEMENT)
    var h_updating_graph_mask_buf = new SharedArrayBuffer(no_of_nodes * Int8Array.BYTES_PER_ELEMENT)
    var h_graph_visited_buf = new SharedArrayBuffer(no_of_nodes * Int8Array.BYTES_PER_ELEMENT)

    var h_graph_mask = new Int8Array(h_graph_mask_buf);
    var h_updating_graph_mask = new Int8Array(h_updating_graph_mask_buf);
    var h_graph_visited = new Int8Array(h_graph_visited_buf);

    var start, edgeno;

    var h_graph_nodes_buf = new SharedArrayBuffer(2 * no_of_nodes * Int32Array.BYTES_PER_ELEMENT);
    var h_graph_nodes = new Int32Array(h_graph_nodes_buf);

    // initalize the memory
    for (var i = 0; i < no_of_nodes; i++) {
        var tmp_data = data[line_counter++].split(" ");
        start = Number(tmp_data[0]);
        edgeno = Number(tmp_data[1]);

        h_graph_nodes[2 * i] = start;
        h_graph_nodes[2 * i + 1] = edgeno;

        h_graph_mask[i] = 0;
        h_updating_graph_mask[i] = 0;
        h_graph_visited[i] = 0;
    }

    line_counter++;

    //read the source node from the file
    source = Number(data[line_counter++]);

    line_counter++;

    //set the source node as 1 in the mask
    h_graph_mask[source] = 1;
    h_graph_visited[source] = 1;

    edge_list_size = Number(data[line_counter++]);

    console.log("edge_list_size", edge_list_size)

    var _id, cost;
    var h_graph_edges_buf = new SharedArrayBuffer(edge_list_size * Int32Array.BYTES_PER_ELEMENT);
    var h_graph_edges = new Int32Array(h_graph_edges_buf);
    for (var i = 0; i < edge_list_size; i++) {
        var tmp_data = data[line_counter++].split(" ");
        _id = Number(tmp_data[0]);
        cost = Number(tmp_data[1]); // no used
        h_graph_edges[i] = _id;
    }

    // allocate mem for the result on host side
    var h_cost_buf = new SharedArrayBuffer(no_of_nodes * Int32Array.BYTES_PER_ELEMENT)
    var h_cost = new Int32Array(h_cost_buf)
    for (var i = 0; i < no_of_nodes; i++)
        h_cost[i] = -1;
    h_cost[source] = 0;

    io_time += performance.now() - io_time_marker;

    console.log("Start traversing the tree");

    var k = 0;

    var stop_buf = new SharedArrayBuffer(1 * Int8Array.BYTES_PER_ELEMENT);
    var stop = new Int8Array(stop_buf);


    var start_time_worker = performance.now();
    workers = await init_workers(thread_num, {
        msg: "start",
        no_of_nodes,
        h_graph_nodes,
        h_graph_mask,
        h_graph_edges,
        h_graph_visited,
        h_cost,
        h_updating_graph_mask,
        stop,
        thread_num
    });
    init_worker_time += performance.now() - start_time_worker;


    var barrier_buf = new SharedArrayBuffer(1 * Int8Array.BYTES_PER_ELEMENT);
    var barrier = new Int8Array(barrier_buf);


    var start_time = performance.now();

    do {
        //if no thread changes this value then the loop stops
        stop[0] = 0;

        await new Promise((resolve, reject) => {
            const time_marker = performance.now();

            Atomics.store(barrier, 0, 0)

            for (let i = 0; i < thread_num; i++) {
                workers[i].onmessage = e => {
                    inner_worker_running_time += e.data.run_time;
                    outer_worker_running_time += performance.now() - time_marker;

                    if (e.data.msg == "done1") {
                        Atomics.add(barrier, 0, 1);

                        if (Atomics.load(barrier, 0) == thread_num) {
                            Atomics.store(barrier, 0, 0)

                            resolve();
                        }
                    }
                };

                workers[i].postMessage({
                    msg: "func1",
                    thread_id: i
                });
            }
        });

        await new Promise((resolve, reject) => {
            const time_marker = performance.now();

            Atomics.store(barrier, 0, 0)

            for (let i = 0; i < thread_num; i++) {

                workers[i].onmessage = e => {
                    if (e.data.msg == "done2") {
                        inner_worker_running_time += e.data.run_time;
                        outer_worker_running_time += performance.now() - time_marker;

                        Atomics.add(barrier, 0, 1);

                        if (Atomics.load(barrier, 0) == thread_num) {
                            Atomics.store(barrier, 0, 0)

                            resolve();
                        }
                    }
                };

                workers[i].postMessage({
                    msg: "func2",
                    thread_id: i
                });
            }
        });

        console.log("round: ", k)
        k++;
    }
    while (stop[0]);

    compute_time = performance.now() - start_time;
    console.log("Compute time:", compute_time);

    //Store the result into a file
    var result = [];
    for (var i = 0; i < no_of_nodes; i++)
        result.push(`${i}) cost:${h_cost[i]}`)

    console.log("Result stored in result.txt");

    return result;
}

async function checkResult(result) {
    var data = await fetch("answer.txt");
    var answer = (await data.text()).split('\n');

    var correct = true;
    for (var i = 0; i < result.length; i++) {
        if (result[i].trim() != answer[i].trim()) {
            console.error(`Line ${i}: ${result[i]} != ${answer[i]}`);
            correct = false;
            break;
        }
    }
    if (correct) {
        console.log("Result correct.")
    } else {
        console.error("Result incorrect.")
    }
}
