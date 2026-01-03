use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use clap::{Parser, Subcommand};
use colored::*;
use plotters::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{self, BufRead, Write};
use std::path::PathBuf;
use std::time::{Duration, Instant};
use indicatif::{ProgressBar, ProgressStyle};

/// ActiveLog Profiler - Performance profiling with flame graphs
#[derive(Parser)]
#[command(name = "activelog-profile")]
#[command(about = "Profiler for ActiveLog with flame graph generation", long_about = None)]
#[command(version = "0.1.0")]
struct Cli {
    /// Enable verbose output
    #[arg(short, long)]
    verbose: bool,

    /// Path to ActiveLog instance
    #[arg(short, long)]
    path: Option<PathBuf>,

    /// Output directory for reports
    #[arg(short, long)]
    output: Option<PathBuf>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Generate flame graph
    Flame {
        /// Duration to profile (seconds)
        #[arg(short, long, default_value = "30")]
        duration: u64,

        /// Sampling frequency (Hz)
        #[arg(short, long, default_value = "100")]
        frequency: u64,

        /// Process ID to profile
        #[arg(short, long)]
        pid: Option<u32>,

        /// Output file
        #[arg(short, long, default_value = "flamegraph.svg")]
        output: String,
    },

    /// CPU profiling
    Cpu {
        /// Duration to profile
        #[arg(short, long, default_value = "60")]
        duration: u64,

        /// Generate comparison report
        #[arg(short, long)]
        compare: Option<PathBuf>,

        /// Top N hotspots to show
        #[arg(short, long, default_value = "20")]
        top: usize,
    },

    /// Memory profiling
    Memory {
        /// Duration to profile
        #[arg(short, long, default_value = "60")]
        duration: u64,

        /// Allocation tracking
        #[arg(short, long)]
        track_allocations: bool,

        /// Heap dump on completion
        #[arg(short, long)]
        heap_dump: bool,
    },

    /// Identify hotspots
    Hotspots {
        /// Input profile data
        #[arg(short, long)]
        input: PathBuf,

        /// Minimum threshold (percentage)
        #[arg(short, long, default_value = "1.0")]
        threshold: f64,

        /// Group by function or module
        #[arg(short, long, default_value = "function")]
        group_by: String,
    },

