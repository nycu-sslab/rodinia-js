#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>
#include <math.h>
#include <sys/types.h>
#include <fcntl.h>
#include <omp.h>
#include "getopt.h"
#include <float.h>

extern double wtime(void);

int num_omp_threads = 1;

#define RANDOM_MAX 2147483647

#ifndef FLT_MAX
#define FLT_MAX 3.40282347e+38
#endif

int find_nearest_point(double *pt, /* [nfeatures] */
                       int nfeatures,
                       double **pts, /* [npts][nfeatures] */
                       int npts);
__inline double euclid_dist_2(double *pt1,
                             double *pt2,
                             int numdims);

double **kmeans_clustering(double **feature, /* in: [npoints][nfeatures] */
                          int nfeatures,
                          int npoints,
                          int nclusters,
                          double threshold);

int find_nearest_point(double *pt, /* [nfeatures] */
                       int nfeatures,
                       double **pts, /* [npts][nfeatures] */
                       int npts)
{
    int index, i;
    double min_dist = FLT_MAX;

    /* find the cluster center id with min distance to pt */
    for (i = 0; i < npts; i++)
    {
        double dist;
        dist = euclid_dist_2(pt, pts[i], nfeatures); /* no need square root */
        if (dist < min_dist)
        {
            min_dist = dist;
            index = i;
        }
    }
    return (index);
}

/*----< euclid_dist_2() >----------------------------------------------------*/
/* multi-dimensional spatial Euclid distance square */
__inline double euclid_dist_2(double *pt1,
                             double *pt2,
                             int numdims)
{
    int i;
    double ans = 0.0;

    for (i = 0; i < numdims; i++)
        ans += (pt1[i] - pt2[i]) * (pt1[i] - pt2[i]);

    return (ans);
}

/*----< kmeans_clustering() >---------------------------------------------*/
double **kmeans_clustering(double **feature, /* in: [npoints][nfeatures] */
                          int nfeatures,
                          int npoints,
                          int nclusters,
                          double threshold)
{

    int i, j, k, n = 0, index, loop = 0;
    int *new_centers_len; /* [nclusters]: no. of points in each cluster */
    double **new_centers; /* [nclusters][nfeatures] */
    double **clusters;    /* out: [nclusters][nfeatures] */
    double delta;

    double timing;

    int nthreads;
    int **partial_new_centers_len;
    double ***partial_new_centers;

    int *membership;
    membership = (int *)malloc(npoints * sizeof(int));

    nthreads = num_omp_threads;

    /* allocate space for returning variable clusters[] */
    clusters = (double **)malloc(nclusters * sizeof(double *));
    clusters[0] = (double *)malloc(nclusters * nfeatures * sizeof(double));
    for (i = 1; i < nclusters; i++)
        clusters[i] = clusters[i - 1] + nfeatures;

    /* randomly pick cluster centers */
    for (i = 0; i < nclusters; i++)
    {
        //n = (int)rand() % npoints;
        for (j = 0; j < nfeatures; j++)
            clusters[i][j] = feature[n][j];
        n++;
    }

    for (i = 0; i < npoints; i++)
        membership[i] = -1;

    /* need to initialize new_centers_len and new_centers[0] to all 0 */
    new_centers_len = (int *)calloc(nclusters, sizeof(int));

    new_centers = (double **)malloc(nclusters * sizeof(double *));
    new_centers[0] = (double *)calloc(nclusters * nfeatures, sizeof(double));
    for (i = 1; i < nclusters; i++)
        new_centers[i] = new_centers[i - 1] + nfeatures;

    partial_new_centers_len = (int **)malloc(nthreads * sizeof(int *));
    partial_new_centers_len[0] = (int *)calloc(nthreads * nclusters, sizeof(int));
    for (i = 1; i < nthreads; i++)
        partial_new_centers_len[i] = partial_new_centers_len[i - 1] + nclusters;

    partial_new_centers = (double ***)malloc(nthreads * sizeof(double **));
    partial_new_centers[0] = (double **)malloc(nthreads * nclusters * sizeof(double *));
    for (i = 1; i < nthreads; i++)
        partial_new_centers[i] = partial_new_centers[i - 1] + nclusters;

    for (i = 0; i < nthreads; i++)
    {
        for (j = 0; j < nclusters; j++)
            partial_new_centers[i][j] = (double *)calloc(nfeatures, sizeof(double));
    }
    printf("num of threads = %d\n", num_omp_threads);
    do
    {
        delta = 0.0;
        omp_set_num_threads(num_omp_threads);
#pragma omp parallel \
    shared(feature, clusters, membership, partial_new_centers, partial_new_centers_len)
        {
            int tid = omp_get_thread_num();
#pragma omp for private(i, j, index)            \
    firstprivate(npoints, nclusters, nfeatures) \
        schedule(static)                        \
            reduction(+                         \
                      : delta)
            for (i = 0; i < npoints; i++)
            {
                /* find the index of nestest cluster centers */
                index = find_nearest_point(feature[i],
                                           nfeatures,
                                           clusters,
                                           nclusters);
                /* if membership changes, increase delta by 1 */
                if (membership[i] != index)
                    delta += 1.0;

                /* assign the membership to object i */
                membership[i] = index;

                /* update new cluster centers : sum of all objects located
		       within */
                partial_new_centers_len[tid][index]++;
                for (j = 0; j < nfeatures; j++)
                    partial_new_centers[tid][index][j] += feature[i][j];
            }
        } /* end of #pragma omp parallel */

        /* let the main thread perform the array reduction */
        for (i = 0; i < nclusters; i++)
        {
            for (j = 0; j < nthreads; j++)
            {
                new_centers_len[i] += partial_new_centers_len[j][i];
                partial_new_centers_len[j][i] = 0.0;
                for (k = 0; k < nfeatures; k++)
                {
                    new_centers[i][k] += partial_new_centers[j][i][k];
                    partial_new_centers[j][i][k] = 0.0;
                }
            }
        }

        /* replace old cluster centers with new_centers */
        for (i = 0; i < nclusters; i++)
        {
            for (j = 0; j < nfeatures; j++)
            {
                if (new_centers_len[i] > 0)
                    clusters[i][j] = new_centers[i][j] / new_centers_len[i];
                new_centers[i][j] = 0.0; /* set back to 0 */
            }
            new_centers_len[i] = 0; /* set back to 0 */
        }

    } while (delta > threshold && loop++ < 500);

    free(new_centers[0]);
    free(new_centers);

    return clusters;
}

