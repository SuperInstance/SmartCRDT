use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use clap::{Parser, Subcommand};
use colored::*;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{self, BufRead, Write};
use std::path::PathBuf;
use std::time::Duration;
use uuid::Uuid;

/// ActiveLog Debugger - Interactive debugging for cognitive flows
#[derive(Parser)]
#[command(name = "activelog-debug")]
#[command(about = "Interactive debugger for ActiveLog cognitive flows", long_about = None)]
#[command(version = "0.1.0")]
struct Cli {
    /// Enable verbose output
    #[arg(short, long)]
    verbose: bool,

    /// Path to ActiveLog instance directory
    #[arg(short, long)]
    path: Option<PathBuf>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Start interactive debugging session
    Session {
        /// Target process ID
        #[arg(short, long)]
        pid: Option<u32>,

        /// Connection string (if debugging remote instance)
        #[arg(short, long)]
        connect: Option<String>,
    },

    /// Set breakpoints
    Break {
        /// Breakpoint type: event, resonance, archival
        #[arg(short, long)]
        r#type: String,

        /// Event/resonance ID to break on
        #[arg(short, long)]
        id: Option<String>,

        /// Condition to evaluate
        #[arg(short, long)]
        condition: Option<String>,

        /// List all breakpoints
        #[arg(short, long)]
        list: bool,
    },

    /// Inspect state
    Inspect {
        /// State component: ring, cache, vectors, all
        #[arg(short, long)]
        component: String,

        /// Output format: json, pretty, raw
        #[arg(short, long, default_value = "pretty")]
        format: String,

        /// Watch for changes
        #[arg(short, long)]
        watch: bool,
    },

    /// Step through execution
    Step {
        /// Number of steps to execute
        #[arg(short, long, default_value = "1")]
        count: usize,

        /// Step type: over, into, out
        #[arg(short, long, default_value = "over")]
        r#type: String,
    },

    /// Watch variables
    Watch {
        /// Variable/expression to watch
        #[arg(short, long)]
        expression: Option<String>,

        /// List all watchers
        #[arg(short, long)]
        list: bool,

        /// Remove watcher by ID
        #[arg(short, long)]
        remove: Option<usize>,
    },

