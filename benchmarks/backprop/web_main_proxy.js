var total_time = 0;
var total_proxy_time = 0;
var compute_time = 0;
var inner_worker_running_time = 0;
var outer_worker_running_time = 0;
var init_worker_time = 0;
var io_time = 0;
var message_time = 0;

var barrier_buf = new SharedArrayBuffer(1 * Int8Array.BYTES_PER_ELEMENT);
var barrier = new Int8Array(barrier_buf);

function my_rand(i) {
    // return (float)rand() / RAND_MAX;
    return 0.0001 * i;
}

var layer_size = 0;
var middle_layer_size = 0;
var file_name = "";
var workers, thread_num;

const BPNN =
{
    input_n: undefined,                 /* number of input units */
    hidden_n: undefined,                 /* number of hidden units */
    output_n: undefined,                /* number of output units */
    input_units: undefined,          /* the input units */
    hidden_units: undefined,         /* the hidden units */
    output_units: undefined,         /* the output units */
    hidden_delta: undefined,        /* storage for hidden unit error */
    output_delta: undefined,       /* storage for output unit error */
    target: undefined, /* storage for target vector */
    input_weights: undefined,     /* weights from input to hidden layer */
    hidden_weights: undefined,   /* weights from hidden to output layer */
    /*** The next two are for momentum ***/
    input_prev_weights: undefined, /* previous change on input to hidden wgt */
    hidden_prev_weights: undefined, /* previous change on hidden to output wgt */
};

