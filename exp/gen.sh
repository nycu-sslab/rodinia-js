#!/usr/bin/bash

BASE_PATH=$PWD
BASE_URL="http:\/\/localhost:8081\/"

SCRIPT_DIR="gen_bench"

rm -rf tmp
mkdir tmp

cp -r ../benchmarks/* tmp

if [[ ! -d output ]]; then
    mkdir output
fi

for script in $SCRIPT_DIR/*.sh; do
    echo "Running $script..."
    bash $script $BASE_PATH $BASE_URL
done
