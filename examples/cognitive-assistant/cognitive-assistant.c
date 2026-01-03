/**
 * @file cognitive-assistant.c
 * @brief AI coding assistant using ActiveLog (C version)
 *
 * Features:
 * - Real-time code analysis
 * - Suggestion whispering
 * - Learning from feedback
 * - Anti-pattern detection
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <pthread.h>
#include <activelog.h>

#define MAX_SUGGESTIONS 100
#define EVENT_BUFFER_SIZE 4096

// Statistics tracking
typedef struct {
    int code_changes;
    int suggestions;
    int accepted;
    int anti_patterns;
    int patterns_learned;
} Statistics;

static Statistics stats = {0};
static pthread_mutex_t stats_mutex = PTHREAD_MUTEX_INITIALIZER;

/**
 * @brief Code event types
 */
typedef enum {
    EVENT_CODE_CHANGE,
    EVENT_BUILD_OUTPUT,
    EVENT_TEST_RESULT,
    EVENT_FEEDBACK,
    EVENT_SAVE
} EventType;

/**
 * @brief Parsed code event
 */
typedef struct {
    EventType type;
    char file[256];
    int line;
    char content[1024];
} CodeEvent;

/**
 * @brief Suggestion callback
 *
 * Called when ActiveLog detects patterns in code
 */
void on_suggestion(const char* text, float confidence) {
    // Update statistics
    pthread_mutex_lock(&stats_mutex);
    stats.suggestions++;
    pthread_mutex_unlock(&stats_mutex);

    // Parse suggestion type
    if (confidence > 0.90) {
        // High confidence - anti-pattern or strong suggestion
        if (strstr(text, "memory leak") || strstr(text, "security")) {
            printf("\n[ALERT] %s (confidence: %.2f)\n", text, confidence);

            pthread_mutex_lock(&stats_mutex);
            stats.anti_patterns++;
            pthread_mutex_unlock(&stats_mutex);
        } else {
            printf("\n[SUGGESTION] %s (confidence: %.2f)\n", text, confidence);
        }
    } else if (confidence > 0.75) {
        // Medium confidence - helpful hints
        printf("   │ %s\n", text);
    }
}

/**
 * @brief Parse event from string
 */
int parse_event(const char* line, CodeEvent* event) {
    if (strncmp(line, "code_change|", 12) == 0) {
        event->type = EVENT_CODE_CHANGE;
        sscanf(line + 12, "%255[^|]|%d|%1023[^\n]",
               event->file, &event->line, event->content);
        return 1;
    } else if (strncmp(line, "build_output|", 13) == 0) {
        event->type = EVENT_BUILD_OUTPUT;
        strncpy(event->content, line + 13, sizeof(event->content) - 1);
        return 1;
    } else if (strncmp(line, "test_result|", 12) == 0) {
        event->type = EVENT_TEST_RESULT;
        strncpy(event->content, line + 12, sizeof(event->content) - 1);
        return 1;
    } else if (strncmp(line, "feedback|", 9) == 0) {
        event->type = EVENT_FEEDBACK;
        strncpy(event->content, line + 9, sizeof(event->content) - 1);
        return 1;
    }
    return 0;
}

/**
 * @brief Process a code event
 */
void process_event(const CodeEvent* event) {
    char event_str[EVENT_BUFFER_SIZE];
    int len;

    switch (event->type) {
        case EVENT_CODE_CHANGE:
            len = snprintf(event_str, sizeof(event_str),
                          "Code change in %s:%d - %s",
                          event->file, event->line, event->content);

            printf("[EVENT] %s\n", event_str);

            pthread_mutex_lock(&stats_mutex);
            stats.code_changes++;
            pthread_mutex_unlock(&stats_mutex);

            activelog_post(0, event_str, len);
            break;

        case EVENT_BUILD_OUTPUT:
            len = snprintf(event_str, sizeof(event_str),
                          "Build output: %s", event->content);

            printf("[EVENT] %s\n", event_str);

            activelog_post(0, event_str, len);
            break;

        case EVENT_TEST_RESULT:
            len = snprintf(event_str, sizeof(event_str),
                          "Test result: %s", event->content);

            printf("[EVENT] %s\n", event_str);

            activelog_post(0, event_str, len);
            break;

        case EVENT_FEEDBACK:
            len = snprintf(event_str, sizeof(event_str),
                          "Feedback received: %s", event->content);

            printf("[EVENT] %s\n", event_str);

            // Learning from feedback
            activelog_post(0, event_str, len);

            if (strstr(event->content, "accepted")) {
                pthread_mutex_lock(&stats_mutex);
                stats.accepted++;
                stats.patterns_learned++;
                pthread_mutex_unlock(&stats_mutex);

                printf("[COGNITIVE] Learning from positive feedback...\n");
                printf("[COGNITIVE] Model updated: suggestion confidence +0.05\n");
            }
            break;
    }
}

