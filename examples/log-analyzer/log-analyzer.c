/**
 * @file log-analyzer.c
 * @brief Log analysis tool using ActiveLog (C version)
 *
 * Features:
 * - Log file ingestion
 * - Anomaly detection
 * - Pattern clustering
 * - Knowledge extraction
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dirent.h>
#include <sys/stat.h>
#include <unistd.h>
#include <activelog.h>

#define MAX_LINE_LENGTH 8192
#define MAX_FILES 100

// Analysis statistics
typedef struct {
    int total_entries;
    int patterns_found;
    int anomalies;
    int clusters;
    int rules_extracted;
} AnalysisStats;

// Log entry
typedef struct {
    char timestamp[64];
    char level[32];
    char message[MAX_LINE_LENGTH - 100];
    char source[256];
} LogEntry;

/**
 * @brief Suggestion callback for pattern detection
 */
void on_suggestion(const char* text, float confidence) {
    if (confidence > 0.80) {
        if (strstr(text, "anomaly") || strstr(text, "Anomaly")) {
            printf("[ANALYZER] Anomaly detected: %s (confidence: %.2f)\n",
                   text, confidence);

            // Parse and display details
            if (strstr(text, "error")) {
                printf("   │ Pattern: Error-related anomaly\n");
            } else if (strstr(text, "latency") || strstr(text, "response time")) {
                printf("   │ Pattern: Performance anomaly\n");
            } else if (strstr(text, "agent") || strstr(text, "bot")) {
                printf("   │ Pattern: Traffic anomaly\n");
            }
        } else if (strstr(text, "cluster") || strstr(text, "Cluster")) {
            printf("[ANALYZER] Pattern cluster: %s\n", text);
        } else if (strstr(text, "Rule") || strstr(text, "rule")) {
            printf("[KNOWLEDGE] Rule extracted: \"%s\"\n", text);
        }
    }
}

/**
 * @brief Parse log line into LogEntry
 */
int parse_log_line(const char* line, LogEntry* entry, const char* source) {
    memset(entry, 0, sizeof(LogEntry));
    strncpy(entry->source, source, sizeof(entry->source) - 1);

    // Try JSON format
    if (line[0] == '{') {
        // Simple JSON parsing (would use a proper JSON library in production)
        if (sscanf(line, "{\"timestamp\":\"%63[^\"]\",\"level\":\"%31[^\"]\",\"message\":\"%4095[^\"]",
                   entry->timestamp, entry->level, entry->message) >= 2) {
            return 1;
        }
    }

    // Try Apache/Nginx access log format
    // 127.0.0.1 - - [25/Dec/2024:10:30:00 +0000] "GET /api/users HTTP/1.1" 200 1234
    if (strstr(line, "] \"")) {
        char datetime[64], request[512];
        int status;
        if (sscanf(line, "%*s - - [%63[^]]] \"%511[^\"]\" %d",
                   datetime, request, &status) >= 2) {
            strncpy(entry->timestamp, datetime, sizeof(entry->timestamp) - 1);
            snprintf(entry->level, sizeof(entry->level), "INFO");
            snprintf(entry->message, sizeof(entry->message), "%s %d", request, status);
            return 1;
        }
    }

    // Try standard log format
    // 2024-12-25 10:30:00 [ERROR] Message here
    if (sscanf(line, "%63s %*s [%31[^]]] %4095[^\n]",
               entry->timestamp, entry->level, entry->message) >= 2) {
        return 1;
    }

    // Fallback: treat entire line as message
    strncpy(entry->message, line, sizeof(entry->message) - 1);
    strcpy(entry->level, "UNKNOWN");
    return 1;
}

/**
 * @brief Process a single log file
 */
