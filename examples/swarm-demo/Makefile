# Makefile for ActiveLog Swarm Demo (C)

CC = gcc
CFLAGS = -Wall -Wextra -O2 -std=c11
LDFLAGS = -lactivelog -lpthread -lm

ACTIVELOG_DIR = ../../packages/activelog
INCLUDE_DIR = $(ACTIVELOG_DIR)/include
LIB_DIR = $(ACTIVELOG_DIR)/target/release

TARGETS = swarm-node swarm-client
SOURCES_NODE = swarm-node.c
SOURCES_CLIENT = swarm-client.c

all: $(TARGETS)

$(LIB_DIR)/libactivelog.a:
	@echo "Building ActiveLog library..."
	cd $(ACTIVELOG_DIR) && cargo build --release

swarm-node: $(SOURCES_NODE) $(LIB_DIR)/libactivelog.a
	@echo "Building swarm node..."
	$(CC) $(CFLAGS) -I$(INCLUDE_DIR) $(SOURCES_NODE) -L$(LIB_DIR) $(LDFLAGS) -o swarm-node
	@echo "Built swarm-node"

swarm-client: $(SOURCES_CLIENT) $(LIB_DIR)/libactivelog.a
	@echo "Building swarm client..."
	$(CC) $(CFLAGS) -I$(INCLUDE_DIR) $(SOURCES_CLIENT) -L$(LIB_DIR) $(LDFLAGS) -o swarm-client
	@echo "Built swarm-client"

clean:
	rm -f $(TARGETS)

.PHONY: all clean