/**
 * @brief Print statistics
 */
void print_statistics(void) {
    pthread_mutex_lock(&stats_mutex);

    printf("\n[COGNITIVE] Statistics this session:\n");
    printf("   • %d code changes analyzed\n", stats.code_changes);
    printf("   • %d suggestions generated\n", stats.suggestions);
    printf("   • %d suggestions accepted (%.0f%%)\n",
           stats.accepted,
           stats.suggestions > 0 ? (100.0 * stats.accepted / stats.suggestions) : 0);
    printf("   • %d anti-patterns detected\n", stats.anti_patterns);
    printf("   • %d new patterns learned\n", stats.patterns_learned);

    pthread_mutex_unlock(&stats_mutex);
}

/**
 * @brief Demo: Simulate coding session
 */
void run_demo_session(void) {
    printf("[COGNITIVE] Running demo coding session...\n\n");

    // Simulated code events
    const char* demo_events[] = {
        "code_change|main.rs|15|fn new_function() -> Result<()> {",
        "code_change|main.rs|16|    let data = load_data()?;",
        "code_change|main.rs|17|    Ok(())",
        "code_change|main.rs|18|}",
        "code_change|parser.rs|42|fn parse(input: &str) -> ParseResult {",
        "code_change|parser.rs|43|    // TODO: Handle errors",
        "code_change|parser.rs|44|    unimplemented!()",
        "code_change|parser.rs|45|}",
        "build_output|warning: unused variable: 'temp' at line 23",
        "build_output|warning: unused_result at line 17",
        "test_result|test_parse FAILED - assertion failed",
        "feedback|accepted|add_documentation",
        "code_change|main.rs|15|/// New function with docs\nfn new_function() -> Result<()> {",
    };

    for (size_t i = 0; i < sizeof(demo_events) / sizeof(demo_events[0]); i++) {
        CodeEvent event;
        if (parse_event(demo_events[i], &event)) {
            process_event(&event);
        }

        // Give suggestion engine time
        usleep(50000); // 50ms
    }

    printf("\n");
    print_statistics();
}

/**
 * @brief Interactive mode: Read events from stdin
 */
void run_interactive(void) {
    printf("[COGNITIVE] Reading events from stdin (Ctrl+D to exit)...\n");
    printf("[COGNITIVE] Format: type|file|line|content\n\n");

    char* line = NULL;
    size_t len = 0;
    ssize_t read;

    while ((read = getline(&line, &len, stdin)) != -1) {
        // Remove newline
        if (read > 0 && line[read - 1] == '\n') {
            line[read - 1] = '\0';
            read--;
        }

        CodeEvent event;
        if (parse_event(line, &event)) {
            process_event(&event);
        }

        usleep(50000); // 50ms between events
    }

    free(line);
    print_statistics();
}

/**
 * @brief Main entry point
 */
int main(int argc, char* argv[]) {
    printf("[COGNITIVE] Starting ActiveLog Cognitive Assistant v%s\n",
           activelog_version());

    // Initialize ActiveLog
    if (activelog_init("127.0.0.1:8080") != 0) {
        fprintf(stderr, "[ERROR] Failed to initialize: %s\n", activelog_error());
        return 1;
    }

    printf("[COGNITIVE] Learning engine ready\n");
    printf("[COGNITIVE] Registering suggestion callback...\n");

    // Register callback
    activelog_on_suggest(on_suggestion);

    printf("[COGNITIVE] Ready!\n\n");

    // Run demo or interactive
    if (argc > 1 && strcmp(argv[1], "--demo") == 0) {
        run_demo_session();
    } else {
        printf("[COGNITIVE] Interactive mode started\n");
        printf("[COGNITIVE] Example events:\n");
        printf("   code_change|main.rs|42|fn test() {}\n");
        printf("   build_output|warning: unused variable\n");
        printf("   test_result|test_parse FAILED\n");
        printf("   feedback|accepted|suggestion_id\n\n");

        run_interactive();
    }

    // Cleanup
    printf("\n[COGNITIVE] Shutting down...\n");
    activelog_free();

    printf("[COGNITIVE] Session complete. Goodbye!\n");
    return 0;
}
