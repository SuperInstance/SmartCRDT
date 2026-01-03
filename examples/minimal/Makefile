# Makefile for ActiveLog minimal C example

# Compiler settings
CC = gcc
CFLAGS = -Wall -Wextra -O2 -std=c11
LDFLAGS = -lactivelog -lpthread -lm

# Paths
ACTIVELOG_DIR = ../../packages/activelog
INCLUDE_DIR = $(ACTIVELOG_DIR)/include
LIB_DIR = $(ACTIVELOG_DIR)/target/release

# Targets
TARGET = minimal-c
SOURCES = minimal.c
OBJECTS = $(SOURCES:.c=.o)

# Default target
all: $(TARGET)

# Build the library first (if not already built)
$(LIB_DIR)/libactivelog.a:
	@echo "Building ActiveLog library..."
	cd $(ACTIVELOG_DIR) && cargo build --release

# Build the example
$(TARGET): $(SOURCES) $(LIB_DIR)/libactivelog.a
	@echo "Building minimal C example..."
	$(CC) $(CFLAGS) -I$(INCLUDE_DIR) $(SOURCES) -L$(LIB_DIR) $(LDFLAGS) -o $(TARGET)
	@echo "Build complete! Run with: ./$(TARGET)"

# Clean build artifacts
clean:
	rm -f $(OBJECTS) $(TARGET)

# Run the example
run: $(TARGET)
	@echo "Running minimal C example..."
	@echo ""
	LD_LIBRARY_PATH=$(LIB_DIR) ./$(TARGET)

# Help
help:
	@echo "ActiveLog Minimal C Example"
	@echo ""
	@echo "Targets:"
	@echo "  make          - Build the example"
	@echo "  make run      - Build and run the example"
	@echo "  make clean    - Remove build artifacts"
	@echo "  make help     - Show this help message"

.PHONY: all clean run help
