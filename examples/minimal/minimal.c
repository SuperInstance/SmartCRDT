/**
 * @file minimal.c
 * @brief Minimal ActiveLog example in C (~50 lines)
 *
 * Demonstrates the complete ActiveLog workflow:
 * 1. Initialize library
 * 2. Register suggestion callback
 * 3. Post events
 * 4. Shutdown gracefully
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <activelog.h>

/**
 * @brief Callback function for real-time suggestions
 *
 * Called by ActiveLog when patterns are detected in posted events.
 * @param text Suggestion text (UTF-8)
 * @param confidence Confidence score (0.0 to 1.0)
 */
void on_suggestion(const char* text, float confidence) {
    // Only show high-confidence suggestions
    if (confidence > 0.8f) {
        printf("[SUGGESTION] Pattern detected: %s (confidence: %.2f)\n",
               text, confidence);
    }
}

/**
 * @brief Main demonstration
 */
int main(void) {
    // Step 1: Initialize ActiveLog
    // - Auto-detects hardware (AVX2, AVX512, NEON)
    // - Downloads models on first run (cached locally)
    // - Binds to network address
    printf("[INFO] ActiveLog %s initializing...\n", activelog_version());

    if (activelog_init("127.0.0.1:8080") != 0) {
        fprintf(stderr, "[ERROR] Failed to initialize: %s\n", activelog_error());
        return 1;
    }

    printf("[INFO] ActiveLog ready on 127.0.0.1:8080\n\n");

    // Step 2: Register callback for suggestions
    activelog_on_suggest(on_suggestion);

    // Step 3: Post some example events
    // Modality 0 = Text events
    const char* events[] = {
        "User logged in at 10:30 AM",
        "File saved: document.txt",
        "Compilation failed with 3 errors",
    };

    for (size_t i = 0; i < sizeof(events) / sizeof(events[0]); i++) {
        const char* event = events[i];
        size_t len = strlen(event);

        printf("[EVENT] Posted: %s\n", event);

        // Zero-copy: no allocation, data used directly
        activelog_post(0, event, len);

        // Give suggestion engine time to process
        usleep(100000); // 100ms
    }

    printf("\n");

    // Step 4: Shutdown gracefully
    // - Persists buffered data
    // - Trains LoRA adapter on recent events
    // - Syncs CRDT state
    // - Releases resources
    printf("[INFO] Shutting down...\n");
    activelog_free();

    printf("[INFO] Goodbye!\n");
    return 0;
}
