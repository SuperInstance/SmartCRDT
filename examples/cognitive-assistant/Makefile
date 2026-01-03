# Makefile for ActiveLog Cognitive Assistant (C)

CC = gcc
CFLAGS = -Wall -Wextra -O2 -std=c11 -pthread
LDFLAGS = -lactivelog -lpthread -lm

ACTIVELOG_DIR = ../../packages/activelog
INCLUDE_DIR = $(ACTIVELOG_DIR)/include
LIB_DIR = $(ACTIVELOG_DIR)/target/release

TARGET = cognitive-assistant
SOURCES = cognitive-assistant.c

all: $(TARGET)

$(LIB_DIR)/libactivelog.a:
	@echo "Building ActiveLog library..."
	cd $(ACTIVELOG_DIR) && cargo build --release

$(TARGET): $(SOURCES) $(LIB_DIR)/libactivelog.a
	@echo "Building cognitive assistant..."
	$(CC) $(CFLAGS) -I$(INCLUDE_DIR) $(SOURCES) -L$(LIB_DIR) $(LDFLAGS) -o $(TARGET)
	@echo "Build complete!"
	@echo "Run demo: ./$(TARGET) --demo"
	@echo "Run interactive: ./$(TARGET)"

clean:
	rm -f $(TARGET)

run-demo: $(TARGET)
	@echo "Running demo session..."
	LD_LIBRARY_PATH=$(LIB_DIR) ./$(TARGET) --demo

run: $(TARGET)
	@echo "Running interactive mode..."
	LD_LIBRARY_PATH=$(LIB_DIR) ./$(TARGET)

.PHONY: all clean run run-demo
