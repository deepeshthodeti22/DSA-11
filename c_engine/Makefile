CC = gcc
CFLAGS = -O2 -Wall -Wextra -std=c11
LDFLAGS = -lm

SRCS = main.c json.c dag.c avl.c bst.c heap.c dijkstra.c linkedlist.c
TARGET = its_engine

all: $(TARGET)

$(TARGET): $(SRCS) common.h
	$(CC) $(CFLAGS) -o $(TARGET) $(SRCS) $(LDFLAGS)

clean:
	rm -f $(TARGET)
