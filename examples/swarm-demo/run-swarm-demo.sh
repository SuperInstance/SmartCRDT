#!/bin/bash
# @file run-swarm-demo.sh
# @brief Automated script to run 3-node swarm demo

set -e

echo "[SWARM DEMO] Starting 3-node ActiveLog swarm demo"
echo ""

# Check if binaries exist
if [ ! -f "./swarm-node" ]; then
    echo "[ERROR] swarm-node not found. Run 'make' first."
    exit 1
fi

# Cleanup function
cleanup() {
    echo ""
    echo "[SWARM DEMO] Stopping all nodes..."

    # Kill all background processes
    pkill -f "swarm-node" 2>/dev/null || true

    echo "[SWARM DEMO] Demo stopped"
}

# Trap Ctrl+C
trap cleanup EXIT INT

# Start Node 1 (Leader)
echo "[SWARM DEMO] Starting Node 1 (Leader) on port 8080..."
gnome-terminal -- bash -c "./swarm-node --node-id 1 --port 8080 --leader; read" 2>/dev/null \
    || xterm -e "./swarm-node --node-id 1 --port 8080 --leader" &

sleep 2

# Start Node 2 (Follower)
echo "[SWARM DEMO] Starting Node 2 (Follower) on port 8081..."
gnome-terminal -- bash -c "./swarm-node --node-id 2 --port 8081 --peer 127.0.0.1:8080; read" 2>/dev/null \
    || xterm -e "./swarm-node --node-id 2 --port 8081 --peer 127.0.0.1:8080" &

sleep 2

# Start Node 3 (Follower)
echo "[SWARM DEMO] Starting Node 3 (Follower) on port 8082..."
gnome-terminal -- bash -c "./swarm-node --node-id 3 --port 8082 --peer 127.0.0.1:8080; read" 2>/dev/null \
    || xterm -e "./swarm-node --node-id 3 --port 8082 --peer 127.0.0.1:8080" &

sleep 2

echo ""
echo "[SWARM DEMO] All nodes started!"
echo "[SWARM DEMO] Check each terminal window for output"
echo "[SWARM DEMO] Press Ctrl+C to stop all nodes"
echo ""

# Wait indefinitely
wait
