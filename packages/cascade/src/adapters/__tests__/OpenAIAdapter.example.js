/**
 * OpenAIAdapter Usage Examples
 *
 * This file demonstrates how to use the OpenAIAdapter
 * for cloud inference via OpenAI API.
 */
import { OpenAIAdapter, createOpenAIAdapter } from "../OpenAIAdapter.js";
// ============================================================
// BASIC USAGE
// ============================================================
async function basicExample() {
    // Create adapter using environment variables
    const adapter = new OpenAIAdapter();
    // Or specify API key and model explicitly
    const adapter2 = new OpenAIAdapter("sk-...", "gpt-4");
    // Process a simple prompt
    const result = await adapter.process("What is 2+2?");
    console.log(result.content); // "4"
    console.log(result.model); // "gpt-3.5-turbo"
    console.log(result.tokensUsed); // e.g., 15
    console.log(result.latency); // e.g., 523 (ms)
}
// ============================================================
// USING WITH ROUTING DECISION
// ============================================================
async function routingDecisionExample() {
    const adapter = new OpenAIAdapter("sk-...", "gpt-3.5-turbo");
    const decision = {
        backend: "cloud",
        model: "gpt-4",
        confidence: 0.95,
        reason: "Complex query requires cloud model",
        appliedPrinciples: ["complexity", "accuracy"],
        cacheResponse: true,
    };
    const result = await adapter.execute(decision, "Explain quantum computing");
    console.log(result.content);
    console.log(result.metadata?.finishReason); // "stop"
}
// ============================================================
// STREAMING RESPONSES
// ============================================================
async function streamingExample() {
    const adapter = new OpenAIAdapter("sk-...", "gpt-3.5-turbo");
    console.log("Response: ");
    const result = await adapter.processStream("Tell me a story", "gpt-3.5-turbo", (chunk, done) => {
        // Process each chunk as it arrives
        if (chunk) {
            process.stdout.write(chunk);
        }
        if (done) {
            console.log("\n[Stream complete]");
        }
    });
    console.log(`\nFull response: ${result.content}`);
    console.log(`Metadata: ${JSON.stringify(result.metadata)}`);
}
// ============================================================
// HEALTH CHECK
// ============================================================
async function healthCheckExample() {
    const adapter = new OpenAIAdapter("sk-...", "gpt-3.5-turbo");
    const health = await adapter.checkHealth();
    if (health.healthy) {
        console.log("OpenAI API is accessible");
        console.log("Available models:", health.models);
        console.log("Current model:", health.currentModel);
    }
    else {
        console.log("OpenAI API is not accessible");
        console.log("Error:", health.error);
        console.log("Status:", health.status);
    }
}
// ============================================================
// CONFIGURATION
// ============================================================
async function configurationExample() {
    // Create adapter with custom configuration
    const adapter = createOpenAIAdapter("sk-...", "gpt-4", {
        baseURL: "https://api.openai.com/v1",
        timeout: 120000, // 2 minutes
        maxRetries: 5,
        organization: "org-123",
    });
    // Update configuration at runtime
    adapter.updateConfig({
        timeout: 60000,
        defaultModel: "gpt-3.5-turbo",
    });
    // Get current configuration (API key is redacted)
    const config = adapter.getConfig();
    console.log("Current config:", config);
}
// ============================================================
// ERROR HANDLING
// ============================================================
async function errorHandlingExample() {
    const adapter = new OpenAIAdapter("sk-...", "gpt-3.5-turbo");
    try {
        const result = await adapter.process("Test prompt");
        console.log(result.content);
    }
    catch (error) {
        if (error instanceof Error) {
            console.error("Error:", error.message);
            console.error("Code:", error.code);
            // Handle specific error codes
            switch (error.code) {
                case "INVALID_API_KEY":
                    console.error("Please check your API key");
                    break;
                case "RATE_LIMIT_EXCEEDED":
                    console.error("Rate limit exceeded, please retry later");
                    break;
                case "TIMEOUT":
                    console.error("Request timed out");
                    break;
                case "model_not_found":
                    console.error("Model not found, check model name");
                    break;
                default:
                    console.error("Unknown error");
            }
        }
    }
}
// ============================================================
// ENVIRONMENT VARIABLES
// ============================================================
/**
 * Set these environment variables before running:
 *
 * export OPENAI_API_KEY="sk-..."
 * export OPENAI_MODEL="gpt-3.5-turbo"  (optional)
 * export OPENAI_BASE_URL="https://api.openai.com/v1"  (optional)
 * export OPENAI_ORGANIZATION="org-..."  (optional)
 */
async function envVarExample() {
    // Adapter will read from environment variables
    const adapter = new OpenAIAdapter();
    const result = await adapter.process("Hello from environment!");
    console.log(result.content);
}
// ============================================================
// RETRY LOGIC
// ============================================================
async function retryExample() {
    const adapter = createOpenAIAdapter("sk-...", "gpt-3.5-turbo", {
        maxRetries: 5, // Retry up to 5 times on transient failures
        timeout: 60000,
    });
    // The adapter will automatically retry on:
    // - Network errors (ECONNRESET, ETIMEDOUT)
    // - Rate limits (429) with exponential backoff + jitter
    // - 5xx server errors
    try {
        const result = await adapter.process("Test with automatic retry");
        console.log(result.content);
    }
    catch (error) {
        // Only thrown after all retries exhausted
        console.error("Failed after retries:", error);
    }
}
// ============================================================
// EXPORTS
// ============================================================
export { basicExample, routingDecisionExample, streamingExample, healthCheckExample, configurationExample, errorHandlingExample, envVarExample, retryExample, };
//# sourceMappingURL=OpenAIAdapter.example.js.map