/*---< usage() >------------------------------------------------------------*/
void usage(char *argv0)
{
    char *help =
        "Usage: %s [switches] -i filename\n"
        "       -i filename     		: file containing data to be clustered\n"
        "       -b                 	: input file is in binary format\n"
        "       -k                 	: number of clusters (default is 5) \n"
        "       -t threshold		: threshold value\n"
        "       -n no. of threads	: number of threads";
    fprintf(stderr, help, argv0);
    exit(-1);
}


/*---< main() >-------------------------------------------------------------*/
int main(int argc, char **argv)
{
    int opt;
    extern char *optarg;
    extern int optind;
    int nclusters = 5;
    char *filename = 0;
    double *buf;
    double **attributes;
    double **cluster_centres = NULL;
    int i, j;

    int numAttributes;
    int numObjects;
    char line[1024];
    int isBinaryFile = 0;
    int nloops = 1;
    double threshold = 0.001;
    double timing;

    while ((opt = getopt(argc, argv, "i:k:t:b:n:?")) != EOF)
    {
        switch (opt)
        {
        case 'i':
            filename = optarg;
            break;
        case 'b':
            isBinaryFile = 1;
            break;
        case 't':
            threshold = atof(optarg);
            break;
        case 'k':
            nclusters = atoi(optarg);
            break;
        case 'n':
            num_omp_threads = atoi(optarg);
            break;
        case '?':
            usage(argv[0]);
            break;
        default:
            usage(argv[0]);
            break;
        }
    }

    if (filename == 0)
        usage(argv[0]);

    numAttributes = numObjects = 0;

    /* from the input file, get the numAttributes and numObjects ------------*/

    if (isBinaryFile)
    {
        int infile;
        if ((infile = open(filename, O_RDONLY, "0600")) == -1)
        {
            fprintf(stderr, "Error: no such file (%s)\n", filename);
            exit(1);
        }
        read(infile, &numObjects, sizeof(int));
        read(infile, &numAttributes, sizeof(int));

        /* allocate space for attributes[] and read attributes of all objects */
        buf = (double *)malloc(numObjects * numAttributes * sizeof(double));
        attributes = (double **)malloc(numObjects * sizeof(double *));
        attributes[0] = (double *)malloc(numObjects * numAttributes * sizeof(double));
        for (i = 1; i < numObjects; i++)
            attributes[i] = attributes[i - 1] + numAttributes;

        read(infile, buf, numObjects * numAttributes * sizeof(double));

        close(infile);
    }
    else
    {
        FILE *infile;
        if ((infile = fopen(filename, "r")) == NULL)
        {
            fprintf(stderr, "Error: no such file (%s)\n", filename);
            exit(1);
        }
        while (fgets(line, 1024, infile) != NULL)
            if (strtok(line, " \t\n") != 0)
                numObjects++;
        rewind(infile);
        while (fgets(line, 1024, infile) != NULL)
        {
            if (strtok(line, " \t\n") != 0)
            {
                /* ignore the id (first attribute): numAttributes = 1; */
                while (strtok(NULL, " ,\t\n") != NULL)
                    numAttributes++;
                break;
            }
        }

        /* allocate space for attributes[] and read attributes of all objects */
        buf = (double *)malloc(numObjects * numAttributes * sizeof(double));
        attributes = (double **)malloc(numObjects * sizeof(double *));
        attributes[0] = (double *)malloc(numObjects * numAttributes * sizeof(double));
        for (i = 1; i < numObjects; i++)
            attributes[i] = attributes[i - 1] + numAttributes;
        rewind(infile);
        i = 0;
        while (fgets(line, 1024, infile) != NULL)
        {
            if (strtok(line, " \t\n") == NULL)
                continue;
            for (j = 0; j < numAttributes; j++)
            {
                buf[i] = atof(strtok(NULL, " ,\t\n"));
                i++;
            }
        }
        fclose(infile);
    }
    printf("I/O completed\n");

    memcpy(attributes[0], buf, numObjects * numAttributes * sizeof(double));

    timing = omp_get_wtime();
    for (i = 0; i < nloops; i++)
    {

        cluster_centres = kmeans_clustering(attributes,
                                            numAttributes,
                                            numObjects,
                                            nclusters,
                                            threshold);
    }
    timing = omp_get_wtime() - timing;

    printf("number of Clusters %d\n", nclusters);
    printf("number of Attributes %d\n\n", numAttributes);
    printf("Cluster Centers Output\n");
    printf("The first number is cluster number and the following data is arribute value\n");
    printf("=============================================================================\n\n");

    for (i = 0; i < nclusters; i++)
    {
        printf("%d: ", i);
        for (j = 0; j < numAttributes; j++)
            printf("%.2f ", cluster_centres[i][j]);
        printf("\n\n");
    }

    printf("Time for process: %f\n", timing);

    free(attributes);
    free(cluster_centres[0]);
    free(cluster_centres);
    free(buf);
    return (0);
}
