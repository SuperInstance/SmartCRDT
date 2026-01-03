# Makefile for ActiveLog Archival Demo (C)

CC = gcc
CFLAGS = -Wall -Wextra -O2 -std=c11
LDFLAGS = -lactivelog -lpthread -lm

ACTIVELOG_DIR = ../../packages/activelog
INCLUDE_DIR = $(ACTIVELOG_DIR)/include
LIB_DIR = $(ACTIVELOG_DIR)/target/release

TARGET = archival-demo
SOURCES = archival-demo.c

all: $(TARGET)

$(LIB_DIR)/libactivelog.a:
	@echo "Building ActiveLog library..."
	cd $(ACTIVELOG_DIR) && cargo build --release

$(TARGET): $(SOURCES) $(LIB_DIR)/libactivelog.a
	@echo "Building archival demo..."
	$(CC) $(CFLAGS) -I$(INCLUDE_DIR) $(SOURCES) -L$(LIB_DIR) $(LDFLAGS) -o $(TARGET)
	@echo "Build complete!"
	@echo "Run demo: ./$(TARGET) --demo"

clean:
	rm -f $(TARGET)

.PHONY: all clean
