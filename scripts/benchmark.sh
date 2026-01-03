#!/bin/bash
# smartCRDT Benchmark Automation Script
#
# This script runs comprehensive benchmarks and generates reports
# for the smartCRDT project. Supports multiple hardware platforms.
#
# Usage:
#   ./scripts/benchmark.sh [OPTIONS]
#
# Options:
#   --all               Run all benchmarks
#   --temporal          Run temporal ring benchmarks
#   --resonance         Run resonance benchmarks
#   --archival          Run archival benchmarks
#   --swarm             Run swarm benchmarks
#   --modules           Run module benchmarks
#   --e2e               Run end-to-end benchmarks
#   --output DIR        Output directory for results (default: ./bench-results)
#   --compare DIR1 DIR2 Compare two benchmark result directories
#   --baseline          Generate baseline results
#   --format FORMAT     Output format: text, json, html (default: text)
#   --iterations N      Number of iterations (default: 100)
#   --warmup N          Warmup iterations (default: 3)
#   --help              Show this help message

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
OUTPUT_DIR="./bench-results"
ITERATIONS=100
WARMUP=3
FORMAT="text"
RUN_ALL=false
RUN_TEMPORAL=false
RUN_RESONANCE=false
RUN_ARCHIVAL=false
RUN_SWARM=false
RUN_MODULES=false
RUN_E2E=false
COMPARE=false
COMPARE_DIR1=""
COMPARE_DIR2=""
BASELINE=false

# Hardware detection
detect_hardware() {
    echo -e "${BLUE}Detecting hardware...${NC}"

    if [ -f /proc/cpuinfo ]; then
        CPU_MODEL=$(grep -m1 "model name" /proc/cpuinfo | cut -d: -f2 | xargs)
        CPU_CORES=$(nproc)
    else
        CPU_MODEL=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Unknown")
        CPU_CORES=$(sysctl -n hw.ncpu 2>/dev/null || echo "Unknown")
    fi

    # Detect platform
    if hostname | grep -qi "raspberrypi\|pi5"; then
        PLATFORM="Raspberry Pi 5"
    elif hostname | grep -qi "jetson\|tegra"; then
        PLATFORM="NVIDIA Jetson"
    elif command -v nvidia-smi &> /dev/null; then
        PLATFORM="Desktop with NVIDIA GPU"
    else
        PLATFORM="Unknown/Other"
    fi

    echo -e "${GREEN}Platform:${NC} $PLATFORM"
    echo -e "${GREEN}CPU:${NC} $CPU_MODEL ($CPU_CORES cores)"

    # Save hardware info
    cat > "$OUTPUT_DIR/hardware-info.txt" <<EOF
Platform: $PLATFORM
CPU Model: $CPU_MODEL
CPU Cores: $CPU_CORES
Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Hostname: $(hostname)
EOF
}

# Check dependencies
check_dependencies() {
    echo -e "${BLUE}Checking dependencies...${NC}"

    # Check for cargo
    if ! command -v cargo &> /dev/null; then
        echo -e "${RED}Error: cargo not found. Please install Rust.${NC}"
        exit 1
    fi

    # Check for criterion
    if ! cargo install --list | grep -q "criterion"; then
        echo -e "${YELLOW}Installing cargo-criterion...${NC}"
        cargo install cargo-criterion
    fi

    echo -e "${GREEN}All dependencies satisfied.${NC}"
}

# Create output directory
setup_output_dir() {
    mkdir -p "$OUTPUT_DIR"
    mkdir -p "$OUTPUT_DIR/temporal"
    mkdir -p "$OUTPUT_DIR/resonance"
    mkdir -p "$OUTPUT_DIR/archival"
    mkdir -p "$OUTPUT_DIR/swarm"
    mkdir -p "$OUTPUT_DIR/modules"
    mkdir -p "$OUTPUT_DIR/e2e"
    mkdir -p "$OUTPUT_DIR/comparison"
}

