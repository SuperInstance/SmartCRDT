//! @file main.rs
//! @brief Log analysis tool using ActiveLog (Rust version)

use activelog::{activelog_init, activelog_on_suggest, activelog_post, activelog_free};
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

/// Analysis statistics
#[derive(Default)]
struct AnalysisStats {
    total_entries: usize,
    patterns_found: usize,
    anomalies: usize,
    clusters: usize,
    rules_extracted: usize,
}

/// Log entry
struct LogEntry {
    timestamp: String,
    level: String,
    message: String,
    source: String,
}

/// Parse log line
fn parse_log_line(line: &str, source: &str) -> Option<LogEntry> {
    let line = line.trim();
    if line.is_empty() {
        return None;
    }

    // Try JSON format
    if line.starts_with('{') {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
            return Some(LogEntry {
                timestamp: json["timestamp"].as_str().unwrap_or("").to_string(),
                level: json["level"].as_str().unwrap_or("INFO").to_string(),
                message: json["message"].as_str().unwrap_or("").to_string(),
                source: source.to_string(),
            });
        }
    }

    // Try standard log format
    if line.contains('[') && line.contains(']') {
        let parts: Vec<&str> = line.splitn(3, ']').collect();
        if parts.len() >= 3 {
            let level = parts[1].trim_start_matches('[').trim_end_matches(']');
            let message = parts[2].trim();
            return Some(LogEntry {
                timestamp: parts[0].trim().to_string(),
                level: level.to_string(),
                message: message.to_string(),
                source: source.to_string(),
            });
        }
    }

    // Fallback
    Some(LogEntry {
        timestamp: String::new(),
        level: "INFO".to_string(),
        message: line.to_string(),
        source: source.to_string(),
    })
}

/// Process a single log file
fn process_file(filepath: &Path, stats: &Arc<Mutex<AnalysisStats>>) -> std::io::Result<usize> {
    println!("[ANALYSIS] Processing: {}", filepath.display());

    let file = File::open(filepath)?;
    let reader = BufReader::new(file);
    let source = filepath.to_string_lossy().to_string();
    let mut count = 0;

    for line in reader.lines() {
        let line = line?;
        if let Some(entry) = parse_log_line(&line, &source) {
            let event_str = format!("Log: [{}] {} - {}", entry.level, entry.timestamp, entry.message);

            unsafe {
                activelog_post(
                    0,
                    event_str.as_ptr(),
                    event_str.len()
                );
            }

            count += 1;
            stats.lock().unwrap().total_entries += 1;

            if count % 1000 == 0 {
                println!("[ANALYSIS]   • Processed {} entries...", count);
            }
        }
    }

    println!("[ANALYSIS]   • Total entries: {}", count);
    Ok(count)
}

/// Process directory of log files
fn process_directory(dirpath: &Path, stats: &Arc<Mutex<AnalysisStats>>) -> std::io::Result<usize> {
    println!("[ANALYSIS] Scanning directory: {}", dirpath.display());

    let entries = fs::read_dir(dirpath)?;
    let mut file_count = 0;

    for entry in entries {
        let entry = entry?;
        let path = entry.path();

        if path.is_file() {
            let ext = path.extension().and_then(|s| s.to_str());
            if ext == Some("log") || ext == Some("txt") {
                let _ = process_file(&path, stats);
                file_count += 1;
            }
        }
    }

    Ok(file_count)
}

fn main() {
    println!("[LOG ANALYZER] Starting ActiveLog Log Analyzer");

    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: {} <log-file-or-directory>", args[0]);
        eprintln!("\nExample:");
        eprintln!("  {} /var/log/app.log", args[0]);
        eprintln!("  {} sample-logs/", args[0]);
        return;
    }

    // Initialize ActiveLog
    println!("[LOG ANALYZER] Initializing ActiveLog...");
    if unsafe { activelog_init(b"127.0.0.1:8080\0".as_ptr() as *const i8) } != 0 {
        eprintln!("[ERROR] Failed to initialize ActiveLog");
        return;
    }

    // Register callback
    extern "C" fn on_suggestion(text: *const i8, confidence: f32) {
        let text_str = unsafe { std::ffi::CStr::from_ptr(text) }
            .to_string_lossy()
            .into_owned();

        if confidence > 0.80 {
            if text_str.contains("anomaly") || text_str.contains("Anomaly") {
                println!("[ANALYZER] Anomaly detected: {} (confidence: {:.2})", text_str, confidence);
            } else if text_str.contains("cluster") {
                println!("[ANALYZER] Pattern cluster: {}", text_str);
            } else if text_str.contains("Rule") {
                println!("[KNOWLEDGE] Rule extracted: \"{}\"", text_str);
            }
        }
    }

    unsafe { activelog_on_suggest(on_suggestion) };
    println!("[LOG ANALYZER] Analysis engine ready\n");

    let stats = Arc::new(Mutex::new(AnalysisStats::default()));
    let input_path = Path::new(&args[1]);

    // Process input
    if input_path.is_file() {
        println!("[ANALYSIS] Processing single file\n");
        let _ = process_file(input_path, &stats);
    } else if input_path.is_dir() {
        let file_count = process_directory(input_path, &stats).unwrap();
        println!("\n[ANALYSIS] Total files processed: {}", file_count);
    } else {
        eprintln!("[ERROR] Invalid path: {}", args[1]);
        unsafe { activelog_free() };
        return;
    }

    println!("\n[ANALYSIS] Waiting for analysis to complete...");
    thread::sleep(Duration::from_secs(2));

    // Print summary
    let s = stats.lock().unwrap();
    println!("\n[SUMMARY] Analysis complete");
    println!("   • Total entries: {}", s.total_entries);
    println!("   • Patterns found: {}", s.patterns_found);
    println!("   • Anomalies: {}", s.anomalies);
    println!("   • Clusters: {}", s.clusters);
    println!("   • Rules extracted: {}", s.rules_extracted);

    println!("\n[LOG ANALYZER] Analysis complete.");
    unsafe { activelog_free() };
}
