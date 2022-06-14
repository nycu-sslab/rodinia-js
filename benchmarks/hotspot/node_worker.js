"use strict"
const { parentPort } = require('worker_threads');
const { performance } = require('perf_hooks');

var result, temp, power;

var BLOCK_SIZE = 64
var BLOCK_SIZE_C = BLOCK_SIZE
var BLOCK_SIZE_R = BLOCK_SIZE

var STR_SIZE = 256

/* maximum power density possible (say 300W for a 10mm x 10mm chip)	*/
var MAX_PD = 3.0e6
/* required precision in degrees	*/
var PRECISION = 0.001
var SPEC_HEAT_SI = 1.75e6
var K_SI = 100
/* capacitance fitting factor	*/
var FACTOR_CHIP = 0.5

/* ambient temperature, assuming no package at all	*/
const amb_temp = 80.0;

parentPort.on('message', function (e) {
    const first_time = performance.now();

    const data = e;

    if (data.msg == "start") {
        result = data.result;
        temp = data.temp;
        power = data.power;

        const run_time = performance.now() - first_time;

        parentPort.postMessage({
            msg: "done",
            run_time,
        });
    } else if (data.msg == "func1") {
        func1(data.row, data.col, data.num_chunk, data.chunks_in_col,
            data.chunks_in_row, data.threads, data.thread_per_chunk, data.current_thread,
            data.Cap_1, data.Rx_1, data.Ry_1, data.Rz_1);

        const run_time = performance.now() - first_time;

        parentPort.postMessage({
            msg: "done1",
            run_time,
        });
    }

});

function func1(row, col, num_chunk, chunks_in_col, chunks_in_row, threads, thread_per_chunk,
    current_thread, Cap_1, Rx_1, Ry_1, Rz_1) {
    var START, END;

    START = thread_per_chunk * current_thread;
    END = current_thread == threads - 1 ? num_chunk : thread_per_chunk * (current_thread + 1);

    var r, c, delta, chunk;

    for (chunk = START; chunk < END; ++chunk) {
        var r_start = BLOCK_SIZE_R * ((chunk / chunks_in_col) | 0);
        var c_start = BLOCK_SIZE_C * (chunk % chunks_in_row);
        var r_end = r_start + BLOCK_SIZE_R > row ? row : r_start + BLOCK_SIZE_R;
        var c_end = c_start + BLOCK_SIZE_C > col ? col : c_start + BLOCK_SIZE_C;

        if (r_start == 0 || c_start == 0 || r_end == row || c_end == col) {
            for (r = r_start; r < r_start + BLOCK_SIZE_R; ++r) {
                for (c = c_start; c < c_start + BLOCK_SIZE_C; ++c) {
                    /* Corner 1 */
                    if ((r == 0) && (c == 0)) {
                        delta = (Cap_1) * (power[0] +
                            (temp[1] - temp[0]) * Rx_1 +
                            (temp[col] - temp[0]) * Ry_1 +
                            (amb_temp - temp[0]) * Rz_1);
                    } /* Corner 2 */
                    else if ((r == 0) && (c == col - 1)) {
                        delta = (Cap_1) * (power[c] +
                            (temp[c - 1] - temp[c]) * Rx_1 +
                            (temp[c + col] - temp[c]) * Ry_1 +
                            (amb_temp - temp[c]) * Rz_1);
                    } /* Corner 3 */
                    else if ((r == row - 1) && (c == col - 1)) {
                        delta = (Cap_1) * (power[r * col + c] +
                            (temp[r * col + c - 1] - temp[r * col + c]) * Rx_1 +
                            (temp[(r - 1) * col + c] - temp[r * col + c]) * Ry_1 +
                            (amb_temp - temp[r * col + c]) * Rz_1);
                    } /* Corner 4	*/
                    else if ((r == row - 1) && (c == 0)) {
                        delta = (Cap_1) * (power[r * col] +
                            (temp[r * col + 1] - temp[r * col]) * Rx_1 +
                            (temp[(r - 1) * col] - temp[r * col]) * Ry_1 +
                            (amb_temp - temp[r * col]) * Rz_1);
                    } /* Edge 1 */
                    else if (r == 0) {
                        delta = (Cap_1) * (power[c] +
                            (temp[c + 1] + temp[c - 1] - 2.0 * temp[c]) * Rx_1 +
                            (temp[col + c] - temp[c]) * Ry_1 +
                            (amb_temp - temp[c]) * Rz_1);
                    } /* Edge 2 */
                    else if (c == col - 1) {
                        delta = (Cap_1) * (power[r * col + c] +
                            (temp[(r + 1) * col + c] + temp[(r - 1) * col + c] - 2.0 * temp[r * col + c]) * Ry_1 +
                            (temp[r * col + c - 1] - temp[r * col + c]) * Rx_1 +
                            (amb_temp - temp[r * col + c]) * Rz_1);
                    } /* Edge 3 */
                    else if (r == row - 1) {
                        delta = (Cap_1) * (power[r * col + c] +
                            (temp[r * col + c + 1] + temp[r * col + c - 1] - 2.0 * temp[r * col + c]) * Rx_1 +
                            (temp[(r - 1) * col + c] - temp[r * col + c]) * Ry_1 +
                            (amb_temp - temp[r * col + c]) * Rz_1);
                    } /* Edge 4 */
                    else if (c == 0) {
                        delta = (Cap_1) * (power[r * col] +
                            (temp[(r + 1) * col] + temp[(r - 1) * col] - 2.0 * temp[r * col]) * Ry_1 +
                            (temp[r * col + 1] - temp[r * col]) * Rx_1 +
                            (amb_temp - temp[r * col]) * Rz_1);
                    }
                    result[r * col + c] = temp[r * col + c] + delta;
                }
            }
            continue;
        }

        for (r = r_start; r < r_start + BLOCK_SIZE_R; ++r) {
            // #pragma omp simd        
            for (c = c_start; c < c_start + BLOCK_SIZE_C; ++c) {
                /* Update Temperatures */
                result[r * col + c] = temp[r * col + c] +
                    (Cap_1 * (power[r * col + c] +
                        (temp[(r + 1) * col + c] + temp[(r - 1) * col + c] - 2.0 * temp[r * col + c]) * Ry_1 +
                        (temp[r * col + c + 1] + temp[r * col + c - 1] - 2.0 * temp[r * col + c]) * Rx_1 +
                        (amb_temp - temp[r * col + c]) * Rz_1));
            }
        }
    }
}