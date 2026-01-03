//! @file main.rs
//! @brief AI coding assistant using ActiveLog (Rust version)

use activelog::{activelog_init, activelog_on_suggest, activelog_post, activelog_free};
use std::io::{self, BufRead};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

/// Statistics tracking
#[derive(Default)]
struct Statistics {
    code_changes: usize,
    suggestions: usize,
    accepted: usize,
    anti_patterns: usize,
    patterns_learned: usize,
}

/// Code event types
#[derive(Debug)]
enum EventType {
    CodeChange,
    BuildOutput,
    TestResult,
    Feedback,
}

/// Parsed code event
struct CodeEvent {
    event_type: EventType,
    file: Option<String>,
    line: Option<usize>,
    content: String,
}

/// Parse event from string
fn parse_event(line: &str) -> Option<CodeEvent> {
    let parts: Vec<&str> = line.split('|').collect();

    match parts.first() {
        Some(&"code_change") => {
            Some(CodeEvent {
                event_type: EventType::CodeChange,
                file: parts.get(1).map(|s| s.to_string()),
                line: parts.get(2).and_then(|s| s.parse().ok()),
                content: parts.get(3).unwrap_or(&"").to_string(),
            })
        }
        Some(&"build_output") => {
            Some(CodeEvent {
                event_type: EventType::BuildOutput,
                file: None,
                line: None,
                content: parts.get(1).unwrap_or(&"").to_string(),
            })
        }
        Some(&"test_result") => {
            Some(CodeEvent {
                event_type: EventType::TestResult,
                file: None,
                line: None,
                content: parts.get(1).unwrap_or(&"").to_string(),
            })
        }
        Some(&"feedback") => {
            Some(CodeEvent {
                event_type: EventType::Feedback,
                file: None,
                line: None,
                content: parts.get(1).unwrap_or(&"").to_string(),
            })
        }
        _ => None,
    }
}

/// Main application
fn main() {
    println!("[COGNITIVE] Starting ActiveLog Cognitive Assistant");

    // Initialize ActiveLog
    if unsafe { activelog_init(b"127.0.0.1:8080\0".as_ptr() as *const i8) } != 0 {
        eprintln!("[ERROR] Failed to initialize ActiveLog");
        return;
    }

    println!("[COGNITIVE] Learning engine ready");

    let stats = Arc::new(Mutex::new(Statistics::default()));
    let stats_clone = stats.clone();

    // Register suggestion callback
    extern "C" fn on_suggestion(text: *const i8, confidence: f32) {
        let text_str = unsafe { std::ffi::CStr::from_ptr(text) }
            .to_string_lossy()
            .into_owned();

        if confidence > 0.90 {
            if text_str.contains("memory leak") || text_str.contains("security") {
                println!("\n[ALERT] {} (confidence: {:.2})", text_str, confidence);
            } else {
                println!("\n[SUGGESTION] {} (confidence: {:.2})", text_str, confidence);
            }
        } else if confidence > 0.75 {
            println!("   │ {}", text_str);
        }
    }

    unsafe { activelog_on_suggest(on_suggestion) };

    println!("[COGNITIVE] Ready!\n");

    // Run demo session
    run_demo_session(&stats_clone);

    // Print statistics
    print_statistics(&stats_clone);

    // Cleanup
    println!("\n[COGNITIVE] Shutting down...");
    unsafe { activelog_free() };
    println!("[COGNITIVE] Goodbye!");
}

/// Run demo coding session
fn run_demo_session(stats: &Arc<Mutex<Statistics>>) {
    println!("[COGNITIVE] Running demo coding session...\n");

    let demo_events = [
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
    ];

    for event_str in &demo_events {
        if let Some(event) = parse_event(event_str) {
            process_event(&event, stats);
        }

        // Update stats
        let mut s = stats.lock().unwrap();
        s.code_changes += 1;

        thread::sleep(Duration::from_millis(50));
    }
}

/// Process a code event
fn process_event(event: &CodeEvent, _stats: &Arc<Mutex<Statistics>>) {
    let event_str = match event.event_type {
        EventType::CodeChange => {
            format!(
                "Code change in {}:{} - {}",
                event.file.as_ref().unwrap_or(&"?".to_string()),
                event.line.unwrap_or(0),
                event.content
            )
        }
        EventType::BuildOutput => {
            format!("Build output: {}", event.content)
        }
        EventType::TestResult => {
            format!("Test result: {}", event.content)
        }
        EventType::Feedback => {
            format!("Feedback received: {}", event.content)
        }
    };

    println!("[EVENT] {}", event_str);

    // Send to ActiveLog
    unsafe {
        activelog_post(
            0,
            event_str.as_ptr(),
            event_str.len()
        );
    }
}

/// Print session statistics
fn print_statistics(stats: &Arc<Mutex<Statistics>>) {
    let s = stats.lock().unwrap();

    println!("\n[COGNITIVE] Statistics this session:");
    println!("   • {} code changes analyzed", s.code_changes);
    println!("   • {} suggestions generated", s.suggestions);
    println!("   • {} suggestions accepted", s.accepted);
    println!("   • {} anti-patterns detected", s.anti_patterns);
    println!("   • {} new patterns learned", s.patterns_learned);
}