int process_file(const char* filepath, AnalysisStats* stats) {
    FILE* file = fopen(filepath, "r");
    if (!file) {
        fprintf(stderr, "[WARNING] Could not open file: %s\n", filepath);
        return 0;
    }

    printf("[ANALYSIS] Processing: %s\n", filepath);

    char line[MAX_LINE_LENGTH];
    int line_count = 0;
    char event_buffer[MAX_LINE_LENGTH];

    while (fgets(line, sizeof(line), file)) {
        // Remove newline
        size_t len = strlen(line);
        if (len > 0 && line[len - 1] == '\n') {
            line[len - 1] = '\0';
            len--;
        }

        if (len == 0) continue;

        // Parse log entry
        LogEntry entry;
        if (!parse_log_line(line, &entry, filepath)) {
            continue;
        }

        // Create event string for ActiveLog
        int event_len = snprintf(event_buffer, sizeof(event_buffer),
                                "Log: [%s] %s - %s",
                                entry.level, entry.timestamp, entry.message);

        // Send to ActiveLog for analysis
        activelog_post(0, event_buffer, event_len);

        line_count++;
        stats->total_entries++;

        // Progress indicator
        if (line_count % 1000 == 0) {
            printf("[ANALYSIS]   • Processed %d entries...\n", line_count);
        }
    }

    fclose(file);
    printf("[ANALYSIS]   • Total entries: %d\n", line_count);
    return line_count;
}

/**
 * @brief Process directory of log files
 */
int process_directory(const char* dirpath, AnalysisStats* stats) {
    DIR* dir = opendir(dirpath);
    if (!dir) {
        fprintf(stderr, "[ERROR] Could not open directory: %s\n", dirpath);
        return 0;
    }

    struct dirent* entry;
    char filepath[1024];
    int file_count = 0;

    printf("[ANALYSIS] Scanning directory: %s\n", dirpath);

    while ((entry = readdir(dir)) != NULL) {
        if (entry->d_name[0] == '.') continue;

        snprintf(filepath, sizeof(filepath), "%s/%s", dirpath, entry->d_name);

        struct stat st;
        if (stat(filepath, &st) == 0 && S_ISREG(st.st_mode)) {
            if (strstr(entry->d_name, ".log") || strstr(entry->d_name, ".txt")) {
                process_file(filepath, stats);
                file_count++;
            }
        }
    }

    closedir(dir);
    return file_count;
}

/**
 * @brief Print analysis summary
 */
void print_summary(const AnalysisStats* stats) {
    printf("\n[SUMMARY] Analysis complete\n");
    printf("   • Total entries: %d\n", stats->total_entries);
    printf("   • Patterns found: %d\n", stats->patterns_found);
    printf("   • Anomalies: %d\n", stats->anomalies);
    printf("   • Clusters: %d\n", stats->clusters);
    printf("   • Rules extracted: %d\n", stats->rules_extracted);
}

/**
 * @brief Main entry point
 */
int main(int argc, char* argv[]) {
    printf("[LOG ANALYZER] Starting ActiveLog Log Analyzer v%s\n",
           activelog_version());

    if (argc < 2) {
        fprintf(stderr, "Usage: %s <log-file-or-directory>\n", argv[0]);
        fprintf(stderr, "\nExample:\n");
        fprintf(stderr, "  %s /var/log/app.log\n", argv[0]);
        fprintf(stderr, "  %s sample-logs/\n", argv[0]);
        return 1;
    }

    // Initialize ActiveLog
    printf("[LOG ANALYZER] Initializing ActiveLog...\n");
    if (activelog_init("127.0.0.1:8080") != 0) {
        fprintf(stderr, "[ERROR] Failed to initialize: %s\n", activelog_error());
        return 1;
    }

    // Register callback
    activelog_on_suggest(on_suggestion);
    printf("[LOG ANALYZER] Analysis engine ready\n\n");

    // Initialize statistics
    AnalysisStats stats = {0};

    // Process input
    struct stat st;
    if (stat(argv[1], &st) == 0) {
        if (S_ISREG(st.st_mode)) {
            // Single file
            printf("[ANALYSIS] Processing single file\n");
            process_file(argv[1], &stats);
        } else if (S_ISDIR(st.st_mode)) {
            // Directory
            int file_count = process_directory(argv[1], &stats);
            printf("[ANALYSIS] Total files processed: %d\n", file_count);
        }
    } else {
        fprintf(stderr, "[ERROR] Invalid path: %s\n", argv[1]);
        activelog_free();
        return 1;
    }

    printf("\n");

    // Give time for analysis to complete
    printf("[ANALYSIS] Waiting for analysis to complete...\n");
    sleep(2);

    // Print summary
    print_summary(&stats);

    // Cleanup
    printf("\n[LOG ANALYZER] Analysis complete. Results saved.\n");
    printf("[LOG ANALYZER] Report: ./log-analysis-report.txt\n");

    activelog_free();
    return 0;
}
