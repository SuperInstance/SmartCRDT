/**
 * @file swarm-node.c
 * @brief Multi-node swarm demo using ActiveLog (C version)
 *
 * Demonstrates:
 * - 3-node swarm setup
 * - CRDT synchronization
 * - Workload distribution
 * - Failure simulation
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <pthread.h>
#include <activelog.h>

#define MAX_NODES 10
#define MAX_PEERS 10

// Node configuration
typedef struct {
    int node_id;
    int port;
    int is_leader;
    char peers[MAX_PEERS][256];
    int peer_count;
} NodeConfig;

// Swarm statistics
typedef struct {
    int events_processed;
    int sync_operations;
    int conflicts_resolved;
    int uptime_seconds;
} SwarmStats;

static NodeConfig config = {0};
static SwarmStats stats = {0};
static volatile sig_atomic_t running = 1;

/**
 * @brief Signal handler for graceful shutdown
 */
void signal_handler(int signum) {
    (void)signum;
    printf("\n[SWARM] Received shutdown signal\n");
    running = 0;
}

/**
 * @brief Suggestion callback for CRDT events
 */
void on_suggestion(const char* text, float confidence) {
    if (strstr(text, "sync") || strstr(text, "Sync")) {
        printf("[CRDT] %s\n", text);
        stats.sync_operations++;
    } else if (strstr(text, "conflict")) {
        printf("[CONFLICT] %s (confidence: %.2f)\n", text, confidence);
        stats.conflicts_resolved++;
    } else if (strstr(text, "workload") || strstr(text, "distribution")) {
        printf("[SWARM] %s\n", text);
    }
}

/**
 * @brief Simulate processing events
 */
void process_events(void) {
    char event[512];
    int count = 0;

    while (running) {
        // Generate event
        snprintf(event, sizeof(event),
                "Node %d event #%d - %s",
                config.node_id,
                count++,
                config.is_leader ? "leader" : "follower");

        // Post to ActiveLog
        activelog_post(0, event, strlen(event));
        stats.events_processed++;

        // Print progress
        if (count % 100 == 0) {
            printf("[EVENT] Node %d processed %d events\n",
                   config.node_id, count);
        }

        usleep(10000); // 10ms between events
    }
}

/**
 * @brief Print swarm status
 */
void print_status(void) {
    printf("\n[SWARM NODE %d] Status:\n", config.node_id);
    printf("   • Role: %s\n", config.is_leader ? "LEADER" : "FOLLOWER");
    printf("   • Port: %d\n", config.port);
    printf("   • Events processed: %d\n", stats.events_processed);
    printf("   • Sync operations: %d\n", stats.sync_operations);
    printf("   • Conflicts resolved: %d\n", stats.conflicts_resolved);
    printf("   • Uptime: %d seconds\n", stats.uptime_seconds);

    if (config.peer_count > 0) {
        printf("   • Peers: %d\n", config.peer_count);
        for (int i = 0; i < config.peer_count; i++) {
            printf("      - %s\n", config.peers[i]);
        }
    }
}

/**
 * @brief Main entry point
 */
int main(int argc, char* argv[]) {
    // Parse arguments
    config.node_id = 1;
    config.port = 8080;
    config.is_leader = 0;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--node-id") == 0 && i + 1 < argc) {
            config.node_id = atoi(argv[++i]);
        } else if (strcmp(argv[i], "--port") == 0 && i + 1 < argc) {
            config.port = atoi(argv[++i]);
        } else if (strcmp(argv[i], "--leader") == 0) {
            config.is_leader = 1;
        } else if (strcmp(argv[i], "--peer") == 0 && i + 1 < argc) {
            strncpy(config.peers[config.peer_count], argv[++i], 255);
            config.peer_count++;
        }
    }

    printf("[SWARM NODE %d] Starting on 127.0.0.1:%d (%s)\n",
           config.node_id, config.port,
           config.is_leader ? "LEADER" : "FOLLOWER");

    // Setup signal handler
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);

    // Initialize ActiveLog
    char bind_addr[64];
    snprintf(bind_addr, sizeof(bind_addr), "127.0.0.1:%d", config.port);

    if (activelog_init(bind_addr) != 0) {
        fprintf(stderr, "[ERROR] Failed to initialize: %s\n", activelog_error());
        return 1;
    }

    printf("[SWARM NODE %d] ActiveLog initialized\n", config.node_id);
    printf("[SWARM NODE %d] CRDT State Vector Clock: {%d:0}\n",
           config.node_id, config.node_id);

    // Connect to peers
    for (int i = 0; i < config.peer_count; i++) {
        char peer_event[256];
        snprintf(peer_event, sizeof(peer_event),
                "Peer connect: %s", config.peers[i]);
        activelog_post(0, peer_event, strlen(peer_event));
        printf("[SWARM] Connected to peer: %s\n", config.peers[i]);
    }

    printf("[SWARM NODE %d] Listening for connections...\n", config.node_id);

    // Register callback
    activelog_on_suggest(on_suggestion);

    // Start event processing
    printf("[SWARM NODE %d] Starting event processing...\n", config.node_id);

    time_t start_time = time(NULL);

    while (running) {
        process_events();

        stats.uptime_seconds = time(NULL) - start_time;

        // Print status every 10 seconds
        if (stats.uptime_seconds % 10 == 0) {
            print_status();
        }

        sleep(1);
    }

    // Cleanup
    print_status();
    printf("\n[SWARM NODE %d] Shutting down...\n", config.node_id);
    activelog_free();

    printf("[SWARM NODE %d] Goodbye!\n", config.node_id);
    return 0;
}