addEventListener('message', async function (e) {
    await main({
        layer_size: 10000,
        middle_layer_size: 2048,
        thread_num: 4,
        file_name: "./inputGen/10000.txt"
    })


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

async function init_workers(thread_num, params) {
    return new Promise((resolve, reject) => {
        function handleWorker(thread_id) {
            return new Promise((resolve, reject) => {
                // create worker, do stuff
                const worker = new Worker("web_worker.js");

                params["thread_id"] = thread_id;
                worker.postMessage(params);

                worker.onmessage = function (e) {
                    resolve(worker);
                }
                worker.onerror = function (err) {
                    reject(err)
                }

            })
        }

        var workers = [];

        for (var i = 0; i < thread_num; i++) {
            workers.push(handleWorker(i))
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
// Main Program
////////////////////////////////////////////////////////////////////////////////
async function main(args) {

    var proxy_marker = performance.now();

    middle_layer_size = args.middle_layer_size;
    layer_size = args.layer_size;
    file_name = args.file_name;
    thread_num = args.thread_num;
    await backprop_face();

    total_proxy_time = performance.now() - proxy_marker;
}

async function downloadAsync(url) {
    const file = await fetch(url);
    return file.text();
}
async function load(net) {

    const data = await downloadAsync(file_name);

    const data2 = data.trimRight().split(" ");

    var units;
    var nr, nc, imgsize, i, j, k;

    nr = layer_size;

    imgsize = nr * nc;
    units = net.input_units;
    k = 1;

    for (i = 0; i < nr; i++) {
        // units[k] = my_rand(i % 100);
        units[k] = Number(data2[i]);
        k++;
    }
}

/*** The squashing function.  Currently, it's a sigmoid. ***/

function squash(x) {
    return (1.0 / (1.0 + Math.exp(-x)));
}

/*** Allocate 1d array of floats ***/

function alloc_1d_dbl(n) {
    var new_;

    var buf = new SharedArrayBuffer(n * Float64Array.BYTES_PER_ELEMENT);
    new_ = new Float64Array(buf);

    return new_;
}

/*** Allocate 2d array of floats ***/

function alloc_2d_dbl(m, n) {
    var new_ = [];
    var new_buf = new SharedArrayBuffer(m * n * Float64Array.BYTES_PER_ELEMENT);
    for (var i = 0; i < m; i++)
        new_[i] = new Float64Array(new_buf,
            i * n * Float64Array.BYTES_PER_ELEMENT, n);

    return new_;
}

function bpnn_randomize_weights(w, m, n) {
    var i, j;
    for (i = 0; i <= m; i++) {
        for (j = 0; j <= n; j++) {
            w[i][j] = my_rand(i % 100 + j % 100);
        }
    }
}

function bpnn_randomize_row(w, m) {
    var i;
    for (i = 0; i <= m; i++) {
        w[i] = 0.1;
    }
}

function bpnn_zero_weights(w, m, n) {
    var i, j;

    for (i = 0; i <= m; i++) {
        for (j = 0; j <= n; j++) {
            w[i][j] = 0.0;
        }
    }
}

function bpnn_internal_create(n_in, n_hidden, n_out) {
    var newnet;

    newnet = Object.create(BPNN);

    newnet.input_n = n_in;
    newnet.hidden_n = n_hidden;
    newnet.output_n = n_out;
    newnet.input_units = alloc_1d_dbl(n_in + 1);
    newnet.hidden_units = alloc_1d_dbl(n_hidden + 1);
    newnet.output_units = alloc_1d_dbl(n_out + 1);

    newnet.hidden_delta = alloc_1d_dbl(n_hidden + 1);
    newnet.output_delta = alloc_1d_dbl(n_out + 1);
    newnet.target = alloc_1d_dbl(n_out + 1);

    newnet.input_weights = alloc_2d_dbl(n_in + 1, n_hidden + 1);
    newnet.hidden_weights = alloc_2d_dbl(n_hidden + 1, n_out + 1);

    newnet.input_prev_weights = alloc_2d_dbl(n_in + 1, n_hidden + 1);
    newnet.hidden_prev_weights = alloc_2d_dbl(n_hidden + 1, n_out + 1);

    return newnet;
}

function bpnn_free(net) {
    // V8 GC
    workers.forEach(w => {
        w.terminate();
    });
}

/*** Creates a new fully-connected network from scratch,
     with the given numbers of input, hidden, and output units.
     Threshold units are automatically included.  All weights are
     randomly initialized.
 
     Space is also allocated for temporary storage (momentum weights,
     error computations, etc).
***/

function bpnn_create(n_in, n_hidden, n_out) {

    var newnet;

    newnet = bpnn_internal_create(n_in, n_hidden, n_out);

    bpnn_randomize_weights(newnet.input_weights, n_in, n_hidden);
    bpnn_randomize_weights(newnet.hidden_weights, n_hidden, n_out);
    bpnn_zero_weights(newnet.input_prev_weights, n_in, n_hidden);
    bpnn_zero_weights(newnet.hidden_prev_weights, n_hidden, n_out);
    bpnn_randomize_row(newnet.target, n_out);
    return newnet;
}

async function bpnn_layerforward(step, l1) {

    /*** Set up thresholding unit ***/
    l1[0] = 1.0;

    await new Promise((resolve, reject) => {
        const time_marker = performance.now();

        Atomics.store(barrier, 0, 0)

        for (let i = 0; i < thread_num; i++) {
            workers[i].onmessage = function (e) {
                e = e.data;
                inner_worker_running_time += e.run_time;
                outer_worker_running_time += performance.now() - time_marker;

                if (e.msg == "done1") {
                    Atomics.add(barrier, 0, 1);

                    if (Atomics.load(barrier, 0) == thread_num) {
                        resolve();
                    }
                }
            };

            workers[i].postMessage({
                msg: "func1",
                step
            });
        }
    });
}

//extern "C"
function bpnn_output_error(delta, target, output, nj) {
    var j;
    var o, t, errsum;
    errsum = 0.0;
    for (j = 1; j <= nj; j++) {
        o = output[j];
        t = target[j];
        delta[j] = o * (1.0 - o) * (t - o);
        errsum += Math.abs(delta[j]);
    }
    return errsum;
}

function bpnn_hidden_error(delta_h,
    nh,
    delta_o,
    no,
    who,
    hidden
) {
    var j, k;
    var h, sum, errsum;

    errsum = 0.0;
    for (j = 1; j <= nh; j++) {
        h = hidden[j];
        sum = 0.0;
        for (k = 1; k <= no; k++) {
            sum += delta_o[k] * who[j][k];
        }
        delta_h[j] = h * (1.0 - h) * sum;
        errsum += Math.abs(delta_h[j]);
    }
    return errsum;
}

async function bpnn_adjust_weights(step, ly) {

    ly[0] = 1.0;

    await new Promise((resolve, reject) => {
        const time_marker = performance.now();

        Atomics.store(barrier, 0, 0)

        for (let i = 0; i < thread_num; i++) {
            workers[i].onmessage = function (e) {
                e = e.data;

                inner_worker_running_time += e.run_time;
                outer_worker_running_time += performance.now() - time_marker;

                if (e.msg == "done2") {
                    Atomics.add(barrier, 0, 1);

                    if (Atomics.load(barrier, 0) == thread_num) {
                        resolve();
                    }
                }
            };

            workers[i].postMessage({
                msg: "func2",
                step
            });
        }
    });
}

// Only use for testing result
function bpnn_save(net, filename) {
    var n1, n2, n3, i, j;
    var dvalue, w;

    n1 = net.input_n;
    n2 = net.hidden_n;
    n3 = net.output_n;
    console.log(`Saving ${n1}x${n2}x${n3} network`);

    w = net.input_weights;
    for (i = 0; i <= n1; i++) {
        for (j = 0; j <= n2; j++) {
            dvalue = w[i][j];
            // console.log(dvalue); // testing only
        }
    }

    w = net.hidden_weights;
    for (i = 0; i <= n2; i++) {
        for (j = 0; j <= n3; j++) {
            dvalue = w[i][j];
            // console.log(dvalue); // testing only
        }
    }

    return;
}


async function backprop_face() {
    var net;
    var i;
    var out_err, hid_err;

    var io_marker = performance.now();
    net = bpnn_create(layer_size, middle_layer_size, 1);
    console.log("Input layer size :", layer_size);
    console.log("middle layer size :", middle_layer_size);
    await load(net);
    io_time = performance.now() - io_marker;

    const init_worker_marker = performance.now();
    workers = await init_workers(thread_num, {
        msg: "start",
        thread_num: thread_num,
        net: net
    });
    init_worker_time = performance.now() - init_worker_marker;

    var compute_time_marker = performance.now();
    //entering the training kernel, only one iteration
    console.log("Starting training kernel");
    await bpnn_train_kernel(net, out_err, hid_err);
    compute_time = performance.now() - compute_time_marker;

    // use for checking the result
    // bpnn_save(net, "output.out");

    bpnn_free(net);
    console.log("Training done");
}

async function bpnn_train_kernel(net, eo, eh) {
    var in_, hid, out;
    var out_err, hid_err;

    in_ = net.input_n;
    hid = net.hidden_n;
    out = net.output_n;

    console.log("Performing CPU computation");
    await bpnn_layerforward(1, net.input_units);
    await bpnn_layerforward(2, net.hidden_units);

    out_err = bpnn_output_error(net.output_delta, net.target, net.output_units, out);
    hid_err = bpnn_hidden_error(net.hidden_delta, hid, net.output_delta, out, net.hidden_weights, net.hidden_units);

    console.log("err: ", out_err, hid_err);
    await bpnn_adjust_weights(1, net.hidden_units);
    await bpnn_adjust_weights(2, net.input_units);
}