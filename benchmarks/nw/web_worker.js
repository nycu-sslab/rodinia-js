"use strict"

const BLOCK_SIZE = 64;

var referrence, input_itemsets, thread_id, max_cols, penalty, thread_num;

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

addEventListener('message', function (e) {
    const first_time = performance.now();

    const data = e.data;

    if (data.msg == "start") {
        referrence = data.referrence;
        input_itemsets = data.input_itemsets;
        thread_id = data.thread_id;
        thread_num = data.thread_num;
        max_cols = data.max_cols;
        penalty = data.penalty;

        const run_time = performance.now() - first_time;

        postMessage({
            msg: "done",
            run_time,
        });
    } else if (data.msg == "func1") {
        func1(data.blk);

        const run_time = performance.now() - first_time;

        postMessage({
            msg: "done1",
            run_time,
        });
    } else if (data.msg == "func2") {
        func2(data.blk);

        const run_time = performance.now() - first_time;

        postMessage({
            msg: "done2",
            run_time,
        });
    }

});

function func1(blk) {
    const thread_per_chunk = (blk / thread_num) | 0;

    var start = thread_per_chunk * thread_id;
    var end = thread_id == thread_num - 1 ? blk : thread_per_chunk * (thread_id + 1);
    for (var b_index_x = start; b_index_x < end; ++b_index_x) {
        var b_index_y = blk - 1 - b_index_x;
        var input_itemsets_l = new Int32Array((BLOCK_SIZE + 1) * (BLOCK_SIZE + 1));
        var reference_l = new Int32Array(BLOCK_SIZE * BLOCK_SIZE);

        // Copy referrence to local memory
        for (var i = 0; i < BLOCK_SIZE; ++i) {
            for (var j = 0; j < BLOCK_SIZE; ++j) {
                reference_l[i * BLOCK_SIZE + j] =
                    referrence[max_cols * (b_index_y * BLOCK_SIZE + i + 1) +
                    b_index_x * BLOCK_SIZE + j + 1];
            }
        }

        // Copy input_itemsets to local memory
        for (var i = 0; i < BLOCK_SIZE + 1; ++i) {
            for (var j = 0; j < BLOCK_SIZE + 1; ++j) {
                input_itemsets_l[i * (BLOCK_SIZE + 1) + j] =
                    input_itemsets[max_cols * (b_index_y * BLOCK_SIZE + i) +
                    b_index_x * BLOCK_SIZE + j];
            }
        }

        // Compute
        for (var i = 1; i < BLOCK_SIZE + 1; ++i) {
            for (var j = 1; j < BLOCK_SIZE + 1; ++j) {
                input_itemsets_l[i * (BLOCK_SIZE + 1) + j] = maximum(
                    input_itemsets_l[(i - 1) * (BLOCK_SIZE + 1) + j - 1] +
                    reference_l[(i - 1) * BLOCK_SIZE + j - 1],
                    input_itemsets_l[i * (BLOCK_SIZE + 1) + j - 1] - penalty,
                    input_itemsets_l[(i - 1) * (BLOCK_SIZE + 1) + j] - penalty);
            }
        }

        // Copy results to global memory
        for (var i = 0; i < BLOCK_SIZE; ++i) {
            for (var j = 0; j < BLOCK_SIZE; ++j) {
                input_itemsets[max_cols * (b_index_y * BLOCK_SIZE + i + 1) +
                    b_index_x * BLOCK_SIZE + j + 1] =
                    input_itemsets_l[(i + 1) * (BLOCK_SIZE + 1) + j + 1];
            }
        }
    }
}

function func2(blk) {

    const origin_start = blk - 1;

    const origin_end = ((max_cols - 1) / BLOCK_SIZE) | 0;

    const origin_len = origin_end - origin_start;
    const thread_per_chunk = (origin_len / thread_num) | 0;

    var start = origin_start + thread_per_chunk * thread_id;
    var end = thread_id == thread_num - 1 ? origin_end : origin_start + thread_per_chunk * (thread_id + 1);

    for (var b_index_x = start; b_index_x < end; ++b_index_x) {
        var b_index_y = (((max_cols - 1) / BLOCK_SIZE) | 0) + blk - 2 - b_index_x;

        var input_itemsets_l = new Int32Array((BLOCK_SIZE + 1) * (BLOCK_SIZE + 1));
        var reference_l = new Int32Array(BLOCK_SIZE * BLOCK_SIZE);

        // Copy referrence to local memory
        for (var i = 0; i < BLOCK_SIZE; ++i) {
            for (var j = 0; j < BLOCK_SIZE; ++j) {
                reference_l[i * BLOCK_SIZE + j] =
                    referrence[max_cols * (b_index_y * BLOCK_SIZE + i + 1) +
                    b_index_x * BLOCK_SIZE + j + 1];
            }
        }

        // Copy input_itemsets to local memory
        for (var i = 0; i < BLOCK_SIZE + 1; ++i) {
            for (var j = 0; j < BLOCK_SIZE + 1; ++j) {
                input_itemsets_l[i * (BLOCK_SIZE + 1) + j] =
                    input_itemsets[max_cols * (b_index_y * BLOCK_SIZE + i) +
                    b_index_x * BLOCK_SIZE + j];
            }
        }

        // Compute
        for (var i = 1; i < BLOCK_SIZE + 1; ++i) {
            for (var j = 1; j < BLOCK_SIZE + 1; ++j) {
                input_itemsets_l[i * (BLOCK_SIZE + 1) + j] = maximum(
                    input_itemsets_l[(i - 1) * (BLOCK_SIZE + 1) + j - 1] +
                    reference_l[(i - 1) * BLOCK_SIZE + j - 1],
                    input_itemsets_l[i * (BLOCK_SIZE + 1) + j - 1] - penalty,
                    input_itemsets_l[(i - 1) * (BLOCK_SIZE + 1) + j] - penalty);
            }
        }

        // Copy results to global memory
        for (var i = 0; i < BLOCK_SIZE; ++i) {
            for (var j = 0; j < BLOCK_SIZE; ++j) {
                input_itemsets[max_cols * (b_index_y * BLOCK_SIZE + i + 1) +
                    b_index_x * BLOCK_SIZE + j + 1] = input_itemsets_l[(i + 1) * (BLOCK_SIZE + 1) + j + 1];
            }
        }
    }
}
