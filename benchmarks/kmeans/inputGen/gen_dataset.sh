#!/bin/bash
./datagen 1000
./datagen 10000
./datagen 20000
./datagen 30000
./datagen 40000
./datagen 50000
./datagen 10000 -f
./datagen 20000 -f
./datagen 30000 -f
./datagen 40000 -f
./datagen 50000 -f

cp 10000_34.txt 1.txt
cp 20000_34.txt 2.txt
cp 30000_34.txt 3.txt
cp 40000_34.txt 4.txt
cp 50000_34.txt 5.txt

cp 10000_34f.txt 6.txt
cp 20000_34f.txt 7.txt
cp 30000_34f.txt 8.txt
cp 40000_34f.txt 9.txt
cp 50000_34f.txt 10.txt