#!/usr/bin/env python3
"""
Semantic Cache Example using SuperInstance.

Demonstrates high-performance semantic caching for AI responses.
"""

import sys
import time
sys.path.insert(0, '../')

from superinstance import HighLevelSemanticCache


def mock_llm_call(query: str) -> dict:
    """Mock LLM API call."""
    # Simulate API latency
    time.sleep(0.1)

    # Return mock response
    return {
        "answer": f"This is a simulated answer for: {query}",
        "model": "mock-gpt-4",
        "tokens": 100,
    }


def main():
    print("=" * 60)
    print("Semantic Cache Example")
    print("=" * 60)
    print()

    # Create cache with custom embedding function
    print("Creating semantic cache...")

    def simple_embedding(text: str) -> list:
        """Very simple mock embedding (not for production!)."""
        # Use character codes as simple embedding
        import hashlib
        hash_obj = hashlib.md5(text.encode())
        hash_bytes = hash_obj.digest()
        return [float(b) / 255.0 for b in hash_bytes]

    cache = HighLevelSemanticCache(
        threshold=0.95,  # High threshold for this simple embedding
        max_size=1000,
        embedding_fn=simple_embedding,
    )

    print(f"Cache created: {cache}")
    print()

    # Test queries
    queries = [
        "What is machine learning?",
        "Explain machine learning",  # Similar query
        "What is artificial intelligence?",
        "How do neural networks work?",
        "What is machine learning?",  # Exact repeat
        "Tell me about ML",  # Abbreviated similar query
    ]

    print("=" * 60)
    print("Processing Queries")
    print("=" * 60)
    print()

    for i, query in enumerate(queries, 1):
        print(f"Query {i}: {query}")

        # Try to get from cache
        result = cache.get(query)

        if result:
            # Cache hit
            print(f"  ✓ CACHE HIT (similarity: {result['similarity']:.3f})")
            print(f"  Answer: {result['result']['answer']}")
        else:
            # Cache miss - call LLM
            print(f"  ✗ Cache miss - calling LLM...")
            start_time = time.time()
            response = mock_llm_call(query)
            elapsed = time.time() - start_time

            # Cache the response
            cache.set(query, response)
            print(f"  Answer: {response['answer']}")
            print(f"  (Took {elapsed:.3f}s)")

        print()

    # Display cache statistics
    print("=" * 60)
    print("Cache Statistics")
    print("=" * 60)
    stats = cache.stats()
    print(f"  Total requests: {stats['hits'] + stats['misses']}")
    print(f"  Cache hits: {stats['hits']}")
    print(f"  Cache misses: {stats['misses']}")
    print(f"  Hit rate: {stats['hit_rate']:.1%}")
    print(f"  Cache size: {stats['size']}")
    print()

    # Demonstrate finding similar queries
    print("=" * 60)
    print("Find Similar Queries")
    print("=" * 60)
    print()

    test_query = "machine learning basics"
    similar = cache.find_similar(test_query, threshold=0.5)

    print(f"Query: '{test_query}'")
    print(f"Found {len(similar)} similar queries in cache:")
    for item in similar:
        print(f"  [{item['similarity']:.3f}] {item['query']}")
    print()

    # Demonstrate cache operations
    print("=" * 60)
    print("Cache Operations")
    print("=" * 60)
    print()

    print(f"Current cache size: {cache.size()}")
    print(f"Cache contains 'What is machine learning?': {cache.has('What is machine learning?')}")

    # Delete a specific entry
    deleted = cache.delete("What is artificial intelligence?")
    print(f"Deleted 'What is artificial intelligence?': {deleted}")
    print(f"New cache size: {cache.size()}")
    print()

    # Get all keys
    print("All cached queries:")
    for key in list(cache.keys())[:5]:  # Show first 5
        print(f"  - {key}")
    if cache.size() > 5:
        print(f"  ... and {cache.size() - 5} more")
    print()

    # Demonstrate cache eviction
    print("=" * 60)
    print("Cache Eviction (LRU)")
    print("=" * 60)
    print()

    # Create a small cache to demonstrate eviction
    small_cache = HighLevelSemanticCache(
        max_size=3,
        threshold=0.95,
        embedding_fn=simple_embedding,
    )

    print("Created cache with max_size=3")
    print()

    # Add 5 entries
    for i in range(5):
        query = f"Query {i+1}"
        response = {"answer": f"Answer {i+1}"}
        small_cache.set(query, response)
        print(f"Added: {query} (size: {small_cache.size()})")

    print()
    print("First entry should have been evicted due to LRU policy")
    print(f"Has 'Query 1': {small_cache.has('Query 1')}")
    print(f"Has 'Query 2': {small_cache.has('Query 2')}")
    print()

    # Clear cache
    print("=" * 60)
    print("Clear Cache")
    print("=" * 60)
    print()

    print(f"Size before clear: {cache.size()}")
    cache.clear()
    print(f"Size after clear: {cache.size()}")
    print()

    print("=" * 60)
    print("Example complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