    /// Continue execution
    Continue {
        /// Number of times to continue before breaking
        #[arg(short, long, default_value = "1")]
        count: usize,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Breakpoint {
    id: String,
    r#type: BreakpointType,
    target: Option<String>,
    condition: Option<String>,
    hit_count: usize,
    enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
enum BreakpointType {
    Event,
    Resonance,
    Archival,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Watcher {
    id: usize,
    expression: String,
    value: serde_json::Value,
    last_changed: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RingBufferState {
    capacity: usize,
    length: usize,
    head: usize,
    tail: usize,
    entries: Vec<RingEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RingEntry {
    id: String,
    timestamp: DateTime<Utc>,
    event_type: String,
    data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct VectorDBState {
    vectors_count: usize,
    dimensions: usize,
    index_type: String,
    last_compacted: DateTime<Utc>,
}

struct Debugger {
    breakpoints: Vec<Breakpoint>,
    watchers: Vec<Watcher>,
    current_state: Option<SystemState>,
    path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SystemState {
    ring: RingBufferState,
    vectors: VectorDBState,
    cache: HashMap<String, serde_json::Value>,
    timestamp: DateTime<Utc>,
}

impl Debugger {
    fn new(path: PathBuf) -> Self {
        Debugger {
            breakpoints: Vec::new(),
            watchers: Vec::new(),
            current_state: None,
            path,
        }
    }

    fn add_breakpoint(&mut self, r#type: BreakpointType, target: Option<String>, condition: Option<String>) -> String {
        let id = Uuid::new_v4().to_string();
        let bp = Breakpoint {
            id: id.clone(),
            r#type,
            target,
            condition,
            hit_count: 0,
            enabled: true,
        };
        self.breakpoints.push(bp);
        id
    }

    fn list_breakpoints(&self) {
        println!("\n{}", "Breakpoints:".bold().cyan());
        println!("{}", "─".repeat(80));
        
        if self.breakpoints.is_empty() {
            println!("  {}", "No breakpoints set".yellow());
        } else {
            for (idx, bp) in self.breakpoints.iter().enumerate() {
                let status = if bp.enabled { "✓".green() } else { "✗".red() };
                println!(
                    "  {} #{} {} {:?} - Hits: {}",
                    status,
                    idx.to_string().bold(),
                    bp.id[..8].to_string().dimmed(),
                    bp.r#type,
                    bp.hit_count.to_string().yellow()
                );
                if let Some(target) = &bp.target {
                    println!("      Target: {}", target.cyan());
                }
                if let Some(cond) = &bp.condition {
                    println!("      Condition: {}", cond.yellow());
                }
            }
        }
    }

    fn add_watcher(&mut self, expression: String) -> usize {
        let id = self.watchers.len() + 1;
        let watcher = Watcher {
            id,
            expression: expression.clone(),
            value: serde_json::Value::Null,
            last_changed: Utc::now(),
        };
        self.watchers.push(watcher);
        println!("  {} Watcher #{} added: {}", "✓".green(), id.to_string().bold(), expression.cyan());
        id
    }

    fn list_watchers(&self) {
        println!("\n{}", "Watchers:".bold().cyan());
        println!("{}", "─".repeat(80));
        
        if self.watchers.is_empty() {
            println!("  {}", "No watchers set".yellow());
        } else {
            for watcher in &self.watchers {
                println!(
                    "  {} #{} {} = {}",
                    "→".blue(),
                    watcher.id.to_string().bold(),
                    watcher.expression.cyan(),
                    serde_json::to_string_pretty(&watcher.value).unwrap_or_default().yellow()
                );
                println!("      Last changed: {}", watcher.last_changed.to_rfc3339().dimmed());
            }
        }
    }

    fn inspect_state(&self, component: &str, format: &str) -> Result<()> {
        let state_path = self.path.join("state.json");
        
        if !state_path.exists() {
            // Return demo state for illustration
            let demo_state = self.create_demo_state();
            self.print_state(&demo_state, component, format)?;
            return Ok(());
        }

        let content = fs::read_to_string(&state_path)?;
        let state: SystemState = serde_json::from_str(&content)?;
        self.print_state(&state, component, format)?;
        
        Ok(())
    }

    fn create_demo_state(&self) -> SystemState {
        SystemState {
            ring: RingBufferState {
                capacity: 10000,
                length: 7843,
                head: 7843,
                tail: 0,
                entries: vec![],
            },
            vectors: VectorDBState {
                vectors_count: 15420,
                dimensions: 768,
                index_type: "HNSW".to_string(),
                last_compacted: Utc::now(),
            },
            cache: HashMap::new(),
            timestamp: Utc::now(),
        }
    }

    fn print_state(&self, state: &SystemState, component: &str, format: &str) -> Result<()> {
        if format == "json" {
            println!("{}", serde_json::to_string_pretty(state)?);
            return Ok(());
        }

        match component {
            "ring" => {
                println!("\n{}", "Ring Buffer State:".bold().cyan());
                println!("{}", "═".repeat(80));
                println!("  Capacity:     {}", state.ring.capacity.to_string().green());
                println!("  Length:       {} / {}", 
                    state.ring.length.to_string().yellow(),
                    state.ring.capacity.to_string().dimmed()
                );
                println!("  Utilization:  {:.1}%", 
                    (state.ring.length as f64 / state.ring.capacity as f64 * 100.0).to_string().cyan()
                );
                println!("  Head:         {}", state.ring.head.to_string().blue());
                println!("  Tail:         {}", state.ring.tail.to_string().blue());
            },
            "vectors" => {
                println!("\n{}", "Vector Database State:".bold().cyan());
                println!("{}", "═".repeat(80));
                println!("  Total Vectors:  {}", state.vectors.vectors_count.to_string().green());
                println!("  Dimensions:     {}", state.vectors.dimensions.to_string().yellow());
                println!("  Index Type:     {}", state.vectors.index_type.cyan());
                println!("  Last Compact:   {}", state.vectors.last_compacted.to_rfc3339().dimmed());
            },
            "cache" => {
                println!("\n{}", "Cache State:".bold().cyan());
                println!("{}", "═".repeat(80));
                println!("  Entries: {}", state.cache.len().to_string().green());
            },
            "all" => {
                self.print_state(state, "ring", format)?;
                println!();
                self.print_state(state, "vectors", format)?;
                println!();
                self.print_state(state, "cache", format)?;
            },
            _ => {
                anyhow::bail!("Unknown component: {}", component);
            }
        }

        Ok(())
    }

    fn step(&mut self, count: usize, step_type: &str) -> Result<()> {
        println!("\n{}", "Stepping execution:".bold().cyan());
        println!("  Type: {}", step_type.yellow());
        println!("  Steps: {}", count.to_string().green());
        
        for i in 0..count {
            println!("  Step {} of {}", i + 1, count);
            // Simulate step
            std::thread::sleep(Duration::from_millis(100));
        }
        
        println!("  {} Completed {} steps", "✓".green(), count);
        Ok(())
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    
    let path = cli.path.unwrap_or_else(|| {
        PathBuf::from(".")
    });

    let mut debugger = Debugger::new(path);

    match cli.command {
        Commands::Session { pid, connect } => {
            println!("\n{}", "╔═══════════════════════════════════════════════════════════════╗".bold().cyan());
            println!("{}", "║           ActiveLog Interactive Debugger v0.1.0            ║".bold().cyan());
            println!("{}", "╚═══════════════════════════════════════════════════════════════╝".bold().cyan());
            
            if let Some(pid) = pid {
                println!("\n{} Attaching to process {}", "→".green(), pid.to_string().cyan());
            } else if let Some(conn) = connect {
                println!("\n{} Connecting to {}", "→".green(), conn.cyan());
            } else {
                println!("\n{} Starting new debug session", "→".green());
            }
            
            println!("\n{}", "Debug commands:".bold().yellow());
            println!("  break     - Set breakpoints");
            println!("  inspect   - Inspect state");
            println!("  step      - Step execution");
            println!("  watch     - Watch variables");
            println!("  continue  - Continue execution");
            println!("  quit      - Exit debugger");
            
            run_repl(&mut debugger).await?;
        },

        Commands::Break { r#type, id, condition, list } => {
            if list {
                debugger.list_breakpoints();
            } else {
                let bp_type = match r#type.as_str() {
                    "event" => BreakpointType::Event,
                    "resonance" => BreakpointType::Resonance,
                    "archival" => BreakpointType::Archival,
                    _ => anyhow::bail!("Invalid breakpoint type: {}", r#type),
                };
                
                let bp_id = debugger.add_breakpoint(bp_type, id, condition);
                println!("  {} Breakpoint created: {}", "✓".green(), bp_id[..8].to_string().cyan());
            }
        },

        Commands::Inspect { component, format, watch } => {
            if watch {
                println!("\n{} Watching state (press Ctrl+C to stop)", "→".green());
                loop {
                    debugger.inspect_state(&component, &format)?;
                    println!("{}", "─".repeat(80));
                    std::thread::sleep(Duration::from_secs(2));
                }
            } else {
                debugger.inspect_state(&component, &format)?;
            }
        },

        Commands::Step { count, r#type } => {
            debugger.step(count, &r#type)?;
        },

        Commands::Watch { expression, list, remove } => {
            if list {
                debugger.list_watchers();
            } else if let Some(expr) = expression {
                debugger.add_watcher(expr);
            } else if let Some(id) = remove {
                debugger.watchers.retain(|w| w.id != id);
                println!("  {} Watcher #{} removed", "✓".green(), id);
            }
        },

        Commands::Continue { count } => {
            println!("\n{} Continuing ({}x before break)...", "→".green(), count);
            println!("  Use Ctrl+C to interrupt");
        },
    }

    Ok(())
}

async fn run_repl(debugger: &mut Debugger) -> Result<()> {
    let stdin = io::stdin();
    
    loop {
        print!("\n{} ", "debug>".cyan().bold());
        io::stdout().flush()?;
        
        let line = stdin.lock().lines().next();
        
        match line {
            Some(Ok(input)) => {
                let parts: Vec<&str> = input.trim().split_whitespace().collect();
                
                if parts.is_empty() {
                    continue;
                }
                
                match parts[0] {
                    "break" | "b" => {
                        println!("  Breakpoint commands:");
                        println!("    break event <id>           - Break on event");
                        println!("    break resonance <id>       - Break on resonance");
                        println!("    break archival <id>        - Break on archival");
                        println!("    break --list               - List breakpoints");
                    },
                    "inspect" | "i" => {
                        let component = parts.get(1).map(|s| s.as_str()).unwrap_or("all");
                        debugger.inspect_state(component, "pretty")?;
                    },
                    "step" | "s" => {
                        debugger.step(1, "over")?;
                    },
                    "watch" | "w" => {
                        if parts.len() > 1 {
                            debugger.add_watcher(parts[1].to_string());
                        } else {
                            debugger.list_watchers();
                        }
                    },
                    "continue" | "c" => {
                        println!("  Continuing...");
                    },
                    "help" | "h" | "?" => {
                        print_help();
                    },
                    "quit" | "q" | "exit" => {
                        println!("  {} Goodbye!", "👋".green());
                        break;
                    },
                    _ => {
                        println!("  Unknown command: {}. Type 'help' for available commands.", parts[0].red());
                    }
                }
            },
            Some(Err(e)) => {
                anyhow::bail!("Error reading input: {}", e);
            },
            None => {
                break;
            }
        }
    }
    
    Ok(())
}

fn print_help() {
    println!("\n{}", "Available Commands:".bold().yellow());
    println!("{}", "─".repeat(80));
    println!("  break, b          - Breakpoint management");
    println!("  inspect, i        - Inspect state (ring, vectors, cache, all)");
    println!("  step, s           - Step execution");
    println!("  watch, w          - Watch variables");
    println!("  continue, c       - Continue execution");
    println!("  help, h, ?        - Show this help");
    println!("  quit, q, exit     - Exit debugger");
    println!();
    println!("{}", "Examples:".bold().yellow());
    println!("  inspect ring        - Inspect ring buffer state");
    println!("  watch resonance.*   - Watch all resonance values");
    println!("  step                - Single step");
    println!();
}
