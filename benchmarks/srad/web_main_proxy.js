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
        rows: 256,  //number of rows in the domain
        cols: 256,  //number of cols in the domain
        r1: 0,      //y1 position of the speckle
        r2: 127,     //y2 position of the speckle
        c1: 0,      //x1 position of the speckle
        c2: 127,     //x2 position of the speckle
        nthreads: 4,// number of threads
        lambda: 0.5,//Lambda value
        "niter": 5,  //number of iterations
        file_name: "inputGen/256.txt"
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
    await srad(argc);
    var end_time = performance.now();

    total_proxy_time = end_time - start_time;
}

async function downloadAsync(url) {
    const file = await fetch(url);
    return file.text();
}

async function srad(args) {
    var rows, cols, size_I, size_R, niter = 10, iter, k;
    var I, J, q0sqr, sum, sum2, tmp, meanROI, varROI;
    var Jc, G2, L, num, den, qsqr;
    var iN, iS, jE, jW;
    var dN, dS, dW, dE;
    var r1, r2, c1, c2;
    var cN, cS, cW, cE;
    var c, D;
    var lambda;
    var i, j;
    var nthreads;
    var file_name = args.file_name;

    rows = args.rows; //number of rows in the domain
    cols = args.cols; //number of cols in the domain
    if ((rows % 16 != 0) || (cols % 16 != 0)) {
        console.error("rows and cols must be multiples of 16");
    }
    r1 = args.r1;       //y1 position of the speckle
    r2 = args.r2;       //y2 position of the speckle
    c1 = args.c1;       //x1 position of the speckle
    c2 = args.c2;       //x2 position of the speckle
    thread_num = args.nthreads; // number of threads
    lambda = args.lambda;   //Lambda value
    niter = args.niter;    //number of iterations


    var io_marker = performance.now();


    size_I = cols * rows;
    size_R = (r2 - r1 + 1) * (c2 - c1 + 1);

    var Ibuf, Jbuf, cbuf, iNbuf, iSbuf, jWbuf, jEbuf,
        dNbuf, dSbuf, dWbuf, dEbuf;

    Ibuf = new SharedArrayBuffer(size_I * Float64Array.BYTES_PER_ELEMENT);
    Jbuf = new SharedArrayBuffer(size_I * Float64Array.BYTES_PER_ELEMENT);
    cbuf = new SharedArrayBuffer(size_I * Float64Array.BYTES_PER_ELEMENT);
    I = new Float64Array(Ibuf);
    J = new Float64Array(Jbuf);
    c = new Float64Array(cbuf);

    iNbuf = new SharedArrayBuffer(rows * Int32Array.BYTES_PER_ELEMENT);
    iSbuf = new SharedArrayBuffer(rows * Int32Array.BYTES_PER_ELEMENT);
    jWbuf = new SharedArrayBuffer(cols * Int32Array.BYTES_PER_ELEMENT);
    jEbuf = new SharedArrayBuffer(cols * Int32Array.BYTES_PER_ELEMENT);
    iN = new Int32Array(iNbuf);
    iS = new Int32Array(iSbuf);
    jW = new Int32Array(jWbuf);
    jE = new Int32Array(jEbuf);

    dNbuf = new SharedArrayBuffer(size_I * Float64Array.BYTES_PER_ELEMENT);
    dSbuf = new SharedArrayBuffer(size_I * Float64Array.BYTES_PER_ELEMENT);
    dWbuf = new SharedArrayBuffer(size_I * Float64Array.BYTES_PER_ELEMENT);
    dEbuf = new SharedArrayBuffer(size_I * Float64Array.BYTES_PER_ELEMENT);
    dN = new Float64Array(dNbuf);
    dS = new Float64Array(dSbuf);
    dW = new Float64Array(dWbuf);
    dE = new Float64Array(dEbuf);

    for (var i = 0; i < rows; i++) {
        iN[i] = i - 1;
        iS[i] = i + 1;
    }
    for (var j = 0; j < cols; j++) {
        jW[j] = j - 1;
        jE[j] = j + 1;
    }
    iN[0] = 0;
    iS[rows - 1] = rows - 1;
    jW[0] = 0;
    jE[cols - 1] = cols - 1;

    console.log("Randomizing the input matrix");

    // random_matrix(I, rows, cols); // for testing
    await real_matrix(file_name, I, rows, cols);

    for (k = 0; k < size_I; k++) {
        J[k] = Math.exp(I[k]);
    }

    io_time = performance.now() - io_marker;

    const init_worker_marker = performance.now();
    var workers = await init_workers(thread_num, {
        msg: "start",
        thread_num,
        I,
        J,
        c,
        iN,
        iS,
        jW,
        jE,
        dN,
        dS,
        dW,
        dE,
        rows,
        cols,
        lambda
    });
    init_worker_time = performance.now() - init_worker_marker;


    console.log("Start the SRAD main loop");
    var compute_time_marker = performance.now();

    var barrier_buf = new SharedArrayBuffer(1 * Int8Array.BYTES_PER_ELEMENT);
    var barrier = new Int8Array(barrier_buf);

    for (iter = 0; iter < niter; iter++) {
        sum = 0;
        sum2 = 0;
        for (i = r1; i <= r2; i++) {
            for (j = c1; j <= c2; j++) {
                tmp = J[i * cols + j];
                sum += tmp;
                sum2 += tmp * tmp;
            }
        }
        meanROI = sum / size_R;
        varROI = (sum2 / size_R) - meanROI * meanROI;
        q0sqr = varROI / (meanROI * meanROI);

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
                    q0sqr
                });
            }
        });


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
                });
            }
        });

    }

    compute_time = performance.now() - compute_time_marker;


    // show_result(J, rows, cols);
    console.log("Computation Done\n");

    workers.forEach(w => {
        w.terminate();
    })

    return 0;
}

function show_result(J, rows, cols) {
    for (var i = 0; i < 10; i++) {
        for (var j = 0; j < 10; j++) {
            console.log(J[i * cols + j].toFixed(8));
        }
    }
}

function random_matrix(I, rows, cols) {
    for (var i = 0; i < rows; i++) {
        for (var j = 0; j < cols; j++) {
            I[i * cols + j] = 0.000001 * (i + j);
        }
    }
}

async function real_matrix(file_name, I, rows, cols) {
    const data = await downloadAsync(file_name);
    const data2 = data.split(" ");

    let k = 0;
    for (var i = 0; i < rows; i++) {
        for (var j = 0; j < cols; j++) {
            I[i * cols + j] = data2[k++];
        }
    }
}
