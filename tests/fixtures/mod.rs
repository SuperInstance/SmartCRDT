//! Test fixtures for integration tests
//!
//! This module provides sample data and mock implementations for testing.

pub mod sample_embeddings;
pub mod sample_wasm;

pub use sample_embeddings::*;
pub use sample_wasm::*;

use chrono::{DateTime, Utc};

/// Sample log event for archival testing
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SampleLogEvent {
    pub timestamp: DateTime<Utc>,
    pub level: LogLevel,
    pub component: String,
    pub message: String,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize, PartialEq)]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

impl SampleLogEvent {
    pub fn new(level: LogLevel, component: &str, message: &str) -> Self {
        Self {
            timestamp: Utc::now(),
            level,
            component: component.to_string(),
            message: message.to_string(),
            metadata: serde_json::json!({}),
        }
    }

    pub fn with_metadata(mut self, metadata: serde_json::Value) -> Self {
        self.metadata = metadata;
        self
    }
}

/// Generate a sequence of related log events
pub fn generate_event_sequence(count: usize) -> Vec<SampleLogEvent> {
    let mut events = Vec::with_capacity(count);
    for i in 0..count {
        let level = match i % 5 {
            0 => LogLevel::Error,
            1 => LogLevel::Warn,
            2 => LogLevel::Info,
            3 => LogLevel::Debug,
            _ => LogLevel::Trace,
        };
        events.push(SampleLogEvent::new(
            level,
            "test_component",
            &format!("Test event message {}", i),
        ));
    }
    events
}

/// Generate clustered log events (for DBSCAN testing)
pub fn generate_clustered_events() -> Vec<SampleLogEvent> {
    vec![
        SampleLogEvent::new(
            LogLevel::Error,
            "auth",
            "User authentication failed: invalid credentials"
        ),
        SampleLogEvent::new(
            LogLevel::Warn,
            "auth",
            "User authentication failed: account locked"
        ),
        SampleLogEvent::new(
            LogLevel::Error,
            "auth",
            "User authentication failed: password expired"
        ),
        SampleLogEvent::new(
            LogLevel::Info,
            "database",
            "Database connection established"
        ),
        SampleLogEvent::new(
            LogLevel::Debug,
            "database",
            "Query execution time: 15ms"
        ),
    ]
}

/// CRDT state for swarm testing
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub struct TestCrdtState {
    pub node_id: String,
    pub counter: u64,
    pub last_update: DateTime<Utc>,
    pub data: std::collections::HashMap<String, String>,
}

impl TestCrdtState {
    pub fn new(node_id: &str) -> Self {
        Self {
            node_id: node_id.to_string(),
            counter: 0,
            last_update: Utc::now(),
            data: std::collections::HashMap::new(),
        }
    }

    pub fn increment(&mut self) {
        self.counter += 1;
        self.last_update = Utc::now();
    }

    pub fn merge(&mut self, other: &Self) {
        // LWW merge for counter
        if other.last_update > self.last_update {
            self.counter = other.counter;
        }
        // Union merge for data
        for (k, v) in &other.data {
            self.data.entry(k.clone()).or_insert_with(|| v.clone());
        }
    }
}

/// Network partition scenario for testing
#[derive(Debug, Clone)]
pub struct PartitionScenario {
    pub duration_ms: u64,
    pub separated_nodes: Vec<usize>,
}

impl PartitionScenario {
    pub fn new(duration_ms: u64, separated_nodes: Vec<usize>) -> Self {
        Self {
            duration_ms,
            separated_nodes,
        }
    }

    pub fn temporary_partition(duration_ms: u64) -> Self {
        Self::new(duration_ms, vec![1, 2])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sample_log_event() {
        let event = SampleLogEvent::new(LogLevel::Info, "test", "message");
        assert_eq!(event.level, LogLevel::Info);
        assert_eq!(event.component, "test");
    }

    #[test]
    fn test_generate_event_sequence() {
        let events = generate_event_sequence(10);
        assert_eq!(events.len(), 10);
    }

    #[test]
    fn test_crdt_state_merge() {
        let mut state1 = TestCrdtState::new("node1");
        let mut state2 = TestCrdtState::new("node2");

        state1.increment();
        state1.increment();
        state2.increment();

        state1.merge(&state2);

        // Counter should be from the most recent update
        assert!(state1.counter >= 1);
    }
}
