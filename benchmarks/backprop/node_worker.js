"use strict"
const { parentPort } = require('worker_threads');
const { performance } = require('perf_hooks');

var net, thread_num, thread_id;

const ETA = 0.3;      //eta value
const MOMENTUM = 0.3; //momentum value

/*** The squashing function.  Currently, it's a sigmoid. ***/
function squash(x) {
    return (1.0 / (1.0 + Math.exp(-x)));
}


parentPort.on('message', function (e) {
    const first_time = performance.now();

    const data = e;

    if (data.msg == "start") {

        net = data.net;
        thread_id = data.thread_id;
        thread_num = data.thread_num;

        const run_time = performance.now() - first_time;

        parentPort.postMessage({
            msg: "done",
            run_time,
        });
    } else if (data.msg == "func1") {

        func1(data.step);

        const run_time = performance.now() - first_time;

        parentPort.postMessage({
            msg: "done1",
            run_time,
        });
    } else if (data.msg == "func2") {

        func2(data.step);

        const run_time = performance.now() - first_time;

        parentPort.postMessage({
            msg: "done2",
            run_time,
        });
    }

});

function func1(step) {
    var l1, l2, conn, n1, n2;
    var j, k, sum;

    if (step == 1) {
        l1 = net.input_units;
        l2 = net.hidden_units;
        conn = net.input_weights;
        n1 = net.input_n;
        n2 = net.hidden_n;
    } else {
        l1 = net.hidden_units;
        l2 = net.output_units;
        conn = net.hidden_weights;
        n1 = net.hidden_n;
        n2 = net.output_n;
    }

    const thread_per_chunk = (n2 / thread_num) | 0;

    var start = thread_per_chunk * thread_id == 0 ? 1 : thread_per_chunk * thread_id;

    var end = thread_id == thread_num - 1 ? n2 : thread_per_chunk * (thread_id + 1);

    for (j = start; j <= end; j++) {

        /*** Compute weighted sum of its inputs ***/
        sum = 0.0;
        for (k = 0; k <= n1; k++) {
            sum += conn[k][j] * l1[k];
        }
        l2[j] = squash(sum);
    }
}

function func2(step) {
    var delta, ndelta, ly, nly, w, oldw;
    var new_dw;
    var k, j;

    if (step == 1) {
        delta = net.output_delta;
        ndelta = net.output_n;
        ly = net.hidden_units;
        nly = net.hidden_n;
        w = net.hidden_weights;
        oldw = net.hidden_prev_weights;
    } else {
        delta = net.hidden_delta;
        ndelta = net.hidden_n;
        ly = net.input_units;
        nly = net.input_n;
        w = net.input_weights;
        oldw = net.input_prev_weights;
    }

    const thread_per_chunk = (ndelta / thread_num) | 0;

    var start = thread_per_chunk * thread_id == 0 ? 1 : thread_per_chunk * thread_id;

    var end = thread_id == thread_num - 1 ? ndelta : thread_per_chunk * (thread_id + 1);

    for (j = start; j <= end; j++) {
        for (k = 0; k <= nly; k++) {
            new_dw = ((ETA * delta[j] * ly[k]) + (MOMENTUM * oldw[k][j]));
            w[k][j] += new_dw;
            oldw[k][j] = new_dw;
        }
    }
}