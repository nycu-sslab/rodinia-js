const { performance } = require('perf_hooks');
const { Worker } = require('worker_threads');

async function main(args) {

    return new Promise((resolve, reject) => {

        const first_time = performance.now();

        const proxy = new Worker(__dirname + "/node_proxy_worker.js");

        proxy.postMessage(args);

        proxy.on('message', e => {
            const total_time = performance.now() - first_time;

            console.log("Total time:", total_time);
            proxy.terminate();
            resolve(show_time_result({ ...e, total_time }));
        });

        function show_time_result(e) {

            message_time = e.outer_worker_running_time - e.inner_worker_running_time;

            const total_time = e.total_time;
            const io_time = e.io_time;
            const init_worker_time = e.init_worker_time;

            const est_msg = message_time / e.thread_num;
            const proxy_overhead = e.total_proxy_time ? total_time - e.total_proxy_time : 0;
            const compute_wo_msg = e.compute_time - est_msg;
            const est_total = proxy_overhead + init_worker_time + io_time + compute_wo_msg + est_msg;
            const other = total_time - est_total;

            const output = {
                total_time,
                proxy_overhead,
                io_time,
                init_worker_time,
                compute_wo_msg,
                est_msg,
                other
            };

            console.log(output);
            return output;
        }

    });
}

// const config = require("./node_config.js");
// main(config);

module.exports = main;