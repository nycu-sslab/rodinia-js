CC = g++
CC_FLAGS = -g -fopenmp -O2 -DOPEN

all: hotspot  

hotspot: main.cpp Makefile 
	$(CC) $(CC_FLAGS) main.cpp -o hotspot 

clean:
	rm -f hotspot 
