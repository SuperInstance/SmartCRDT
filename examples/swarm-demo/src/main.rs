//! @file main.rs
//! @brief Multi-node swarm demo using ActiveLog (Rust version)

use activelog::{activelog_init, activelog_on_suggest, activelog_post, activelog_free};
use std::env;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

#[derive(Clone)]
struct NodeConfig {
    node_id: usize,
    port: u16,
    is_leader: bool,
    peers: Vec<String>,
}

struct SwarmStats {
    events_processed: AtomicUsize,
    sync_operations: AtomicUsize,
    conflicts_resolved: AtomicUsize,
}

fn main() {
    let args: Vec<String> = env::args().collect();

    let mut config = NodeConfig {
        node_id: 1,
        port: 8080,
        is_leader: false,
        peers: Vec::new(),
    };

    // Parse arguments
    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--node-id" if i + 1 < args.len() => {
                config.node_id = args[i + 1].parse().unwrap_or(1);
                i += 2;
            }
            "--port" if i + 1 < args.len() => {
                config.port = args[i + 1].parse().unwrap_or(8080);
                i += 2;
            }
            "--leader" => {
                config.is_leader = true;
                i += 1;
            }
            "--peer" if i + 1 < args.len() => {
                config.peers.push(args[i + 1].clone());
                i += 2;
            }
            _ => {
                i += 1;
            }
        }
    }

    println!(
        "[SWARM NODE {}] Starting on 127.0.0.1:{} ({})",
        config.node_id,
        config.port,
        if config.is_leader { "LEADER" } else { "FOLLOWER" }
    );

    // Initialize ActiveLog
    let bind_addr = format!("127.0.0.1:{}", config.port);
    let bind_addr_c = format!("{}\0", bind_addr);

    if unsafe { activelog_init(bind_addr_c.as_ptr() as *const i8) } != 0 {
        eprintln!("[ERROR] Failed to initialize ActiveLog");
        return;
    }

    println!("[SWARM NODE {}] ActiveLog initialized", config.node_id);

    let stats = Arc::new(SwarmStats {
        events_processed: AtomicUsize::new(0),
        sync_operations: AtomicUsize::new(0),
        conflicts_resolved: AtomicUsize::new(0),
    });

    let running = Arc::new(AtomicBool::new(true));
    let r = running.clone();

    // Handle Ctrl+C
    ctrlc::set_handler(move || {
        println!("\n[SWARM] Received shutdown signal");
        r.store(false, Ordering::SeqCst);
    })
    .expect("Error setting Ctrl+C handler");

    // Register callback
    extern "C" fn on_suggestion(text: *const i8, _confidence: f32) {
        let text_str = unsafe { std::ffi::CStr::from_ptr(text) }
            .to_string_lossy()
            .into_owned();

        if text_str.contains("sync") {
            println!("[CRDT] {}", text_str);
        }
    }

    unsafe { activelog_on_suggest(on_suggestion) };

    println!("[SWARM NODE {}] Starting event processing...", config.node_id);

    let mut count = 0usize;
    while running.load(Ordering::SeqCst) {
        let event = format!(
            "Node {} event #{} - {}",
            config.node_id,
            count,
            if config.is_leader { "leader" } else { "follower" }
        );

        unsafe {
            activelog_post(0, event.as_ptr(), event.len());
        }

        stats.events_processed.fetch_add(1, Ordering::SeqCst);
        count += 1;

        if count % 100 == 0 {
            println!(
                "[EVENT] Node {} processed {} events",
                config.node_id, count
            );
        }

        std::thread::sleep(Duration::from_millis(10));
    }

    // Cleanup
    println!(
        "\n[SWARM NODE {}] Shutting down...",
        config.node_id
    );
    println!("   • Total events: {}", stats.events_processed.load(Ordering::SeqCst));
    println!("   • Sync ops: {}", stats.sync_operations.load(Ordering::SeqCst));
    println!("   • Conflicts: {}", stats.conflicts_resolved.load(Ordering::SeqCst));

    unsafe { activelog_free() };
    println!("[SWARM NODE {}] Goodbye!", config.node_id);
}
