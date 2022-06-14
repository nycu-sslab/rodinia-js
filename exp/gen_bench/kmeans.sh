BASE_PATH=$1
BASE_URL=$2

DATASET_NAME=dataset
THREAD_NAME=thread

cd $BASE_PATH
cd tmp/kmeans

for number in 1 2 3 4 5 6 7 8 9 10; do
    mkdir "$DATASET_NAME$number"
    cp *.js *.html "$DATASET_NAME$number"
done

replace_js() {
    file=$1
    new_name=$2

    mv $file tmp.js
    url=$BASE_URL"exp\/tmp\/kmeans\/inputGen\/$new_name"
    sed "s/inputGen\/1000_34.txt/$url/g" tmp.js | 
    sed "s/0.001/0.001/g"  > $file
    rm tmp.js
}

replace_js_thread() {
    file=$1
    number=$2

    mv $file tmp.js
    sed "s/\"nthreads\": 4/\"nthreads\": $number/g" tmp.js |
        sed "s/nthreads: 4/nthreads: $number/g" >$file
    rm tmp.js
}

replace_html() {
    file=$1

    mv $file tmp.html
    url=$BASE_URL"exp\/tmp"
    sed "s/..\/..\/..\/frontend\/build/$url/g" tmp.html >$file
    rm tmp.html
}

handle_thread() {
    for number in 1 2 3 4; do
        mkdir "$THREAD_NAME$number"
        cp *.js *.html "$THREAD_NAME$number"
        cd "$THREAD_NAME$number"
        for f in *.js; do
            replace_js_thread $f $number
        done
        cd ..
    done
}


for number in 1 2 3 4 5 6 7 8 9 10; do
    cd "$DATASET_NAME$number"

    filename=$number.txt

    for f in *.js; do
        replace_js $f $filename
    done

    for f in *.html; do
        replace_html $f
    done

    handle_thread

    cd ..
done

cp -r $DATASET_NAME"2" $DATASET_NAME"0"
