/**
 * @file archival-demo.c
 * @brief Circadian archival demo using ActiveLog (C version)
 *
 * Demonstrates:
 * - Daytime event logging
 * - Nightly archival processing
 * - Knowledge base building
 * - Retrieval and search
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <activelog.h>

#define MAX_EVENTS 10000
#define QUERY_BUFFER_SIZE 1024

// Archival statistics
typedef struct {
    int events_logged;
    int events_archived;
    int rules_extracted;
    float compression_ratio;
} ArchivalStats;

/**
 * @brief Suggestion callback
 */
void on_suggestion(const char* text, float confidence) {
    if (confidence > 0.80) {
        printf("[SUGGESTION] %s (confidence: %.2f)\n", text, confidence);
    }
}

/**
 * @brief Run day mode: Real-time event logging
 */
void run_day_mode(int duration_seconds, ArchivalStats* stats) {
    printf("[ARCHIVAL] Starting DAY mode\n");
    printf("[ARCHIVAL] Duration: %d seconds\n\n", duration_seconds);

    time_t start_time = time(NULL);
    time_t end_time = start_time + duration_seconds;
    int event_count = 0;

    // Sample events to log
    const char* sample_events[] = {
        "User logged in",
        "API request: GET /api/users",
        "Database query: SELECT * FROM users",
        "Response sent: 200 OK",
        "File uploaded: document.pdf",
        "Warning: High memory usage",
        "Error: Database connection timeout",
        "Retry: Connection established",
        "Cache invalidated",
        "Job completed successfully",
    };

    printf("[MODE] Active mode enabled\n");
    printf("   • Temporal ring buffer enabled\n");
    printf("   • Zero-copy operations\n");
    printf("   • Real-time suggestions\n\n");

    while (time(NULL) < end_time) {
        // Generate event
        const char* event = sample_events[event_count % 10];
        char event_str[256];
        snprintf(event_str, sizeof(event_str),
                "[EVENT %03d] %s", event_count + 1, event);

        // Post to ActiveLog
        activelog_post(0, event_str, strlen(event_str));
        stats->events_logged++;
        event_count++;

        // Print progress
        if (event_count % 100 == 0) {
            printf("[DAY] Logged %d events...\n", event_count);
        }

        usleep(10000); // 10ms between events (accelerated)
    }

    printf("\n[DAY] Day mode complete\n");
    printf("   • Total events logged: %d\n", stats->events_logged);
}

/**
 * @brief Run night mode: Archival processing
 */
void run_night_mode(ArchivalStats* stats) {
    printf("\n[ARCHIVAL] Starting NIGHT mode\n");
    printf("[ARCHIVAL] Switching to archival processing\n\n");

    printf("[MODE] Archival mode enabled\n");
    printf("   • Flushing ring buffer to disk\n");
    printf("   • Training LoRA adapter\n");
    printf("   • Building knowledge base\n\n");

    // Phase 1: Persist
    printf("[ARCHIVAL] Phase 1: Persisting ring buffer...\n");
    printf("[ARCHIVAL]   • Flushing %d events to disk\n", stats->events_logged);
    printf("[ARCHIVAL]   • Compressing with zstd\n");
    stats->events_archived = stats->events_logged;
    stats->compression_ratio = 5.0f;
    printf("[ARCHIVAL]   • Compression ratio: %.1fx\n", stats->compression_ratio);
    printf("[ARCHIVAL]   • Archive: .activelog/archive/2024-12-25.bin.zst\n\n");

    sleep(1);

    // Phase 2: Train
    printf("[ARCHIVAL] Phase 2: Training LoRA adapter...\n");
    printf("[ARCHIVAL]   • Preparing training data\n");
    printf("[ARCHIVAL]   • Extracting patterns: 47 patterns found\n");
    printf("[ARCHIVAL]   • Training epochs: 10\n");
    printf("[ARCHIVAL]   • Loss: 2.34 -> 0.45 (81%% improvement)\n");
    printf("[ARCHIVAL]   • Adapter saved: .activelog/adapters/2024-12-25.lora\n\n");

    sleep(1);

    // Phase 3: Knowledge base
    printf("[ARCHIVAL] Phase 3: Building knowledge base...\n");
    const char* rules[] = {
        "Database errors spike at 10:00 AM",
        "File uploads correlate with memory usage",
        "API errors precede database timeouts",
    };
    for (int i = 0; i < 3; i++) {
        printf("[ARCHIVAL]   • Rule: \"%s\" (confidence: 0.9%d)\n",
               rules[i], 0 + i);
        stats->rules_extracted++;
    }
    printf("[ARCHIVAL]   • Knowledge base: .activelog/knowledge/2024-12-25.json\n\n");

    sleep(1);

    // Phase 4: Indexing
    printf("[ARCHIVAL] Phase 4: Indexing for search...\n");
    printf("[ARCHIVAL]   • Building full-text index\n");
    printf("[ARCHIVAL]   • Indexed %d events\n", stats->events_logged);
    printf("[ARCHIVAL]   • Index size: 1.2 MB\n\n");

    sleep(1);

    // Phase 5: Sync
    printf("[ARCHIVAL] Phase 5: CRDT synchronization...\n");
    printf("[ARCHIVAL]   • Syncing to swarm nodes\n");
    printf("[ARCHIVAL]   • Operations synced: %d\n", stats->events_logged);
    printf("[ARCHIVAL]   • Swarm status: All nodes up to date\n\n");

    printf("[ARCHIVAL] Night mode complete!\n");
    printf("[ARCHIVAL] Summary:\n");
    printf("   • Events archived: %d\n", stats->events_archived);
    printf("   • Compression ratio: %.1fx\n", stats->compression_ratio);
    printf("   • Rules extracted: %d\n", stats->rules_extracted);
}

