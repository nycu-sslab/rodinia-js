# C compiler
CC = gcc
CC_FLAGS = -g -fopenmp -O2 

kmeans: kmeans.o 
	$(CC) $(CC_FLAGS) kmeans.o -o kmeans

%.o: %.[ch]
	$(CC) $(CC_FLAGS) $< -c
	
kmeans.o: kmeans.c 
	$(CC) $(CC_FLAGS) kmeans.c -c

clean:
	rm -f *.o *~ kmeans 
