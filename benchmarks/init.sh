cd benchmarks
BASE=$PWD

cd backprop/inputGen
make
bash gen.sh

cd $BASE
cd bfs/inputGen
make
bash gen_exp_dataset.sh

cd $BASE
cd kmeans/inputGen
make
bash gen_dataset.sh

cd $BASE
cd nw/inputGen
make
bash gen.sh

cd $BASE
cd srad/inputGen
make
bash gen.sh
