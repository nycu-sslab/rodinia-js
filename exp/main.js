const { fstat, writeFileSync } = require('fs');
const { Builder, By, Key, until } = require('selenium-webdriver');
const { Options } = require('selenium-webdriver/chrome');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const SERVER_DOMAIN = "localhost:8081"

const ROUND_NUM = 5;
const OFFSET = 1;
// this is a reserved parameter to allow to run many datasets,
// but currently it only run the dataset0.
const DATA_NUM = 0;

const bench_list = ["backprop", "bfs", "hotspot", "kmeans", "nw", "srad"];

let driver;

async function setup() {
  try {
    const {
      stdout1,
      stderr1
    } = await exec('bash gen.sh');
  } catch (e) { }
}

async function test_page(url) {

  const output = {
    total_time: 0,
    proxy_overhead: 0,
    io_time: 0,
    init_worker_time: 0,
    compute_wo_msg: 0,
    est_msg: 0,
    other: 0
  }

  async function run() {
    try {
      await driver.get(url);
      const flagElem = await driver.findElement(By.id('flag'));
      await driver.wait(until.elementTextContains(flagElem, "done"), 20000);
    } catch (e) {
      console.log("retry", e);
      await driver.get(url);
      const flagElem = await driver.findElement(By.id('flag'));
      await driver.wait(until.elementTextContains(flagElem, "done"), 20000);
    }

    for (const key of Object.keys(output)) {
      const elem = await driver.findElement(By.id(key));
      output[key] = Number(await elem.getText());
    }
  }

  await run();

  return output
}

function data_process(result) {
  result.sort(function (a, b) {
    return a.total_time - b.total_time;
  });

  const output = {};
  for (const key of Object.keys(result[0])) {
    let avg = 0, std, V_sum = 0, val;
    for (let i = OFFSET; i < result.length - OFFSET; i++) {
      val = result[i][key];
      avg += val;
      V_sum += val * val;
    }
    avg /= ROUND_NUM;
    std = Math.sqrt(V_sum / ROUND_NUM - avg * avg);
    output[key + "_avg"] = avg;
    output[key + "_std"] = std;
  }

  return output;
}

async function collect_data_web(url) {
  const result = [];
  for (let round = 0; round < ROUND_NUM + OFFSET * 2; round++) {
    const d = await test_page(url);
    result.push(d);
  }

  return data_process(result);
}

async function collect_data_node(thread, path) {
  let result = [];

  const config = require(path + "node_config.js");
  config["thread_num"] = thread;
  const file = "node_proxy.js";
  const node_runtime = require(path + file)
  for (let round = 0; round < ROUND_NUM + OFFSET * 2; round++) {
    const d = await node_runtime(config);
    console.log(d)
    result.push(d);
  }

  return data_process(result);
}

async function test_benchmarks(bench_name, thread_num) {
  // const list = ["web_proxy", "web_proxy_offload"]
  const list = ["web_proxy"]

  const all_data = [];

  for (let i = 0; i <= DATA_NUM; i++) {
    const data = {};

    for (idx in list) {
      const url = `http://${SERVER_DOMAIN}/exp/tmp/${bench_name}/dataset${i}/thread${thread_num}/${list[idx]}.html`;
      console.log("testing", url)

      let d = await collect_data_web(url);
      data[list[idx]] = d;
    }

    console.log("testing node serial")
    const node_path = `./tmp/${bench_name}/dataset${i}/thread${thread_num}/`;
    data['node_serial'] = await collect_data_node(1, node_path);

    console.log("testing node parallel")
    data['node_parallel'] = await collect_data_node(thread_num, node_path);

    all_data.push(data);

  }

  console.log(all_data);

  store_data(`${bench_name}_${thread_num}.json`, all_data);
}

function store_data(name, data) {
  writeFileSync("output/" + name, JSON.stringify(data));
}

async function main() {

  driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(new Options().addArguments("--headless"))
    .build();

  try {

    // await setup();

    try {
      for (const name of bench_list) {
        for (let thread_num = 1; thread_num <= 4; thread_num++) {
          await test_benchmarks(name, thread_num);
        }
      }
    } catch (e) {
      console.log(e)
    }

  } finally {
    await driver.quit();
  }
};

main();
