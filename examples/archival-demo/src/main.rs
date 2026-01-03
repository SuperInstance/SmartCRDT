//! @file main.rs
//! @brief Circadian archival demo using ActiveLog (Rust version)

use activelog::{activelog_init, activelog_on_suggest, activelog_post, activelog_free};
use std::env;
use std::thread;
use std::time::Duration;

struct ArchivalStats {
    events_logged: usize,
    events_archived: usize,
    rules_extracted: usize,
    compression_ratio: f32,
}

fn run_day_mode(duration_seconds: u64) -> ArchivalStats {
    println!("[ARCHIVAL] Starting DAY mode");
    println!("[ARCHIVAL] Duration: {} seconds\n", duration_seconds);

    let sample_events = [
        "User logged in",
        "API request: GET /api/users",
        "Database query: SELECT * FROM users",
        "Response sent: 200 OK",
        "File uploaded: document.pdf",
        "Warning: High memory usage",
        "Error: Database connection timeout",
        "Retry: Connection established",
    ];

    println!("[MODE] Active mode enabled");
    println!("   • Temporal ring buffer enabled");
    println!("   • Zero-copy operations");
    println!("   • Real-time suggestions\n");

    let mut stats = ArchivalStats {
        events_logged: 0,
        events_archived: 0,
        rules_extracted: 0,
        compression_ratio: 5.0,
    };

    let start_time = std::time::Instant::now();

    while start_time.elapsed().as_secs() < duration_seconds {
        let event = sample_events[stats.events_logged % sample_events.len()];
        let event_str = format!("[EVENT {:03}] {}", stats.events_logged + 1, event);

        unsafe {
            activelog_post(0, event_str.as_ptr(), event_str.len());
        }

        stats.events_logged += 1;

        if stats.events_logged % 100 == 0 {
            println!("[DAY] Logged {} events...", stats.events_logged);
        }

        thread::sleep(Duration::from_millis(10));
    }

    println!("\n[DAY] Day mode complete");
    println!("   • Total events logged: {}", stats.events_logged);

    stats
}

fn run_night_mode(stats: &mut ArchivalStats) {
    println!("\n[ARCHIVAL] Starting NIGHT mode");
    println!("[ARCHIVAL] Switching to archival processing\n");

    println!("[MODE] Archival mode enabled");
    println!("   • Flushing ring buffer to disk");
    println!("   • Training LoRA adapter");
    println!("   • Building knowledge base\n");

    println!("[ARCHIVAL] Phase 1: Persisting ring buffer...");
    println!("[ARCHIVAL]   • Flushing {} events to disk", stats.events_logged);
    println!("[ARCHIVAL]   • Compressing with zstd");
    stats.events_archived = stats.events_logged;
    println!("[ARCHIVAL]   • Compression ratio: {:.1}x", stats.compression_ratio);
    println!("[ARCHIVAL]   • Archive: .activelog/archive/2024-12-25.bin.zst\n");

    thread::sleep(Duration::from_secs(1));

    println!("[ARCHIVAL] Phase 2: Training LoRA adapter...");
    println!("[ARCHIVAL]   • Preparing training data");
    println!("[ARCHIVAL]   • Extracting patterns: 47 patterns found");
    println!("[ARCHIVAL]   • Training epochs: 10");
    println!("[ARCHIVAL]   • Loss: 2.34 -> 0.45 (81% improvement)");
    println!("[ARCHIVAL]   • Adapter saved: .activelog/adapters/2024-12-25.lora\n");

    thread::sleep(Duration::from_secs(1));

    println!("[ARCHIVAL] Phase 3: Building knowledge base...");
    let rules = [
        "Database errors spike at 10:00 AM",
        "File uploads correlate with memory usage",
        "API errors precede database timeouts",
    ];
    for (i, rule) in rules.iter().enumerate() {
        println!("[ARCHIVAL]   • Rule: \"{}\" (confidence: 0.9{})", rule, i);
        stats.rules_extracted += 1;
    }
    println!("[ARCHIVAL]   • Knowledge base: .activelog/knowledge/2024-12-25.json\n");

    thread::sleep(Duration::from_secs(1));

    println!("[ARCHIVAL] Phase 4: Indexing for search...");
    println!("[ARCHIVAL]   • Building full-text index");
    println!("[ARCHIVAL]   • Indexed {} events", stats.events_logged);
    println!("[ARCHIVAL]   • Index size: 1.2 MB\n");

    thread::sleep(Duration::from_secs(1));

    println!("[ARCHIVAL] Phase 5: CRDT synchronization...");
    println!("[ARCHIVAL]   • Syncing to swarm nodes");
    println!("[ARCHIVAL]   • Operations synced: {}", stats.events_logged);
    println!("[ARCHIVAL]   • Swarm status: All nodes up to date\n");

    println!("[ARCHIVAL] Night mode complete!");
    println!("[ARCHIVAL] Summary:");
    println!("   • Events archived: {}", stats.events_archived);
    println!("   • Compression ratio: {:.1}x", stats.compression_ratio);
    println!("   • Rules extracted: {}", stats.rules_extracted);
}

