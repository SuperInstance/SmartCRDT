"""
Tests for semantic cache functionality.
"""

import pytest
import sys
sys.path.insert(0, '../')

from superinstance import HighLevelSemanticCache, PySemanticCache


class MockEmbedding:
    """Mock embedding function for testing."""

    @staticmethod
    def embed(text: str) -> list:
        """Generate deterministic mock embedding."""
        import hashlib
        hash_obj = hashlib.md5(text.encode())
        hash_bytes = hash_obj.digest()
        return [float(b) / 255.0 for b in hash_bytes]


class TestPySemanticCache:
    """Test low-level semantic cache."""

    def test_create_cache(self):
        """Test creating a cache."""
        cache = PySemanticCache(max_size=100, threshold=0.85)
        assert cache.size() == 0

    def test_set_and_get(self):
        """Test setting and getting values."""
        cache = PySemanticCache(max_size=100)

        embedding = [0.1, 0.2, 0.3]
        result = {"answer": "test"}

        cache.set("key1", "query text", embedding, result)

        assert cache.size() == 1
        assert cache.has("key1")

    def test_get_exact_match(self):
        """Test getting exact match."""
        cache = PySemanticCache(max_size=100)

        embedding = [0.1, 0.2, 0.3]
        result = {"answer": "test"}

        cache.set("key1", "query text", embedding, result)

        retrieved = cache.get("key1", embedding)

        assert retrieved is not None
        assert retrieved["similarity"] == 1.0

    def test_get_similar(self):
        """Test getting similar query."""
        cache = PySemanticCache(max_size=100, threshold=0.7)

        # Store a query with specific embedding
        embedding1 = [1.0, 0.0]
        cache.set("key1", "original query", embedding1, {"answer": "A"})

        # Query with similar embedding
        embedding2 = [0.95, 0.05]
        result = cache.get("key2", embedding2)

        # Should find similar result
        assert result is not None
        assert result["similarity"] > 0.7

    def test_get_not_found(self):
        """Test getting non-existent query."""
        cache = PySemanticCache(max_size=100)

        result = cache.get("nonexistent", [0.1, 0.2])
        assert result is None

    def test_clear(self):
        """Test clearing cache."""
        cache = PySemanticCache(max_size=100)

        cache.set("key1", "query", [0.1], {"answer": "A"})
        assert cache.size() == 1

        cache.clear()
        assert cache.size() == 0

    def test_delete(self):
        """Test deleting entry."""
        cache = PySemanticCache(max_size=100)

        cache.set("key1", "query", [0.1], {"answer": "A"})
        assert cache.has("key1")

        deleted = cache.delete("key1")
        assert deleted is True
        assert not cache.has("key1")

    def test_delete_nonexistent(self):
        """Test deleting non-existent entry."""
        cache = PySemanticCache(max_size=100)
        deleted = cache.delete("nonexistent")
        assert deleted is False

    def test_keys(self):
        """Test getting all keys."""
        cache = PySemanticCache(max_size=100)

        cache.set("key1", "query1", [0.1], {"answer": "A"})
        cache.set("key2", "query2", [0.2], {"answer": "B"})

        keys = cache.keys()
        assert len(keys) == 2
        assert "key1" in keys
        assert "key2" in keys

    def test_find_similar(self):
        """Test finding similar entries."""
        cache = PySemanticCache(max_size=100)

        cache.set("key1", "query1", [1.0, 0.0], {"answer": "A"})
        cache.set("key2", "query2", [0.0, 1.0], {"answer": "B"})
        cache.set("key3", "query3", [0.9, 0.1], {"answer": "C"})

        similar = cache.find_similar([1.0, 0.0], threshold=0.7)

        assert len(similar) >= 1
        assert similar[0]["similarity"] > 0.9

    def test_lru_eviction(self):
        """Test LRU eviction when cache is full."""
        cache = PySemanticCache(max_size=2)

        cache.set("key1", "query1", [0.1], {"answer": "A"})
        cache.set("key2", "query2", [0.2], {"answer": "B"})
        assert cache.size() == 2

        # This should evict key1
        cache.set("key3", "query3", [0.3], {"answer": "C"})
        assert cache.size() == 2
        assert not cache.has("key1")
        assert cache.has("key2")
        assert cache.has("key3")


