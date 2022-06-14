"use strict"
const { parentPort } = require('worker_threads');
const { performance } = require('perf_hooks');

var thread_num,
    thread_id,
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
    lambda;

var START, END;


parentPort.on('message', function (e) {
    const first_time = performance.now();

    const data = e;

    if (data.msg == "start") {

        thread_id = data.thread_id;
        thread_num = data.thread_num;
        I = data.I;
        J = data.J;
        c = data.c;
        iN = data.iN;
        iS = data.iS;
        jW = data.jW;
        jE = data.jE;
        dN = data.dN;
        dS = data.dS;
        dW = data.dW;
        dE = data.dE;
        rows = data.rows;
        cols = data.cols;
        lambda = data.lambda;

        const thread_per_chunk = (rows / thread_num) | 0;

        START = thread_per_chunk * thread_id;
        END = thread_id == thread_num - 1 ? rows : thread_per_chunk * (thread_id + 1);

        const run_time = performance.now() - first_time;

        parentPort.postMessage({
            msg: "done",
            run_time,
        });
    } else if (data.msg == "func1") {
        func1(data.q0sqr);

        const run_time = performance.now() - first_time;

        parentPort.postMessage({
            msg: "done1",
            run_time,
        });
    } else if (data.msg == "func2") {
        func2();

        const run_time = performance.now() - first_time;

        parentPort.postMessage({
            msg: "done2",
            run_time,
        });
    }

});

function func1(q0sqr) {

    var i, j, k, Jc, G2, L, num, den, qsqr;

    // #pragma omp parallel for shared(J, dN, dS, dW, dE, c, rows, cols, iN, iS, jW, jE)
    //  private(i, j, k, Jc, G2, L, num, den, qsqr)
    for (i = START; i < END; i++) {
        for (j = 0; j < cols; j++) {

            k = i * cols + j;
            Jc = J[k];

            // directional derivates
            dN[k] = J[iN[i] * cols + j] - Jc;
            dS[k] = J[iS[i] * cols + j] - Jc;
            dW[k] = J[i * cols + jW[j]] - Jc;
            dE[k] = J[i * cols + jE[j]] - Jc;

            G2 = (dN[k] * dN[k] + dS[k] * dS[k] + dW[k] * dW[k] + dE[k] * dE[k]) / (Jc * Jc);

            L = (dN[k] + dS[k] + dW[k] + dE[k]) / Jc;

            num = (0.5 * G2) - ((1.0 / 16.0) * (L * L));
            den = 1 + (.25 * L);
            qsqr = num / (den * den);

            // diffusion coefficent (equ 33)
            den = (qsqr - q0sqr) / (q0sqr * (1 + q0sqr));
            c[k] = 1.0 / (1.0 + den);

            // saturate diffusion coefficent
            if (c[k] < 0) {
                c[k] = 0;
            }
            else if (c[k] > 1) {
                c[k] = 1;
            }
        }
    }
}

function func2() {

    var i, j, k, D, cS, cN, cW, cE;
    // #pragma omp parallel for shared(J, c, rows, cols, lambda) private(i, j, k, D, cS, cN, cW, cE)
    for (i = START; i < END; i++) {
        for (j = 0; j < cols; j++) {

            // current index
            k = i * cols + j;

            // diffusion coefficent
            cN = c[k];
            cS = c[iS[i] * cols + j];
            cW = c[k];
            cE = c[i * cols + jE[j]];

            // divergence (equ 58)
            D = cN * dN[k] + cS * dS[k] + cW * dW[k] + cE * dE[k];

            // image update (equ 61)
            J[k] = J[k] + 0.25 * lambda * D;
        }
    }
}
