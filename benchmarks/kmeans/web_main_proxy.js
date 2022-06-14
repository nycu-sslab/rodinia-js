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
        nclusters: 5,
        nloops: 1,
        nthreads: 4,
        threshold: 0.001,
        filename: "inputGen/1000_34.txt"
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

async function main(argc) {
    var start_time = performance.now();
    const result = await kmeans(argc);
    var end_time = performance.now();

    total_proxy_time = end_time - start_time;
    console.log("Total proxy time:", total_proxy_time);
}


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
                    // inner_worker_running_time += e.data.run_time;
                    // outer_worker_running_time += performance.now() - time_marker;
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

/*----< kmeans_clustering() >---------------------------------------------*/
async function kmeans_clustering(feature,//float ** feature, /* in: [npoints][nfeatures] */
    nfeatures,// int nfeatures,
    npoints,// int npoints,
    nclusters,// int nclusters,
    threshold,//float threshold
    nthreads) {

    var i, j, k, n = 0, index, loop = 0;
    var new_centers_len; // int *  /* [nclusters]: no. of points in each cluster */
    var new_centers; //float ** new_centers; /* [nclusters][nfeatures] */
    var clusters;  // float ** clusters;    /* out: [nclusters][nfeatures] */
    var delta;
    thread_num = nthreads;

    var timing;

    var nthreads;
    var partial_new_centers_len;// int ** partial_new_centers_len;
    var partial_new_centers; //float *** partial_new_centers;

    var membership;
    var membershipBuf = new SharedArrayBuffer(npoints * Int32Array.BYTES_PER_ELEMENT);
    membership = new Int32Array(membershipBuf);


    /* allocate space for returning variable clusters[] */
    clusters = [];
    clustersBuf = new SharedArrayBuffer(nclusters * nfeatures * Float64Array.BYTES_PER_ELEMENT)

    for (i = 0; i < nclusters; i++) {
        clusters[i] = new Float64Array(clustersBuf, i * nfeatures * Float64Array.BYTES_PER_ELEMENT,
            nfeatures);
    }



    /* randomly pick cluster centers */
    for (i = 0; i < nclusters; i++) {
        //n = (int)rand() % npoints;
        for (j = 0; j < nfeatures; j++)
            clusters[i][j] = feature[n][j];
        n++;
    }

    for (i = 0; i < npoints; i++)
        membership[i] = -1;

    /* need to initialize new_centers_len and new_centers[0] to all 0 */
    new_centers_len = new Int32Array(nclusters);

    new_centers = [];
    for (i = 0; i < nclusters; i++)
        new_centers[i] = new Float64Array(nfeatures);

    partial_new_centers_len = [];
    partial_new_centers_len_buf = new SharedArrayBuffer(nthreads * nclusters * Float64Array.BYTES_PER_ELEMENT);
    for (i = 0; i < nthreads; i++)
        partial_new_centers_len[i] = new Float64Array(partial_new_centers_len_buf,
            i * nclusters * Float64Array.BYTES_PER_ELEMENT, nclusters);


    partial_new_centers = [];//(float ***)malloc(nthreads * sizeof(float **));
    partial_new_centers_buf = new SharedArrayBuffer(
        nthreads * nclusters * nfeatures * Float64Array.BYTES_PER_ELEMENT);
    for (i = 0; i < nthreads; i++)
        partial_new_centers[i] = []

    for (i = 0; i < nthreads; i++) {
        for (j = 0; j < nclusters; j++)
            partial_new_centers[i][j] = new Float64Array(partial_new_centers_buf,
                (i * nclusters + j) * nfeatures * Float64Array.BYTES_PER_ELEMENT, nfeatures);
    }

    var deltaBuf = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
    var delta = new Int32Array(deltaBuf);

    var start_time_worker = performance.now();
    workers = await init_workers(thread_num, {
        msg: "start",
        npoints,
        nclusters,
        nfeatures,
        feature,
        clusters,
        delta,
        membership,
        partial_new_centers_len,
        partial_new_centers,
        thread_num
    });
    init_worker_time += performance.now() - start_time_worker;

    var barrierBuf = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
    var barrier = new Int32Array(barrierBuf);
    barrier[0] = 0;

    console.log(`num of threads = ${thread_num}`);
    do {

        Atomics.store(delta, 0, 0)

        await new Promise((resolve, reject) => {
            const time_marker = performance.now();

            Atomics.store(barrier, 0, 0)

            for (let i = 0; i < thread_num; i++) {

                workers[i].onmessage = e => {
                    if (e.data.msg == "done1") {
                        inner_worker_running_time += e.data.run_time;
                        outer_worker_running_time += performance.now() - time_marker;

                        Atomics.add(barrier, 0, 1);

                        if (Atomics.load(barrier, 0) == thread_num) {
                            resolve();
                        }
                    }
                };

                workers[i].postMessage({
                    msg: "func1",
                });
            }
        });

        /* let the main thread perform the array reduction */
        for (i = 0; i < nclusters; i++) {
            for (j = 0; j < nthreads; j++) {
                new_centers_len[i] += partial_new_centers_len[j][i];
                partial_new_centers_len[j][i] = 0.0;
                for (k = 0; k < nfeatures; k++) {
                    new_centers[i][k] += partial_new_centers[j][i][k];
                    partial_new_centers[j][i][k] = 0.0;
                }
            }
        }

        /* replace old cluster centers with new_centers */
        for (i = 0; i < nclusters; i++) {
            for (j = 0; j < nfeatures; j++) {
                if (new_centers_len[i] > 0)
                    clusters[i][j] = new_centers[i][j] / new_centers_len[i];
                new_centers[i][j] = 0.0; /* set back to 0 */
            }
            new_centers_len[i] = 0; /* set back to 0 */
        }

    } while (delta[0] > threshold && loop++ < 500);

    workers.forEach(w => {
        w.terminate();
    });

    return clusters;
}