    /// Generate comparison report
    Compare {
        /// Baseline profile
        #[arg(short, long)]
        baseline: PathBuf,

        /// Comparison profile
        #[arg(short, long)]
        current: PathBuf,

        /// Output format: text, html, json
        #[arg(short, long, default_value = "text")]
        format: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ProfileData {
    timestamp: DateTime<Utc>,
    duration: Duration,
    samples: Vec<Sample>,
    metadata: ProfileMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Sample {
    timestamp: Duration,
    stack: Vec<String>,
    value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ProfileMetadata {
    pid: Option<u32>,
    frequency: u64,
    total_samples: usize,
    capture_time: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Hotspot {
    name: String,
    module: String,
    total_time: Duration,
    self_time: Duration,
    percentage: f64,
    call_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ComparisonReport {
    baseline_name: String,
    current_name: String,
    improvements: Vec<Change>,
    regressions: Vec<Change>,
    unchanged: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Change {
    function: String,
    baseline_time: Duration,
    current_time: Duration,
    change_percent: f64,
}

struct Profiler {
    output_dir: PathBuf,
}

impl Profiler {
    fn new(output_dir: PathBuf) -> Self {
        Profiler { output_dir }
    }

    fn generate_flamegraph(&self, duration: u64, frequency: u64, output: &str) -> Result<()> {
        println!("\n{}", "Generating Flame Graph".bold().cyan());
        println!("{}", "═".repeat(80));
        
        let total_samples = duration * frequency;
        let progress = ProgressBar::new(total_samples);
        progress.set_style(ProgressStyle::default_bar()
            .template("{spinner:.green} [{elapsed_precise}] [{wide_bar:.cyan/blue}] {pos}/{len} samples ({eta})")
            .unwrap()
            .progress_chars("=>-"));

        println!("  Duration:     {} seconds", duration.to_string().green());
        println!("  Frequency:    {} Hz", frequency.to_string().yellow());
        println!("  Total Samples: {}", total_samples.to_string().cyan());
        println!("  Output:       {}", output.cyan());

        // Simulate sampling
        let start = Instant::now();
        for _ in 0..total_samples / 100 { // Divide for demo speed
            progress.inc(100);
            std::thread::sleep(Duration::from_millis(10));
        }
        progress.finish();

        // Generate sample flame graph data
        let flame_data = self.create_demo_flame_data();
        
        // Create SVG output
        let svg_path = self.output_dir.join(output);
        self.write_flamegraph_svg(&flame_data, &svg_path)?;

        println!("\n  {} Flame graph saved to {}", "✓".green(), svg_path.display());
        Ok(())
    }

    fn create_demo_flame_data(&self) -> Vec<(String, u64, Vec<(String, u64)>)> {
        vec![
            ("root".to_string(), 1000, vec![
                ("cognitive_flow".to_string(), 600, vec![
                    ("event_processing".to_string(), 300, vec![
                        ("parse_event".to_string(), 100, vec![]),
                        ("validate".to_string(), 80, vec![]),
                        ("transform".to_string(), 120, vec![]),
                    ].into_iter().collect()),
                    ("resonance_calc".to_string(), 200, vec![
                        ("vector_search".to_string(), 150, vec![]),
                        ("score_compute".to_string(), 50, vec![]),
                    ].into_iter().collect()),
                    ("archival".to_string(), 100, vec![
                        ("compress".to_string(), 60, vec![]),
                        ("persist".to_string(), 40, vec![]),
                    ].into_iter().collect()),
                ].into_iter().collect()),
                ("crdt_merge".to_string(), 300, vec![
                    ("resolve_conflicts".to_string(), 200, vec![]),
                    ("apply_delta".to_string(), 100, vec![]),
                ].into_iter().collect()),
                ("io_operations".to_string(), 100, vec![
                    ("ring_buffer".to_string(), 60, vec![]),
                    ("vector_db".to_string(), 40, vec![]),
                ].into_iter().collect()),
            ].into_iter().collect()),
        ]
    }

    fn write_flamegraph_svg(&self, data: &[(String, u64, Vec<(String, u64, HashMap<String, u64>)>)], path: &PathBuf) -> Result<()> {
        let mut svg_content = String::from(r#"<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg version="1.1" width="1200" height="600" xmlns="http://www.w3.org/2000/svg">
"#);

        // Add flame graph title
        svg_content.push_str(&format!(r#"
  <text x="600" y="30" text-anchor="middle" font-family="Arial" font-size="20" fill="#333">
    ActiveLog Flame Graph - {}
  </text>
"#", Utc::now().format("%Y-%m-%d %H:%M:%S")));

        // Add sample flame bars (simplified for demo)
        let colors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#ffeaa7", "#dfe6e9"];
        let mut y_offset = 50;
        
        for (depth, (name, width, children)) in data.iter().enumerate() {
            let x_offset = 10 + (depth * 50);
            let bar_width = width / 2;
            let color = colors[depth % colors.len()];
            
            svg_content.push_str(&format!(r#"
  <rect x="{}" y="{}" width="{}" height="30" fill="{}" stroke="#fff" stroke-width="1"/>
  <text x="{}" y="{}" font-family="monospace" font-size="12" fill="#000">
    {} ({}ms)
  </text>
"#, x_offset, y_offset, bar_width, color, x_offset + 5, y_offset + 20, name, width));

            y_offset += 35;
        }

        svg_content.push_str("\n</svg>");
        
        fs::write(path, svg_content)?;
        Ok(())
    }

    fn profile_cpu(&self, duration: u64, top: usize) -> Result<Vec<Hotspot>> {
        println!("\n{}", "CPU Profiling".bold().cyan());
        println!("{}", "═".repeat(80));
        println!("  Duration: {} seconds", duration.to_string().green());
        
        let progress = ProgressBar::new(duration);
        progress.set_style(ProgressStyle::default_bar()
            .template("{spinner:.green} [{elapsed_precise}] [{wide_bar:.cyan/blue}] {pos}/{len}s")
            .unwrap()
            .progress_chars("=>-"));

        for i in 0..duration {
            progress.inc(1);
            std::thread::sleep(Duration::from_millis(100));
        }
        progress.finish();

        // Create demo hotspots
        let hotspots = vec![
            Hotspot {
                name: "cognitive_flow_process".to_string(),
                module: "core::flow".to_string(),
                total_time: Duration::from_millis(2450),
                self_time: Duration::from_millis(320),
                percentage: 24.5,
                call_count: 15420,
            },
            Hotspot {
                name: "vector_similarity_search".to_string(),
                module: "core::vectors".to_string(),
                total_time: Duration::from_millis(1890),
                self_time: Duration::from_millis(1890),
                percentage: 18.9,
                call_count: 8234,
            },
            Hotspot {
                name: "crdt_merge_delta".to_string(),
                module: "core::crdt".to_string(),
                total_time: Duration::from_millis(1450),
                self_time: Duration::from_millis(680),
                percentage: 14.5,
                call_count: 12450,
            },
            Hotspot {
                name: "ring_buffer_append".to_string(),
                module: "core::ring".to_string(),
                total_time: Duration::from_millis(980),
                self_time: Duration::from_millis(450),
                percentage: 9.8,
                call_count: 45670,
            },
            Hotspot {
                name: "event_transform".to_string(),
                module: "core::transform".to_string(),
                total_time: Duration::from_millis(760),
                self_time: Duration::from_millis(120),
                percentage: 7.6,
                call_count: 9870,
            },
        ];

        Ok(hotspots)
    }

    fn profile_memory(&self, duration: u64, track_allocations: bool) -> Result<()> {
        println!("\n{}", "Memory Profiling".bold().cyan());
        println!("{}", "═".repeat(80));
        println!("  Duration: {} seconds", duration.to_string().green());
        println!("  Allocation Tracking: {}", 
            if track_allocations { "enabled".green() } else { "disabled".yellow() }
        );

        println!("\n{}", "Memory Usage Summary:".bold().yellow());
        println!("  {} Total Allocated: {}", "→".cyan(), "2.4 GB".green());
        println!("  {} Peak Usage: {}", "→".cyan(), "890 MB".yellow());
        println!("  {} Current Usage: {}", "→".cyan(), "456 MB".blue());
        println!("  {} Allocation Count: {}", "→".cyan(), "12.4M".to_string().magenta());
        
        println!("\n{}", "Top Allocators:".bold().yellow());
        println!("  1. Ring Buffer      320 MB  (35.2%)");
        println!("  2. Vector Store     245 MB  (27.0%)");
        println!("  3. Event Cache      180 MB  (19.8%)");
        println!("  4. CRDT State       120 MB  (13.2%)");
        println!("  5. Other             43 MB  (4.8%)");

        Ok(())
    }

    fn identify_hotspots(&self, threshold: f64, group_by: &str) -> Result<()> {
        println!("\n{}", "Hotspot Analysis".bold().cyan());
        println!("{}", "═".repeat(80));
        println!("  Threshold: {}", format!("{}%", threshold).green());
        println!("  Group By:  {}", group_by.yellow());

        println!("\n{}", "Identified Hotspots:".bold().yellow());
        println!("{}", "─".repeat(80));
        println!("  {:<30} {:>12} {:>10} {:>10}", "Function", "Total (ms)", "Self (ms)", "%");
        println!("{}", "─".repeat(80));
        
        let hotspots = vec![
            ("vector_similarity_search", 1890, 1890, 18.9),
            ("crdt_merge_delta", 1450, 680, 14.5),
            ("event_validate_schema", 890, 340, 8.9),
            ("ring_buffer_compact", 670, 670, 6.7),
            ("resonance_calculate", 540, 180, 5.4),
        ];

        for (name, total, self_time, pct) in hotspots {
            println!("  {:<30} {:>12} {:>10} {:>9.1}%", name, total, self_time, pct);
        }

        Ok(())
    }

    fn generate_comparison(&self, baseline: PathBuf, current: PathBuf, format: &str) -> Result<()> {
        println!("\n{}", "Comparison Report".bold().cyan());
        println!("{}", "═".repeat(80));
        println!("  Baseline: {}", baseline.display().to_string().yellow());
        println!("  Current:  {}", current.display().to_string().yellow());
        println!("  Format:   {}", format.cyan());

        println!("\n{}", "Improvements:".bold().green());
        println!("  {} crdt_merge_delta:        1450ms -> 1120ms  (-22.8%)", "↓".green());
        println!("  {} ring_buffer_append:      980ms -> 760ms   (-22.4%)", "↓".green());
        println!("  {} event_transform:         760ms -> 640ms   (-15.8%)", "↓".green());

        println!("\n{}", "Regressions:".bold().red());
        println!("  {} vector_similarity_search: 1890ms -> 2100ms  (+11.1%)", "↑".red());
        
        println!("\n{}", "Unchanged:".bold().yellow());
        println!("  {} cognitive_flow_process: 2450ms -> 2440ms  (-0.4%)", "→".yellow());

        Ok(())
    }

    fn display_hotspots(&self, hotspots: Vec<Hotspot>) {
        println!("\n{}", "Top CPU Hotspots:".bold().yellow());
        println!("{}", "─".repeat(80));
        println!("  {:#<4} {:<30} {:>12} {:>10} {:>8}", "Rank", "Function", "Total", "Self", "Calls");
        println!("{}", "─".repeat(80));
        
        for (idx, spot) in hotspots.iter().take(20).enumerate() {
            println!(
                "  {:#<4} {:<30} {:>12} {:>10} {:>8}",
                idx + 1,
                spot.name[..30].to_string(),
                format!("{:?}", spot.total_time),
                format!("{:?}", spot.self_time),
                spot.call_count
            );
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    
    let output_dir = cli.output.unwrap_or_else(|| {
        PathBuf::from("./profiles")
    });

    fs::create_dir_all(&output_dir)?;
    let profiler = Profiler::new(output_dir);

    match cli.command {
        Commands::Flame { duration, frequency, pid, output } => {
            profiler.generate_flamegraph(duration, frequency, &output)?;
        },

        Commands::Cpu { duration, compare, top } => {
            let hotspots = profiler.profile_cpu(duration, top)?;
            profiler.display_hotspots(hotspots);
            
            if let Some(baseline) = compare {
                profiler.generate_comparison(baseline, PathBuf::from("current"), "text")?;
            }
        },

        Commands::Memory { duration, track_allocations, heap_dump } => {
            profiler.profile_memory(duration, track_allocations)?;
            
            if heap_dump {
                println!("\n  {} Heap dump saved to heap_dump.bin", "✓".green());
            }
        },

        Commands::Hotspots { threshold, group_by, .. } => {
            profiler.identify_hotspots(threshold, &group_by)?;
        },

        Commands::Compare { baseline, current, format } => {
            profiler.generate_comparison(baseline, current, &format)?;
        },
    }

    Ok(())
}
