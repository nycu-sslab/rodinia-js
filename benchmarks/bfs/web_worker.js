"use strict"

var no_of_nodes, h_graph_mask, h_graph_nodes, h_graph_edges,
    h_graph_visited, h_cost, h_updating_graph_mask, stop, thread_num, chunk;

addEventListener('message', function (e) {
    const first_time = performance.now();

    const data = e.data;

    if (data.msg == "start") {
        no_of_nodes = data.no_of_nodes;
        h_graph_nodes = data.h_graph_nodes;
        thread_num = data.thread_num;

        chunk = (no_of_nodes / thread_num) | 0;

        h_graph_mask = data.h_graph_mask;
        h_graph_edges = data.h_graph_edges;
        h_graph_visited = data.h_graph_visited;
        h_cost = data.h_cost;
        h_updating_graph_mask = data.h_updating_graph_mask;
        stop = data.stop;

        const run_time = performance.now() - first_time;

        postMessage({
            msg: "done",
            run_time,
        });
    } else if (data.msg == "func1") {
        func1(data.thread_id);

        const run_time = performance.now() - first_time;

        // console.log("job1 takes time:", run_time, "ms");

        postMessage({
            msg: "done1",
            run_time,
        });
    } else if (data.msg == "func2") {
        func2(data.thread_id);

        const run_time = performance.now() - first_time;
        // console.log("job2 takes time:", run_time, "ms");

        postMessage({
            msg: "done2",
            run_time,
        });
    }

});

function func1(thread_id) {

    const start = thread_id * chunk;
    const end = thread_id == thread_num - 1 ? no_of_nodes : (thread_id + 1) * chunk;

    for (var tid = start; tid < end; tid++) {
        if (h_graph_mask[tid] == 1) {
            h_graph_mask[tid] = 0;
            for (var i = h_graph_nodes[2 * tid]; i < (h_graph_nodes[2 * tid + 1] + h_graph_nodes[2 * tid]); i++) {
                var id = h_graph_edges[i];
                if (!h_graph_visited[id]) {
                    h_cost[id] = h_cost[tid] + 1;
                    h_updating_graph_mask[id] = 1;
                }
            }
        }
    }
}


function func2(thread_id) {
    const start = thread_id * chunk;
    const end = thread_id == thread_num - 1 ? no_of_nodes : (thread_id + 1) * chunk;

    for (var tid = start; tid < end; tid++) {
        if (h_updating_graph_mask[tid] == 1) {
            h_graph_mask[tid] = 1;
            h_graph_visited[tid] = 1;
            stop[0] = 1;
            h_updating_graph_mask[tid] = 0;
        }
    }
}