async function kmeans(args) {
    var nclusters = args.nclusters;
    var attributes = [];
    var cluster_centres = null;
    var i, j;

    // var numAttributes = args.numAttributes;
    // var numObjects = args.numObjects;
    var numAttributes;
    var numObjects;
    var nloops = args.nloops;
    var threshold = args.threshold;
    var nthreads = args.nthreads;

    var io_time_marker = performance.now();
    console.log("Reading File\n");
    var data = await fetch(args.filename);

    var content = await data.text();
    var lines = content.split('\n');

    numObjects = lines.length - 1;
    numAttributes = lines[0].split(' ').length - 2;

    var attributesBuf = new SharedArrayBuffer(
        numObjects * numAttributes * Float64Array.BYTES_PER_ELEMENT);

    for (i = 0; i < numObjects; i++) {
        attributes[i] = new Float64Array(attributesBuf,
            i * numAttributes * Float64Array.BYTES_PER_ELEMENT, numAttributes);
        const attrs = lines[i].split(' ');
        // skip the first number
        for (j = 1; j <= numAttributes; j++) {
            attributes[i][j - 1] = Number(attrs[j]);
        }
    }

    io_time += performance.now() - io_time_marker;
    console.log("I/O completed");


    var compute_time_marker = performance.now();
    for (i = 0; i < nloops; i++) {
        cluster_centres = await kmeans_clustering(attributes,
            numAttributes,
            numObjects,
            nclusters,
            threshold,
            nthreads
        );

    }
    compute_time += performance.now() - compute_time_marker;
    compute_time -= init_worker_time; // init worker is included in the whole compute time.

    console.log("number of Clusters", nclusters);
    console.log("number of Attributes", numAttributes);
    console.log("");

    console.log("Cluster Centers Output");
    console.log("The first number is cluster number and the following data is arribute value");
    console.log("=============================================================================\n");

    for (i = 0; i < nclusters; i++) {
        var str = i + ": ";
        for (j = 0; j < numAttributes; j++)
            str += cluster_centres[i][j].toFixed(2) + " ";
        console.log(str + '\n')
    }

    console.log("Time for process:", compute_time, "ms");

    return (0);
}
