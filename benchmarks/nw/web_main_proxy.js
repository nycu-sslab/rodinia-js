var total_time = 0;
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
        max_rows: 2048,
        max_cols: 2048,
        penalty: 10,
        thread_num: 4
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


async function init_workers(thread_num, params) {
    // const time_marker = performance.now();

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
async function main(argc) {
    var start_time = performance.now();
    await nw(argc);
    var end_time = performance.now();

    total_proxy_time = end_time - start_time;
}

async function downloadAsync(url) {
    const file = await fetch(url);
    return file.text();
}

const LIMIT = -999;
const BLOCK_SIZE = 64;

function maximum(a, b, c) {
    let k;
    if (a <= b)
        k = b;
    else
        k = a;

    if (k <= c)
        return c;
    else
        return k;
}

const blosum62 = [[4, -1, -2, -2, 0, -1, -1, 0, -2, -1, -1, -1,
    -1, -2, -1, 1, 0, -3, -2, 0, -2, -1, 0, -4],
[-1, 5, 0, -2, -3, 1, 0, -2, 0, -3, -2, 2,
-1, -3, -2, -1, -1, -3, -2, -3, -1, 0, -1, -4],
[-2, 0, 6, 1, -3, 0, 0, 0, 1, -3, -3, 0,
-2, -3, -2, 1, 0, -4, -2, -3, 3, 0, -1, -4],
[-2, -2, 1, 6, -3, 0, 2, -1, -1, -3, -4, -1,
-3, -3, -1, 0, -1, -4, -3, -3, 4, 1, -1, -4],
[0, -3, -3, -3, 9, -3, -4, -3, -3, -1, -1, -3,
    -1, -2, -3, -1, -1, -2, -2, -1, -3, -3, -2, -4],
[-1, 1, 0, 0, -3, 5, 2, -2, 0, -3, -2, 1,
    0, -3, -1, 0, -1, -2, -1, -2, 0, 3, -1, -4],
[-1, 0, 0, 2, -4, 2, 5, -2, 0, -3, -3, 1,
-2, -3, -1, 0, -1, -3, -2, -2, 1, 4, -1, -4],
[0, -2, 0, -1, -3, -2, -2, 6, -2, -4, -4, -2,
    -3, -3, -2, 0, -2, -2, -3, -3, -1, -2, -1, -4],
[-2, 0, 1, -1, -3, 0, 0, -2, 8, -3, -3, -1,
-2, -1, -2, -1, -2, -2, 2, -3, 0, 0, -1, -4],
[-1, -3, -3, -3, -1, -3, -3, -4, -3, 4, 2, -3,
    1, 0, -3, -2, -1, -3, -1, 3, -3, -3, -1, -4],
[-1, -2, -3, -4, -1, -2, -3, -4, -3, 2, 4, -2,
    2, 0, -3, -2, -1, -2, -1, 1, -4, -3, -1, -4],
[-1, 2, 0, -1, -3, 1, 1, -2, -1, -3, -2, 5,
-1, -3, -1, 0, -1, -3, -2, -2, 0, 1, -1, -4],
[-1, -1, -2, -3, -1, 0, -2, -3, -2, 1, 2, -1,
    5, 0, -2, -1, -1, -1, -1, 1, -3, -1, -1, -4],
[-2, -3, -3, -3, -2, -3, -3, -3, -1, 0, 0, -3,
    0, 6, -4, -2, -2, 1, 3, -1, -3, -3, -1, -4],
[-1, -2, -2, -1, -3, -1, -1, -2, -2, -3, -3, -1,
-2, -4, 7, -1, -1, -4, -3, -2, -2, -1, -2, -4],
[1, -1, 1, 0, -1, 0, 0, 0, -1, -2, -2, 0,
    -1, -2, -1, 4, 1, -3, -2, -2, 0, 0, 0, -4],
[0, -1, 0, -1, -1, -1, -1, -2, -2, -1, -1, -1,
    -1, -2, -1, 1, 5, -2, -2, 0, -1, -1, 0, -4],
[-3, -3, -4, -4, -2, -2, -3, -2, -2, -3, -2, -3,
-1, 1, -4, -3, -2, 11, 2, -3, -4, -3, -2, -4],
[-2, -2, -2, -3, -2, -1, -2, -3, 2, -1, -1, -2,
-1, 3, -3, -2, -2, 2, 7, -1, -3, -2, -1, -4],
[0, -3, -3, -3, -1, -2, -2, -3, -3, 3, 1, -2,
    1, -1, -2, -2, 0, -3, -1, 4, -3, -2, -1, -4],
[-2, -1, 3, 4, -3, 0, 1, -1, 0, -3, -4, 0,
-3, -3, -2, 0, -1, -4, -3, -3, 4, 1, -1, -4],
[-1, 0, 0, 1, -3, 3, 4, -2, 0, -3, -3, 1,
-1, -3, -1, 0, -1, -3, -2, -2, 1, 4, -1, -4],
[0, -1, -1, -1, -2, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -2, 0, 0, -2, -1, -1, -1, -1, -1, -4],
[-4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4,
-4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, 1]];

async function nw_optimized(workers, max_cols, thread_num) {

    var barrier_buf = new SharedArrayBuffer(1 * Int8Array.BYTES_PER_ELEMENT);
    var barrier = new Int8Array(barrier_buf);


    for (var blk = 1; blk <= ((max_cols - 1) / BLOCK_SIZE) | 0; blk++) {
        await new Promise((resolve, reject) => {
            const time_marker = performance.now();

            Atomics.store(barrier, 0, 0)

            for (let i = 0; i < thread_num; i++) {
                workers[i].onmessage = function (e) {
                    const data = e.data;

                    inner_worker_running_time += data.run_time;
                    outer_worker_running_time += performance.now() - time_marker;

                    if (data.msg == "done1") {
                        Atomics.add(barrier, 0, 1);

                        if (Atomics.load(barrier, 0) == thread_num) {
                            resolve();
                        }
                    }
                };

                workers[i].postMessage({
                    msg: "func1",
                    blk
                });
            }
        });
    }

    console.log("Processing bottom-right matrix\n");

    for (var blk = 2; blk <= ((max_cols - 1) / BLOCK_SIZE) | 0; blk++) {
        await new Promise((resolve, reject) => {
            const time_marker = performance.now();

            Atomics.store(barrier, 0, 0)

            for (let i = 0; i < thread_num; i++) {
                workers[i].onmessage = function (e) {
                    const data = e.data;

                    inner_worker_running_time += data.run_time;
                    outer_worker_running_time += performance.now() - time_marker;

                    if (data.msg == "done2") {
                        Atomics.add(barrier, 0, 1);

                        if (Atomics.load(barrier, 0) == thread_num) {
                            resolve();
                        }
                    }
                };

                workers[i].postMessage({
                    msg: "func2",
                    blk
                });
            }
        });
    }
}

function print_output(input_itemsets, referrence, max_rows, max_cols, penalty) {

    var output = "";

    for (var i = max_rows - 2, j = max_rows - 2; i >= 0, j >= 0;) {
        var nw, n, w, traceback;
        if (i == max_rows - 2 && j == max_rows - 2)
            output += input_itemsets[i * max_cols + j] + " "; // print the first element
        if (i == 0 && j == 0)
            break;
        if (i > 0 && j > 0) {
            nw = input_itemsets[(i - 1) * max_cols + j - 1];
            w = input_itemsets[i * max_cols + j - 1];
            n = input_itemsets[(i - 1) * max_cols + j];
        } else if (i == 0) {
            nw = n = LIMIT;
            w = input_itemsets[i * max_cols + j - 1];
        } else if (j == 0) {
            nw = w = LIMIT;
            n = input_itemsets[(i - 1) * max_cols + j];
        } else {
        }

        // traceback = maximum(nw, w, n);
        var new_nw, new_w, new_n;
        new_nw = nw + referrence[i * max_cols + j];
        new_w = w - penalty;
        new_n = n - penalty;

        traceback = maximum(new_nw, new_w, new_n);
        if (traceback == new_nw)
            traceback = nw;
        if (traceback == new_w)
            traceback = w;
        if (traceback == new_n)
            traceback = n;

        output += traceback + " ";

        if (traceback == nw) {
            i--;
            j--;
            continue;
        }

        else if (traceback == w) {
            j--;
            continue;
        }

        else if (traceback == n) {
            i--;
            continue;
        }

        else
            ;
    }

    return output;
}

async function check_answer(input) {
    const answer = await downloadAsync('./openmp/result.txt');
    var flag = true;
    if (input.trim() != answer.trim()) {
        console.error("wrong answer!");
        flag = false;
    }
    if(flag) {
        console.log("Correct Answer!!!!!");
    }
}

async function nw(args) {
    var max_rows, max_cols, penalty;
    var input_itemsets, referrence;

    // the lengths of the two sequences should be able to divided by 16.
    // And at current stage  max_rows needs to equal max_cols
    max_rows = args.max_rows;
    max_cols = args.max_cols;
    penalty = args.penalty;
    thread_num = args.thread_num;

    var row_col_lenght = args.max_cols;

    max_rows = max_rows + 1;
    max_cols = max_cols + 1;

    var io_marker = performance.now();

    var ref_buf = new SharedArrayBuffer(max_rows * max_cols * Int32Array.BYTES_PER_ELEMENT)
    var input_ref = new SharedArrayBuffer(max_rows * max_cols * Int32Array.BYTES_PER_ELEMENT)
    referrence = new Int32Array(ref_buf);
    input_itemsets = new Int32Array(input_ref);


    for (var i = 0; i < max_cols; i++) {
        for (var j = 0; j < max_rows; j++) {
            input_itemsets[i * max_cols + j] = 0;
        }
    }

    console.log("Start Needleman-Wunsch\n");

    const input_data_raw = await downloadAsync(`./inputGen/${row_col_lenght}.txt`);

    var input_data = input_data_raw.split("\n");
    input_data[0] = input_data[0].split(" ");
    input_data[1] = input_data[1].split(" ");

    for (var i = 1; i < max_rows; i++) { // please define your own sequence.
        // input_itemsets[i * max_cols] = i % 10 + 1; // for testing
        input_itemsets[i * max_cols] = input_data[0][i - 1];
    }
    for (var j = 1; j < max_cols; j++) { // please define your own sequence.
        // input_itemsets[j] = j % 10 + 1; // for testing
        input_itemsets[j] = input_data[1][j - 1];
    }

    for (var i = 1; i < max_cols; i++) {
        for (var j = 1; j < max_rows; j++) {
            referrence[i * max_cols + j] = blosum62[input_itemsets[i * max_cols]][input_itemsets[j]];
        }
    }

    for (var i = 1; i < max_rows; i++)
        input_itemsets[i * max_cols] = -i * penalty;
    for (var j = 1; j < max_cols; j++)
        input_itemsets[j] = -j * penalty;

    io_time = performance.now() - io_marker;


    const init_worker_marker = performance.now();
    var workers = await init_workers(thread_num, {
        msg: "start",
        thread_num,
        referrence,
        input_itemsets,
        max_cols,
        penalty
    });
    init_worker_time = performance.now() - init_worker_marker;

    // Compute top-left matrix
    console.log("Num of threads: %d\n", thread_num);
    console.log("Processing top-left matrix\n");

    var compute_time_marker = performance.now();

    await nw_optimized(workers, max_cols, thread_num);

    compute_time = performance.now() - compute_time_marker;

    console.log(`Total compute time: ${compute_time} ms`);

    // var output = print_output(input_itemsets, referrence, max_rows, max_cols, penalty);
    // await check_answer(output);

    workers.forEach(w => {
        w.terminate();
    });

}