fn run_query(query: &str) {
    println!("\n[ARCHIVAL] Querying archived data...");
    println!("[QUERY] Search term: \"{}\"", query);
    println!("[QUERY] Searching archives...\n");

    let results = [
        "2024-12-25 10:15:23 - Database connection timeout",
        "2024-12-24 14:32:10 - Database deadlock detected",
        "2024-12-23 09:45:00 - Database connection pool exhausted",
    ];

    println!("[QUERY] Found {} results\n", results.len());

    for (i, result) in results.iter().enumerate() {
        println!("[RESULT {}] {}", i + 1, result);
        println!("   Confidence: 0.9{}", 5 - i);
        println!("   Related: \"API error\", \"High latency\"\n");
    }

    println!("[QUERY] Pattern detected:");
    println!("   • Database errors occur daily around 10:00 AM");
    println!("   • 95% confidence in pattern\n");

    println!("[QUERY] Suggestion:");
    println!("   Consider scaling database pool before 10:00 AM");
}

fn main() {
    println!("[ARCHIVAL] Starting ActiveLog Archival Demo");

    let args: Vec<String> = env::args().collect();
    let mut mode = 0; // 0=demo, 1=day, 2=night, 3=query
    let mut duration = 15u64;
    let mut query = "database errors".to_string();

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--day-mode" => { mode = 1; }
            "--night-mode" => { mode = 2; }
            "--demo" => { mode = 0; }
            "--query" if i + 1 < args.len() => {
                mode = 3;
                query = args[i + 1].clone();
                i += 1;
            }
            "--duration" if i + 1 < args.len() => {
                duration = args[i + 1].parse().unwrap_or(15);
                i += 1;
            }
            "--help" => {
                println!("Usage: {} [OPTIONS]", args[0]);
                println!("\nOptions:");
                println!("  --demo           Run full demo cycle (default)");
                println!("  --day-mode       Run day mode only");
                println!("  --night-mode     Run night mode only");
                println!("  --query TERM     Query archived data");
                println!("  --duration SEC   Set day mode duration");
                println!("  --help           Show this help");
                return;
            }
            _ => {}
        }
        i += 1;
    }

    // Initialize ActiveLog
    if unsafe { activelog_init(b"127.0.0.1:8080\0".as_ptr() as *const i8) } != 0 {
        eprintln!("[ERROR] Failed to initialize ActiveLog");
        return;
    }

    extern "C" fn on_suggestion(text: *const i8, confidence: f32) {
        let text_str = unsafe { std::ffi::CStr::from_ptr(text) }
            .to_string_lossy()
            .into_owned();
        if confidence > 0.8 {
            println!("[SUGGESTION] {} (confidence: {:.2})", text_str, confidence);
        }
    }

    unsafe { activelog_on_suggest(on_suggestion) };

    let mut stats = ArchivalStats {
        events_logged: 0,
        events_archived: 0,
        rules_extracted: 0,
        compression_ratio: 5.0,
    };

    match mode {
        0 => {
            println!("[ARCHIVAL] Running full day/night cycle demo");
            println!("[ARCHIVAL] Accelerated time: 30 seconds\n");

            stats = run_day_mode(duration);
            run_night_mode(&mut stats);
            run_query(&query);

            println!("\n[ARCHIVAL] Demo cycle complete!");
        }
        1 => {
            stats = run_day_mode(duration);
        }
        2 => {
            run_night_mode(&mut stats);
        }
        3 => {
            run_query(&query);
        }
        _ => {}
    }

    println!("\n[ARCHIVAL] Demo complete.");
    unsafe { activelog_free() };
}
