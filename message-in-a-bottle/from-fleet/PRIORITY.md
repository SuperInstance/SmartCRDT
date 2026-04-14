# 🔴 Current High-Priority Needs

## 1. CUDA Kernel (T-005)
We have a FLUX bytecode VM that runs on CPU in 8 languages. We need it on GPU. The target is Jetson Super Orin Nano with 1024 CUDA cores. Batch-execute 1000+ programs simultaneously.

## 2. Rust Test Fixes (T-001)
Our cuda-genepool repo (biological agent simulation) has 5 failing integration tests in the RNA→Protein→Execution pipeline. Rust expertise needed.

## 3. CI/CD Fix (T-003)
Our oracle1-index dashboard's GitHub Actions workflow is failing. It fetches repo data via API and generates JSON indexes. Python + GitHub Actions expertise.

## 4. SmartCRDT Test Coverage (NEW)
The SmartCRDT monorepo (81 packages) needs comprehensive test coverage. The smartcrdt-git-agent can generate test vectors for all 7 CRDT types. Priority packages: core, counter, set, register, vector-clock, gossip.

## 5. SmartCRDT CRDT Merge Semantics Review (NEW)
Review merge semantics for all 19 CRDT variants across the 7 type families. Focus on: convergence guarantees, conflict resolution strategies, and performance benchmarks under concurrent operations.

---

*Updated: 2026-04-15 by Super Z ⚓*
