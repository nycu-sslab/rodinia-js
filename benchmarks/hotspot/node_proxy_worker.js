const { performance } = require('perf_hooks');
const { Worker, parentPort } = require('worker_threads');

var total_time = 0;
var total_proxy_time = 0;
var compute_time = 0;
var inner_worker_running_time = 0;
var outer_worker_running_time = 0;
var init_worker_time = 0;
var io_time = 0;
var message_time = 0;

var thread_num;

parentPort.on('message', async function (e) {
    const args = e;

    // console.log(args)

    await main(args);

    parentPort.postMessage({
        total_proxy_time,
        compute_time,
        inner_worker_running_time,
        outer_worker_running_time,
        init_worker_time,
        io_time,
        message_time,
        thread_num
    });
});

function init() {
    total_time = 0;
    compute_time = 0;
    inner_worker_running_time = 0;
    outer_worker_running_time = 0;
    init_worker_time = 0;
    io_time = 0;
    message_time = 0;
}

async function init_workers(thread_num, params) {
    // const time_marker = performance.now();

    return new Promise((resolve, reject) => {
        function handleWorker(thread_id) {
            return new Promise((resolve, reject) => {
                // create worker, do stuff
                const worker = new Worker(__dirname + "/node_worker.js");

                params["thread_id"] = thread_id;
                worker.postMessage(params);

                worker.on("message", () => {
                    resolve(worker);
                })
                worker.on("error", err => {
                    reject(err)
                });

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
    init();

    var start_time = performance.now();
    const result = await hotspot(argc);
    var end_time = performance.now();

    total_proxy_time = end_time - start_time;
}

async function downloadAsync(url) {
    console.log("url", url)
    if (!url.includes("http")) {
        return require('fs').readFileSync(url, "utf8");
    }
    return require('child_process')
        .execFileSync('curl',
            ['--silent', '-L', url],
            { encoding: 'utf8', maxBuffer: Infinity });
}

var BLOCK_SIZE = 64;
var BLOCK_SIZE_C = BLOCK_SIZE;
var BLOCK_SIZE_R = BLOCK_SIZE;

var STR_SIZE = 256

/* maximum power density possible (say 300W for a 10mm x 10mm chip)	*/
var MAX_PD = 3.0e6
/* required precision in degrees	*/
var PRECISION = 0.001
var SPEC_HEAT_SI = 1.75e6
var K_SI = 100
/* capacitance fitting factor	*/
var FACTOR_CHIP = 0.5

/* chip parameters	*/
const t_chip = 0.0005;
const chip_height = 0.016;
const chip_width = 0.016;

/* ambient temperature, assuming no package at all	*/
const amb_temp = 80.0;

/* Single iteration of the transient solver in the grid model.
 * advances the solution of the discretized difference equations 
 * by one time step
 */
async function single_iteration(result, temp, power, row, col,
    Cap_1, Rx_1, Ry_1, Rz_1, thread_num) {
    var num_chunk = (row * col / (BLOCK_SIZE_R * BLOCK_SIZE_C)) | 0;
    var chunks_in_row = (col / BLOCK_SIZE_C) | 0;
    var chunks_in_col = (row / BLOCK_SIZE_R) | 0;
    var thread_per_chunk = (num_chunk / thread_num) | 0;

    var barrier_buf = new SharedArrayBuffer(1 * Int8Array.BYTES_PER_ELEMENT);
    var barrier = new Int8Array(barrier_buf);

    await new Promise((resolve, reject) => {
        const time_marker = performance.now();

        Atomics.store(barrier, 0, 0)

        for (let i = 0; i < thread_num; i++) {
            workers[i].once("message", e => {
                inner_worker_running_time += e.run_time;
                outer_worker_running_time += performance.now() - time_marker;

                if (e.msg == "done1") {
                    Atomics.add(barrier, 0, 1);

                    if (Atomics.load(barrier, 0) == thread_num) {
                        resolve();
                    }
                }
            });

            workers[i].postMessage({
                msg: "func1",
                row,
                col,
                num_chunk,
                chunks_in_col,
                chunks_in_row,
                power,
                temp,
                result,
                thread_per_chunk,
                current_thread: i,
                Cap_1,
                Rx_1,
                Ry_1,
                Rz_1,
            });
        }
    });
}


/* Transient solver driver routine: simply converts the heat 
 * transfer differential equations to difference equations 
 * and solves the difference equations by iterating
 */
async function compute_tran_temp(result, num_iterations, temp, power, row, col, thread_num) {

    var i = 0;


    var grid_height = chip_height / row;
    var grid_width = chip_width / col;

    var Cap = FACTOR_CHIP * SPEC_HEAT_SI * t_chip * grid_width * grid_height;
    var Rx = grid_width / (2.0 * K_SI * t_chip * grid_height);
    var Ry = grid_height / (2.0 * K_SI * t_chip * grid_width);
    var Rz = t_chip / (K_SI * grid_height * grid_width);

    var max_slope = MAX_PD / (FACTOR_CHIP * t_chip * SPEC_HEAT_SI);
    var step = PRECISION / max_slope / 1000.0;

    var Rx_1 = 1.0 / Rx;
    var Ry_1 = 1.0 / Ry;
    var Rz_1 = 1.0 / Rz;
    var Cap_1 = step / Cap;

    console.log(`total iterations: ${num_iterations}\tstep size: ${step}`);
    console.log(`Rx: ${Rx}\tRy: ${Ry}\tRz: ${Rz}\tCap: ${Cap}`);

    {
        var r = result;
        var t = temp;
        for (var i = 0; i < num_iterations; i++) {
            await single_iteration(r, t, power, row, col, Cap_1, Rx_1, Ry_1, Rz_1, thread_num);
            var tmp = t;
            t = r;
            r = tmp;
        }
    }

}

async function check_answer(url, vect, grid_rows, grid_cols) {
    var i, j, index = 0;

    const file = await downloadAsync(url);

    const lines = file.split("\n");

    let isCorrect = true;
    for (i = 0; i < grid_rows; i++) {
        if (!isCorrect)
            break;

        for (j = 0; j < grid_cols; j++) {
            const ans = Number(lines[i * grid_cols + j].split("\t")[1]);
            const val = vect[i * grid_cols + j];
            if (Math.abs(val - ans) > 0.01) {
                console.log("index", index, "dismatch val vs ans:", val, ans);
                isCorrect = false;
                // break;
            }
            index++;
        }
    }

    return isCorrect;
}

async function read_file(url, vect, grid_rows, grid_cols) {
    const file = await downloadAsync(url);
    const lines = file.split("\n");

    for (var i = 0; i < grid_rows * grid_cols; i++) {
        vect[i] = Number(lines[i]);
    }
}


async function hotspot(args) {

    var grid_rows, grid_cols, sim_time, i;
    var temp, power, result;

    /*  PARAMETERS	*/

    grid_rows = args.grid_rows;
    grid_cols = args.grid_cols;
    sim_time = args.sim_time;

    temp_file = args.temp_file;
    power_file = args.power_file;
    answer_file = args.answer_file;
    thread_num = args.thread_num;


    var io_time_marker = performance.now();

    /* allocate memory for the temperature and power arrays	*/
    var temp_buf = new SharedArrayBuffer(grid_rows * grid_cols * Float64Array.BYTES_PER_ELEMENT);
    var power_buf = new SharedArrayBuffer(grid_rows * grid_cols * Float64Array.BYTES_PER_ELEMENT);
    var result_buf = new SharedArrayBuffer(grid_rows * grid_cols * Float64Array.BYTES_PER_ELEMENT);

    temp = new Float64Array(temp_buf);
    power = new Float64Array(power_buf);
    result = new Float64Array(result_buf);

    /* read initial temperatures and input power */
    await new Promise((res, rej) => {
        Promise.all([
            read_file(temp_file, temp, grid_rows, grid_cols),
            read_file(power_file, power, grid_rows, grid_cols)
        ]).then(() => {
            res();
        }).catch(err => {
            rej(err);
        })
    });

    io_time += performance.now() - io_time_marker;

    var start_time_worker = performance.now();
    workers = await init_workers(thread_num, {
        msg: "start",
        temp,
        power,
        result
    });
    init_worker_time += performance.now() - start_time_worker;

    console.log("Start computing the transient temperature");
    const compute_time_marker = performance.now()

    await compute_tran_temp(result, sim_time, temp, power, grid_rows, grid_cols, thread_num);

    compute_time = performance.now() - compute_time_marker;
    console.log("Ending simulation");

    /* output results	*/
    // await check_answer(answer_file, result, grid_rows, grid_cols);

    console.log("Finished.");

    workers.forEach(worker => { worker.terminate(); });

    return result;
}