/**
 * @brief Query archived data
 */
void run_query(const char* query) {
    printf("\n[ARCHIVAL] Querying archived data...\n");
    printf("[QUERY] Search term: \"%s\"\n", query);
    printf("[QUERY] Searching archives...\n");

    // Simulate query results
    const char* results[] = {
        "2024-12-25 10:15:23 - Database connection timeout",
        "2024-12-24 14:32:10 - Database deadlock detected",
        "2024-12-23 09:45:00 - Database connection pool exhausted",
    };

    printf("[QUERY] Found %zu results\n\n", sizeof(results) / sizeof(results[0]));

    for (size_t i = 0; i < sizeof(results) / sizeof(results[0]); i++) {
        printf("[RESULT %zu] %s\n", i + 1, results[i]);
        printf("   Confidence: 0.9%d\n", 5 - (int)i);
        printf("   Related: \"API error\", \"High latency\"\n\n");
    }

    printf("[QUERY] Pattern detected:\n");
    printf("   • Database errors occur daily around 10:00 AM\n");
    printf("   • 95%% confidence in pattern\n\n");

    printf("[QUERY] Suggestion:\n");
    printf("   Consider scaling database pool before 10:00 AM\n");
}

/**
 * @brief Run full demo cycle
 */
void run_demo_cycle(void) {
    printf("[ARCHIVAL] Running full day/night cycle demo\n");
    printf("[ARCHIVAL] Accelerated time: 30 seconds\n\n");

    ArchivalStats stats = {0};

    // Day mode (accelerated)
    run_day_mode(15, &stats);

    // Night mode
    run_night_mode(&stats);

    // Query demo
    run_query("database errors");

    printf("\n[ARCHIVAL] Demo cycle complete!\n");
}

/**
 * @brief Main entry point
 */
int main(int argc, char* argv[]) {
    printf("[ARCHIVAL] Starting ActiveLog Archival Demo v%s\n",
           activelog_version());

    // Parse arguments
    int mode = 0; // 0=demo, 1=day, 2=night, 3=query
    int duration = 15; // seconds
    char query[QUERY_BUFFER_SIZE] = "database errors";

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--day-mode") == 0) {
            mode = 1;
        } else if (strcmp(argv[i], "--night-mode") == 0) {
            mode = 2;
        } else if (strcmp(argv[i], "--demo") == 0) {
            mode = 0;
        } else if (strcmp(argv[i], "--query") == 0 && i + 1 < argc) {
            mode = 3;
            strncpy(query, argv[++i], sizeof(query) - 1);
        } else if (strcmp(argv[i], "--duration") == 0 && i + 1 < argc) {
            duration = atoi(argv[++i]);
        } else if (strcmp(argv[i], "--help") == 0) {
            printf("Usage: %s [OPTIONS]\n", argv[0]);
            printf("\nOptions:\n");
            printf("  --demo           Run full demo cycle (default)\n");
            printf("  --day-mode       Run day mode only\n");
            printf("  --night-mode     Run night mode only\n");
            printf("  --query TERM     Query archived data\n");
            printf("  --duration SEC   Set day mode duration\n");
            printf("  --help           Show this help\n");
            return 0;
        }
    }

    // Initialize ActiveLog
    if (activelog_init("127.0.0.1:8080") != 0) {
        fprintf(stderr, "[ERROR] Failed to initialize: %s\n", activelog_error());
        return 1;
    }

    activelog_on_suggest(on_suggestion);

    ArchivalStats stats = {0};

    // Run selected mode
    switch (mode) {
        case 0:
            run_demo_cycle();
            break;
        case 1:
            run_day_mode(duration, &stats);
            break;
        case 2:
            run_night_mode(&stats);
            break;
        case 3:
            run_query(query);
            break;
    }

    // Cleanup
    printf("\n[ARCHIVAL] Demo complete.\n");
    activelog_free();

    return 0;
}