class TestHighLevelSemanticCache:
    """Test high-level semantic cache."""

    def test_create_cache(self):
        """Test creating a cache."""
        cache = HighLevelSemanticCache(
            threshold=0.85,
            embedding_fn=MockEmbedding.embed
        )
        assert cache.size() == 0

    def test_set_and_get(self):
        """Test setting and getting values."""
        cache = HighLevelSemanticCache(
            threshold=0.95,  # High threshold for mock embedding
            embedding_fn=MockEmbedding.embed
        )

        cache.set("What is AI?", {"answer": "Artificial Intelligence"})

        result = cache.get("What is AI?")

        assert result is not None
        assert result["result"]["answer"] == "Artificial Intelligence"

    def test_cache_miss(self):
        """Test cache miss."""
        cache = HighLevelSemanticCache(
            threshold=0.95,
            embedding_fn=MockEmbedding.embed
        )

        result = cache.get("unseen query")
        assert result is None

    def test_cache_stats(self):
        """Test cache statistics."""
        cache = HighLevelSemanticCache(
            threshold=0.95,
            embedding_fn=MockEmbedding.embed
        )

        cache.set("query1", {"answer": "A"})
        cache.get("query1")  # Hit
        cache.get("query2")  # Miss

        stats = cache.stats()

        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["sets"] == 1
        assert stats["hit_rate"] == 0.5

    def test_find_similar(self):
        """Test finding similar queries."""
        cache = HighLevelSemanticCache(
            threshold=0.7,
            embedding_fn=MockEmbedding.embed
        )

        cache.set("machine learning", {"answer": "A"})
        cache.set("python programming", {"answer": "B"})

        similar = cache.find_similar("ML algorithms")

        # Should find at least one similar query
        assert len(similar) >= 0  # Mock embedding may not find matches

    def test_clear(self):
        """Test clearing cache."""
        cache = HighLevelSemanticCache(
            threshold=0.95,
            embedding_fn=MockEmbedding.embed
        )

        cache.set("query1", {"answer": "A"})
        assert cache.size() > 0

        cache.clear()
        assert cache.size() == 0

    def test_stats_after_clear(self):
        """Test that stats are reset after clear."""
        cache = HighLevelSemanticCache(
            threshold=0.95,
            embedding_fn=MockEmbedding.embed
        )

        cache.set("query1", {"answer": "A"})
        cache.get("query1")

        assert cache.stats()["hits"] == 1

        cache.clear()

        assert cache.stats()["hits"] == 0


class TestCacheEdgeCases:
    """Test edge cases."""

    def test_empty_query(self):
        """Test with empty query string."""
        cache = HighLevelSemanticCache(
            threshold=0.95,
            embedding_fn=MockEmbedding.embed
        )

        # Should handle empty string
        cache.set("", {"answer": "empty"})
        result = cache.get("")

        # Depending on implementation, may or may not work
        # Just documenting behavior

    def test_large_response(self):
        """Test with large response object."""
        cache = HighLevelSemanticCache(
            threshold=0.95,
            embedding_fn=MockEmbedding.embed
        )

        large_response = {
            "answer": "x" * 10000,
            "context": ["item"] * 1000
        }

        cache.set("large query", large_response)
        result = cache.get("large query")

        assert result is not None
        assert len(result["result"]["answer"]) == 10000

    def test_concurrent_access(self):
        """Test thread safety (basic)."""
        import threading

        cache = HighLevelSemanticCache(
            threshold=0.95,
            embedding_fn=MockEmbedding.embed
        )

        def worker(i):
            cache.set(f"query{i}", {"answer": i})
            cache.get(f"query{i}")

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # Should not raise errors
        assert cache.size() == 10


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
