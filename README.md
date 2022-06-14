# Rodinia-JS

Rodinia-JS is used for the thesis, "[Offworker: An Offloading Framework for Parallel Web Applications](https://etd.lib.nctu.edu.tw/cgi-bin/gs32/tugsweb.cgi?o=dnctucdr&s=id=%22GT0708560050%22.&switchlang=en)," authored by Liu, An-Chi and You, Yi-Ping.

Rodinia-JS is a manually ported the [Rodinia benchmark suite](https://www.cs.virginia.edu/rodinia/doku.php?id=start) (version 1) from OpenMP into JavaScript, where the  computation-intensive parts of the programs (i.e., kernels) were expressed by using the Web Workers API with the proxy pattern. All Rodinia applications have been successfully ported, except "Leukocyte Tracking", "Stream Cluster", and "Similarity Score" due to their large code size (over 3,000 lines of code). We call this new benchmark suite Rodinia-JS.

The Rodinia benchmark suite includes some datasets, but their size is too large for client-side web applications, which fetch external data from the web server rather than from the local file system, since data fetching is likely to become a major task of the applications. We scaled down the datasets to meet the following criteria (the default `dataset0`): (1) the total running time of an application on the mobile device takes less than seven seconds while the time spent in data fetching is less than two seconds, which is more reasonable for web applications as more than half of visits are abandoned if a mobile site takes over three seconds to load ([ref](https://developer.chrome.com/blog/search-ads-speed/)), and (2) the time spent in computation is greater than the overhead time incurred by creating workers, which makes sense for parallelization to be beneficial.

## Setup

### Node.js

Node.js is required. You can use NVM to install Node.js

```sh
# install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

# refresh shell
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm

# install Node.js
nvm install node

# check Node.js
node -v
```

### Chrome

Install chrome 91 (tested version, but may work for the latest Chrome)

```sh
# install chrome 91
wget http://dl.google.com/linux/chrome/deb/pool/main/g/google-chrome-stable/google-chrome-stable_91.0.4472.164-1_amd64.deb

sudo apt -y install ./google-chrome-...._amd64.deb
google-chrome-stable --version
```

Download the corresponding [Chrome Driver](https://sites.google.com/chromium.org/driver/downloads?authuser=0).

helpful reading: https://unix.stackexchange.com/questions/233185/install-older-versions-of-google-chrome-stable-on-ubuntu-14-10

## Setup

Modify `SERVER_DOMAIN` in `exp/main.js` and `BASE_URL` in `exp/gen.sh`.

```sh
$ cd exp
$ bash gen.sh # create datasets for testing.
$ npm install # install modules
```

## Usage

Open a web server for this project (listen on port 8081).

```sh
$ node tool/http_server.js
```

Run the benchmark.

```sh
$ cd exp; node main.js
```

The output will be stored in `exp/output`.

## Datasets

Once generating datasets by the previous process, there are multiple datasets in `exp/tmp/{APP_NAME}/`. `dataset0` is the default dataset used by the thesis.

The default dataset had been verified correctness with the original OpenMP's result. If you use other dataset or other input datum, you may need to verify the result.

## Citation

If you use Rodinia-JS for academical purpose, please cite the followings:

- S. Che, M. Boyer, J. Meng, D. Tarjan, J. W. Sheaffer, S.-H. Lee, and K. Skadron. Rodinia: A Benchmark Suite for Heterogeneous Computing. In Proceedings of the IEEE International Symposium on Workload Characterization (IISWC), pp. 44-54, Oct. 2009.
- Liu, An-Chi and You, Yi-Ping, "Offworker: An Offloading Framework for Parallel Web Applications,"  M.S. thesis, Institute of Computer Science and Engineering, National Yang Ming Chiao Tung University, Hsinchu, Taiwan, 2022. [Online]. Available: https://etd.lib.nctu.edu.tw/cgi-bin/gs32/tugsweb.cgi?o=dnctucdr&s=id=%22GT0708560050%22.&switchlang=en

## License

The source code of OpenMP Rodinia follows the [Rodinia license](https://www.cs.virginia.edu/rodinia/doku.php#license) and Rodinia-JS follows MIT license.
