#!/usr/bin/env python3
"""
Comprehensive demonstration of all SuperInstance Python features.
"""

import sys
import time
sys.path.insert(0, '../')

from superinstance import (
    # Native functions
    cosine_similarity,
    euclidean_distance,
    batch_similarity,
    # High-level APIs
    EmbeddingUtils,
    HighLevelSemanticCache,
    GCounter,
    PNCounter,
    ORSet,
    CryptoUtils,
    SecureBox,
)


def print_header(title):
    """Print a formatted header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_subheader(title):
    """Print a formatted subheader."""
    print(f"\n{title}")
    print("-" * 70)


def demo_embeddings():
    """Demonstrate embedding utilities."""
    print_header("1. EMBEDDINGS & VECTOR OPERATIONS")

    # Basic similarity
    print_subheader("Similarity Metrics")
    vec1 = [1.0, 0.0, 0.0]
    vec2 = [0.707, 0.707, 0.0]
    vec3 = [0.0, 1.0, 0.0]

    print(f"Vector 1: {vec1}")
    print(f"Vector 2: {vec2}")
    print(f"Vector 3: {vec3}")
    print()
    print(f"Cosine similarity (v1, v1):  {cosine_similarity(vec1, vec1):.4f}")
    print(f"Cosine similarity (v1, v2):  {cosine_similarity(vec1, vec2):.4f}")
    print(f"Cosine similarity (v1, v3):  {cosine_similarity(vec1, vec3):.4f}")
    print(f"Euclidean distance (v1, v3): {euclidean_distance(vec1, vec3):.4f}")

    # Batch similarity
    print_subheader("Batch Similarity Search")
    query = [1.0, 0.0]
    documents = [
        [1.0, 0.0],      # Exact match
        [0.9, 0.1],      # Very similar
        [0.707, 0.707],  # 45 degrees
        [0.0, 1.0],      # Orthogonal
    ]

    similarities = batch_similarity(query, documents)
    print(f"Query: {query}")
    print("Similarities to documents:")
    for i, sim in enumerate(similarities):
        print(f"  Doc {i}: {sim:.4f}")

    # Find most similar
    print_subheader("Find Most Similar")
    results = EmbeddingUtils.find_most_similar(query, documents, top_k=3)
    print(f"Top 3 most similar to {query}:")
    for idx, similarity in results:
        print(f"  [{similarity:.4f}] Document {idx}: {documents[idx]}")

    # Vector operations
    print_subheader("Vector Operations")
    vectors = [[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]]
    mean_pooled = EmbeddingUtils.mean_pool(vectors)
    max_pooled = EmbeddingUtils.max_pool(vectors)
    print(f"Vectors: {vectors}")
    print(f"Mean pooled: {mean_pooled}")
    print(f"Max pooled: {max_pooled}")


def demo_cache():
    """Demonstrate semantic cache."""
    print_header("2. SEMANTIC CACHE")

    # Simple embedding function
    def simple_embed(text):
        import hashlib
        hash_obj = hashlib.md5(text.encode())
        hash_bytes = hash_obj.digest()
        return [float(b) / 255.0 for b in hash_bytes]

    print_subheader("Creating Cache")
    cache = HighLevelSemanticCache(
        threshold=0.95,
        max_size=100,
        embedding_fn=simple_embed,
    )
    print(f"Created: {cache}")

    print_subheader("Cache Operations")
    queries = [
        "What is machine learning?",
        "Explain machine learning",
        "What is artificial intelligence?",
        "How do neural networks work?",
    ]

    for query in queries:
        result = cache.get(query)
        if result:
            print(f"✓ Cache HIT: '{query}' (similarity: {result['similarity']:.3f})")
        else:
            print(f"✗ Cache MISS: '{query}' - caching response")
            cache.set(query, {"answer": f"Answer for: {query}"})

    print_subheader("Cache Statistics")
    stats = cache.stats()
    print(f"Total requests: {stats['hits'] + stats['misses']}")
    print(f"Cache hits: {stats['hits']}")
    print(f"Cache misses: {stats['misses']}")
    print(f"Hit rate: {stats['hit_rate']:.1%}")
    print(f"Cache size: {stats['size']}")

    print_subheader("Find Similar Queries")
    similar = cache.find_similar("ML algorithms", threshold=0.5)
    print(f"Queries similar to 'ML algorithms':")
    for item in similar[:3]:
        print(f"  [{item['similarity']:.3f}] {item['query']}")


def demo_crdt():
    """Demonstrate CRDT operations."""
    print_header("3. CRDT (CONFLICT-FREE REPLICATED DATA TYPES)")

    # G-Counter
    print_subheader("G-Counter (Grow-only Counter)")
    counter1 = GCounter()
    counter2 = GCounter()

    counter1.increment("node1", 5)
    counter2.increment("node2", 3)

    print(f"Counter 1 (node1): {counter1.value()}")
    print(f"Counter 2 (node2): {counter2.value()}")

    counter1.merge(counter2)
    print(f"After merge: {counter1.value()}")

    # PN-Counter
    print_subheader("PN-Counter (Increment/Decrement)")
    counter = PNCounter()
    counter.increment("node1", 10)
    counter.decrement("node1", 3)
    print(f"Value: {counter.value()}")

    # OR-Set
    print_subheader("OR-Set (Observed-Remove Set)")
    set1 = ORSet()
    set2 = ORSet()

    set1.add("doc1", "node1")
    set1.add("doc2", "node1")
    set2.add("doc3", "node2")

    print(f"Set 1: {set1.elements()}")
    print(f"Set 2: {set2.elements()}")

    set1.merge(set2)
    print(f"After merge: {set1.elements()}")
    print(f"Size: {len(set1)}")

    # Set operations
    print(f"Contains 'doc1': {set1.contains('doc1')}")
    print(f"Elements as Python set: {set1.to_set()}")


def demo_crypto():
    """Demonstrate cryptographic operations."""
    print_header("4. CRYPTOGRAPHIC UTILITIES")

    # Hashing
    print_subheader("Hashing")
    data = b"Hello, SuperInstance!"

    blake3_hash = CryptoUtils.hash_blake3(data)
    sha256_hash = CryptoUtils.hash_sha256(data)

    print(f"Data: {data.decode()}")
    print(f"BLAKE3: {blake3_hash.hex()}")
    print(f"SHA256: {sha256_hash.hex()}")

    # Encryption
    print_subheader("Encryption (ChaCha20-Poly1305)")
    plaintext = b"Secret message"

    key = CryptoUtils.generate_key()
    print(f"Key: {key.hex()[:32]}...")

    ciphertext, nonce = CryptoUtils.encrypt(plaintext, key)
    print(f"Ciphertext: {ciphertext.hex()[:32]}...")
    print(f"Nonce: {nonce.hex()}")

    decrypted = CryptoUtils.decrypt(ciphertext, key, nonce)
    print(f"Decrypted: {decrypted.decode()}")

    # Password-based encryption
    print_subheader("Password-Based Encryption")
    box = SecureBox(b"my_secure_password")

    encrypted = box.encrypt(b"Secret data")
    print(f"Encrypted: {encrypted.hex()[:32]}...")

    decrypted = box.decrypt(encrypted)
    print(f"Decrypted: {decrypted.decode()}")

    # Key derivation
    print_subheader("Key Derivation (Argon2)")
    password = b"user_password"
    key, salt = CryptoUtils.derive_key(password)
    print(f"Password: {password.decode()}")
    print(f"Derived key: {key.hex()[:32]}...")
    print(f"Salt: {salt.hex()}")

    # Secure random
    print_subheader("Secure Random")
    random_bytes = CryptoUtils.secure_random(16)
    print(f"Random bytes: {random_bytes.hex()}")


def demo_performance():
    """Demonstrate performance characteristics."""
    print_header("5. PERFORMANCE BENCHMARK")

    # Vector similarity performance
    print_subheader("Vector Similarity (768 dimensions)")
    import random

    vec1 = [random.random() for _ in range(768)]
    vec2 = [random.random() for _ in range(768)]

    iterations = 10000
    start = time.time()

    for _ in range(iterations):
        cosine_similarity(vec1, vec2)

    elapsed = time.time() - start
    per_op = (elapsed / iterations) * 1000  # Convert to ms

    print(f"Iterations: {iterations}")
    print(f"Total time: {elapsed:.3f}s")
    print(f"Time per operation: {per_op:.3f}ms")
    print(f"Operations per second: {iterations/elapsed:.0f}")

    # Cache performance
    print_subheader("Semantic Cache Throughput")

    def simple_embed(text):
        import hashlib
        h = hashlib.md5(text.encode()).digest()
        return [float(b) / 255.0 for b in h]

    cache = HighLevelSemanticCache(threshold=0.95, embedding_fn=simple_embed)

    # Warm up cache
    for i in range(100):
        cache.set(f"query_{i}", {"result": i})

    # Benchmark gets
    start = time.time()
    hits = 0

    for i in range(10000):
        if cache.get(f"query_{i % 100}"):
            hits += 1

    elapsed = time.time() - start
    throughput = 10000 / elapsed

    print(f"Cache lookups: 10000")
    print(f"Cache hits: {hits}")
    print(f"Total time: {elapsed:.3f}s")
    print(f"Throughput: {throughput:.0f} ops/sec")


def main():
    """Run all demonstrations."""
    print("\n" + "=" * 70)
    print("  SUPERINSTANCE PYTHON - COMPREHENSIVE DEMONSTRATION")
    print("=" * 70)
    print("\nThis demo showcases all SuperInstance Python features:")
    print("  1. Embeddings & Vector Operations")
    print("  2. Semantic Cache")
    print("  3. CRDTs (Distributed Data Structures)")
    print("  4. Cryptographic Utilities")
    print("  5. Performance Benchmarks")

    try:
        demo_embeddings()
        demo_cache()
        demo_crdt()
        demo_crypto()
        demo_performance()

        print("\n" + "=" * 70)
        print("  DEMONSTRATION COMPLETE")
        print("=" * 70)
        print("\nAll features working correctly!")
        print("\nFor more examples, see:")
        print("  - python/examples/semantic_search.py")
        print("  - python/examples/vector_cache.py")
        print("  - python/examples/crdt_sync.py")
        print()

    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