# Run temporal benchmarks
run_temporal_benchmarks() {
    echo -e "${BLUE}Running temporal ring benchmarks...${NC}"
    cargo bench --bench temporal_ring \
        -- --measurement-time 10 \
           --sample-size $ITERATIONS \
           --warm-up-time $WARMUP \
           --output-format bencher | tee "$OUTPUT_DIR/temporal/results.txt"

    # Copy Criterion output if it exists
    if [ -d "target/criterion/temporal-ring" ]; then
        cp -r target/criterion/temporal-ring/* "$OUTPUT_DIR/temporal/" 2>/dev/null || true
    fi

    echo -e "${GREEN}Temporal benchmarks completed.${NC}"
}

# Run resonance benchmarks
run_resonance_benchmarks() {
    echo -e "${BLUE}Running resonance benchmarks...${NC}"
    cargo bench --bench resonance \
        -- --measurement-time 10 \
           --sample-size $ITERATIONS \
           --warm-up-time $WARMUP \
           --output-format bencher | tee "$OUTPUT_DIR/resonance/results.txt"

    if [ -d "target/criterion/resonance" ]; then
        cp -r target/criterion/resonance/* "$OUTPUT_DIR/resonance/" 2>/dev/null || true
    fi

    echo -e "${GREEN}Resonance benchmarks completed.${NC}"
}

# Run archival benchmarks
run_archival_benchmarks() {
    echo -e "${BLUE}Running archival benchmarks...${NC}"
    cargo bench --bench archival \
        -- --measurement-time 15 \
           --sample-size $ITERATIONS \
           --warm-up-time $WARMUP \
           --output-format bencher | tee "$OUTPUT_DIR/archival/results.txt"

    if [ -d "target/criterion/archival" ]; then
        cp -r target/criterion/archival/* "$OUTPUT_DIR/archival/" 2>/dev/null || true
    fi

    echo -e "${GREEN}Archival benchmarks completed.${NC}"
}

# Run swarm benchmarks
run_swarm_benchmarks() {
    echo -e "${BLUE}Running swarm benchmarks...${NC}"
    cargo bench --bench swarm \
        -- --measurement-time 10 \
           --sample-size $ITERATIONS \
           --warm-up-time $WARMUP \
           --output-format bencher | tee "$OUTPUT_DIR/swarm/results.txt"

    if [ -d "target/criterion/swarm" ]; then
        cp -r target/criterion/swarm/* "$OUTPUT_DIR/swarm/" 2>/dev/null || true
    fi

    echo -e "${GREEN}Swarm benchmarks completed.${NC}"
}

# Run module benchmarks
run_module_benchmarks() {
    echo -e "${BLUE}Running module benchmarks...${NC}"
    cargo bench --bench modules \
        -- --measurement-time 10 \
           --sample-size $ITERATIONS \
           --warm-up-time $WARMUP \
           --output-format bencher | tee "$OUTPUT_DIR/modules/results.txt"

    if [ -d "target/criterion/modules" ]; then
        cp -r target/criterion/modules/* "$OUTPUT_DIR/modules/" 2>/dev/null || true
    fi

    echo -e "${GREEN}Module benchmarks completed.${NC}"
}

# Run end-to-end benchmarks
run_e2e_benchmarks() {
    echo -e "${BLUE}Running end-to-end benchmarks...${NC}"
    cargo bench --bench e2e \
        -- --measurement-time 15 \
           --sample-size $ITERATIONS \
           --warm-up-time $WARMUP \
           --output-format bencher | tee "$OUTPUT_DIR/e2e/results.txt"

    if [ -d "target/criterion/e2e" ]; then
        cp -r target/criterion/e2e/* "$OUTPUT_DIR/e2e/" 2>/dev/null || true
    fi

    echo -e "${GREEN}End-to-end benchmarks completed.${NC}"
}

# Generate summary report
generate_summary() {
    echo -e "${BLUE}Generating summary report...${NC}"

    cat > "$OUTPUT_DIR/summary.md" <<EOF
# smartCRDT Benchmark Results

**Generated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Platform:** $PLATFORM
**Iterations:** $ITERATIONS

## Hardware Information

$(cat "$OUTPUT_DIR/hardware-info.txt")

## Results Summary

### Temporal Ring
$(grep -E "temporal_ring" "$OUTPUT_DIR/temporal/results.txt" 2>/dev/null || echo "No results")

### Resonance
$(grep -E "resonance" "$OUTPUT_DIR/resonance/results.txt" 2>/dev/null || echo "No results")

### Archival
$(grep -E "archival" "$OUTPUT_DIR/archival/results.txt" 2>/dev/null || echo "No results")

### Swarm
$(grep -E "swarm" "$OUTPUT_DIR/swarm/results.txt" 2>/dev/null || echo "No results")

### Modules
$(grep -E "modules" "$OUTPUT_DIR/modules/results.txt" 2>/dev/null || echo "No results")

### End-to-End
$(grep -E "e2e" "$OUTPUT_DIR/e2e/results.txt" 2>/dev/null || echo "No results")

EOF

    echo -e "${GREEN}Summary report generated: $OUTPUT_DIR/summary.md${NC}"
}

# Compare two benchmark runs
compare_runs() {
    echo -e "${BLUE}Comparing benchmark runs...${NC}"
    echo "Run 1: $COMPARE_DIR1"
    echo "Run 2: $COMPARE_DIR2"

    # Build comparison tool if needed
    if [ ! -f "target/release/compare" ]; then
        echo "Building comparison tool..."
        cargo build --release --bin compare 2>/dev/null || true
    fi

    # Run comparison
    if [ -f "target/release/compare" ]; then
        ./target/release/compare "$COMPARE_DIR1" "$COMPARE_DIR2" "$OUTPUT_DIR/comparison"
    else
        echo -e "${YELLOW}Comparison tool not built. Using fallback comparison...${NC}"
        # Simple text comparison
        diff -u "$COMPARE_DIR1/summary.md" "$COMPARE_DIR2/summary.md" > "$OUTPUT_DIR/comparison/diff.txt" || true
    fi

    echo -e "${GREEN}Comparison completed.${NC}"
}

# Generate baseline results
generate_baseline() {
    echo -e "${YELLOW}Generating baseline results...${NC}"
    echo "This will take several minutes..."

    detect_hardware
    setup_output_dir

    run_temporal_benchmarks
    run_resonance_benchmarks
    run_archival_benchmarks
    run_swarm_benchmarks
    run_module_benchmarks
    run_e2e_benchmarks

    generate_summary

    # Save as baseline
    cp -r "$OUTPUT_DIR" "${OUTPUT_DIR}-baseline"

    echo -e "${GREEN}Baseline results saved to: ${OUTPUT_DIR}-baseline${NC}"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            RUN_ALL=true
            shift
            ;;
        --temporal)
            RUN_TEMPORAL=true
            shift
            ;;
        --resonance)
            RUN_RESONANCE=true
            shift
            ;;
        --archival)
            RUN_ARCHIVAL=true
            shift
            ;;
        --swarm)
            RUN_SWARM=true
            shift
            ;;
        --modules)
            RUN_MODULES=true
            shift
            ;;
        --e2e)
            RUN_E2E=true
            shift
            ;;
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --compare)
            COMPARE=true
            COMPARE_DIR1="$2"
            COMPARE_DIR2="$3"
            shift 3
            ;;
        --baseline)
            BASELINE=true
            shift
            ;;
        --format)
            FORMAT="$2"
            shift 2
            ;;
        --iterations)
            ITERATIONS="$2"
            shift 2
            ;;
        --warmup)
            WARMUP="$2"
            shift 2
            ;;
        --help)
            echo "smartCRDT Benchmark Automation Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --all               Run all benchmarks"
            echo "  --temporal          Run temporal ring benchmarks"
            echo "  --resonance         Run resonance benchmarks"
            echo "  --archival          Run archival benchmarks"
            echo "  --swarm             Run swarm benchmarks"
            echo "  --modules           Run module benchmarks"
            echo "  --e2e               Run end-to-end benchmarks"
            echo "  --output DIR        Output directory for results (default: ./bench-results)"
            echo "  --compare DIR1 DIR2 Compare two benchmark result directories"
            echo "  --baseline          Generate baseline results"
            echo "  --format FORMAT     Output format: text, json, html (default: text)"
            echo "  --iterations N      Number of iterations (default: 100)"
            echo "  --warmup N          Warmup iterations (default: 3)"
            echo "  --help              Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Main execution
main() {
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║          smartCRDT Benchmark Automation Script            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    if [ "$BASELINE" = true ]; then
        check_dependencies
        generate_baseline
        exit 0
    fi

    if [ "$COMPARE" = true ]; then
        setup_output_dir
        compare_runs
        exit 0
    fi

    # If no specific benchmarks selected, run all
    if [ "$RUN_ALL" = false ] && [ "$RUN_TEMPORAL" = false ] && \
       [ "$RUN_RESONANCE" = false ] && [ "$RUN_ARCHIVAL" = false ] && \
       [ "$RUN_SWARM" = false ] && [ "$RUN_MODULES" = false ] && \
       [ "$RUN_E2E" = false ]; then
        RUN_ALL=true
    fi

    check_dependencies
    detect_hardware
    setup_output_dir

    if [ "$RUN_ALL" = true ] || [ "$RUN_TEMPORAL" = true ]; then
        run_temporal_benchmarks
    fi

    if [ "$RUN_ALL" = true ] || [ "$RUN_RESONANCE" = true ]; then
        run_resonance_benchmarks
    fi

    if [ "$RUN_ALL" = true ] || [ "$RUN_ARCHIVAL" = true ]; then
        run_archival_benchmarks
    fi

    if [ "$RUN_ALL" = true ] || [ "$RUN_SWARM" = true ]; then
        run_swarm_benchmarks
    fi

    if [ "$RUN_ALL" = true ] || [ "$RUN_MODULES" = true ]; then
        run_module_benchmarks
    fi

    if [ "$RUN_ALL" = true ] || [ "$RUN_E2E" = true ]; then
        run_e2e_benchmarks
    fi

    generate_summary

    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║              Benchmarks completed successfully!            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo "Results saved to: $OUTPUT_DIR"
    echo "Summary: $OUTPUT_DIR/summary.md"
}

main
