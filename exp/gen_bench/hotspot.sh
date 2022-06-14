BASE_PATH=$1
BASE_URL=$2

DATASET_NAME=dataset
THREAD_NAME=thread


cd $BASE_PATH
cd tmp/hotspot

for number in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    mkdir "$DATASET_NAME$number"
    cp *.js *.html "$DATASET_NAME$number"
done

replace_js() {
    file=$1
    number=$2

    times=("" "1" "10" "50" "100" "150")
    url=$BASE_URL"exp\/tmp\/hotspot\/data\/"

    mv $file tmp.js
    sed "s/sim_time: 100/sim_time: ${times[$number]}/g" tmp.js |
        sed "s/data\//$url/g" >$file

    rm tmp.js
}

replace_js_thread() {
    file=$1
    number=$2

    mv $file tmp.js
    sed "s/\"thread_num\": 4/\"thread_num\": $number/g" tmp.js |
        sed "s/thread_num: 4/thread_num: $number/g" >$file
    rm tmp.js
}


replace_js2() {
    file=$1
    number=$2

    times=("" "" "" "" "" "" "10" "50" "100" "200" "300")
    url=$BASE_URL"exp\/tmp\/hotspot\/data\/"

    mv $file tmp.js
    sed "s/sim_time: 100/sim_time: ${times[$number]}/g" tmp.js |
        sed "s/1024/512/g" |
        sed "s/data\//$url/g" >$file

    rm tmp.js
}

replace_js3() {
    file=$1
    number=$2

    times=("" "" "" "" "" "" "" "" "" "" "" "10" "50" "100" "200" "300")
    url=$BASE_URL"exp\/tmp\/hotspot\/data\/"

    mv $file tmp.js
    sed "s/sim_time: 100/sim_time: ${times[$number]}/g" tmp.js |
        sed "s/1024/64/g" |
        sed "s/data\//$url/g" >$file

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

# big IO
for number in 1 2 3 4 5; do
    cd "$DATASET_NAME$number"

    for f in *.js; do
        replace_js $f $number
    done

    for f in *.html; do
        replace_html $f
    done

    handle_thread

    cd ..
done

# medium IO
for number in 6 7 8 9 10; do
    cd "$DATASET_NAME$number"

    for f in *.js; do
        replace_js2 $f $number
    done

    for f in *.html; do
        replace_html $f
    done

    handle_thread

    cd ..
done

# small IO
for number in 11 12 13 14 15; do
    cd "$DATASET_NAME$number"

    for f in *.js; do
        replace_js3 $f $number
    done

    for f in *.html; do
        replace_html $f
    done

    handle_thread

    cd ..
done

cp -r $DATASET_NAME"6" $DATASET_NAME"0"
