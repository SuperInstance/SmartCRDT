/**
 * Demo: File Watching in ContextPlane
 *
 * This demonstrates the file watching functionality implemented in ContextPlane.
 */

import { ContextPlane } from "./src/index.js";

async function demoFileWatching() {
  console.log("=== File Watching Demo ===\n");

  // Create ContextPlane instance
  const contextPlane = new ContextPlane({});

  // Configure file watcher
  const config = {
    paths: ["./src"], // Watch the src directory
    ignored: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
    debounceMs: 300,
    watchExtensions: [".ts", ".js"]
  };

  try {
    // Initialize ContextPlane
    await contextPlane.initialize();
    console.log("✅ ContextPlane initialized");

    // Start file watching
    await contextPlane.watchFiles(config);
    console.log("✅ File watcher started");

    // Get current status
    const status = contextPlane.getFileWatchStatus();
    console.log("📊 File watching status:", status);

    // Simulate a file change (this would normally be triggered by fs.watch)
    console.log("\n🔄 Simulating file modification...");

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check status again
    const updatedStatus = contextPlane.getFileWatchStatus();
    console.log("📊 Updated file watching status:", updatedStatus);

    // Stop file watching
    await contextPlane.stopWatchingFiles();
    console.log("✅ File watcher stopped");

    // Final status
    const finalStatus = contextPlane.getFileWatchStatus();
    console.log("📊 Final file watching status:", finalStatus);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    // Shutdown
    await contextPlane.shutdown();
    console.log("✅ ContextPlane shutdown");
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demoFileWatching().catch(console.error);
}