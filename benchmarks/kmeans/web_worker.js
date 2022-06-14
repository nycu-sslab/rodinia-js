"use strict"
var npoints,
    nclusters,
    nfeatures,
    feature,
    clusters,
    delta,
    membership,
    partial_new_centers_len,
    partial_new_centers,
    thread_id,
    thread_num,
    start,
    end;

addEventListener('message', function (e) {
    const first_time = performance.now();

    const data = e.data;

    if (data.msg == "start") {
        npoints = data.npoints;
        nclusters = data.nclusters;
        nfeatures = data.nfeatures;
        feature = data.feature;
        clusters = data.clusters;
        delta = data.delta;
        membership = data.membership;
        partial_new_centers_len = data.partial_new_centers_len;
        partial_new_centers = data.partial_new_centers;
        thread_num = data.thread_num;
        thread_id = data.thread_id;

        var block = (npoints / thread_num) | 0;
        start = block * thread_id;
        end = thread_id != thread_num - 1 ? block * (thread_id + 1) : npoints;

        const run_time = performance.now() - first_time;

        postMessage({
            msg: "done",
            run_time,
        });
    } else if (data.msg == "func1") {
        func1();

        const run_time = performance.now() - first_time;

        postMessage({
            msg: "done1",
            run_time,
        });
    }

});

function func1() {
    var i, j, index;

    // #pragma omp for private(i, j, index) \
    //        firstprivate(npoints, nclusters, nfeatures) \
    //       schedule(static) \
    //       reduction(+                         \
    //                 : delta)
    for (i = start; i < end; i++) {
        /* find the index of nestest cluster centers */
        index = find_nearest_point(feature[i],
            nfeatures,
            clusters,
            nclusters);
        /* if membership changes, increase delta by 1 */
        if (membership[i] != index)
            Atomics.add(delta, 0, 1)


        /* assign the membership to object i */
        membership[i] = index;

        /* update new cluster centers : sum of all objects located
       within */
        partial_new_centers_len[thread_id][index]++;
        for (j = 0; j < nfeatures; j++) {
            partial_new_centers[thread_id][index][j] += feature[i][j];
        }
    }
}

function find_nearest_point(pt, // float *pt, /* [nfeatures] */
    nfeatures,//int nfeatures,
    pts,//                float **pts, /* [npts][nfeatures] */
    npts) //                   int npts)
{
    var index, i;
    var min_dist = 3.40282347e+38;



    /* find the cluster center id with min distance to pt */
    for (i = 0; i < npts; i++) {
        var dist;

        {
            var j;
            var ans = 0.0;

            var pt1 = pt;
            var pt2 = pts[i];

            for (j = 0; j < nfeatures; j++) {
                ans += (pt1[j] - pt2[j]) * (pt1[j] - pt2[j]);
            }


            dist = ans;
        }

        if (dist < min_dist) {
            min_dist = dist;
            index = i;
        }
    }
    return (index);
}