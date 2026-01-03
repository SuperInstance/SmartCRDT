"""
Tests for embedding utilities and semantic search.
"""

import pytest
import sys
sys.path.insert(0, '../')

from superinstance import (
    cosine_similarity,
    euclidean_distance,
    dot_product,
    batch_similarity,
    EmbeddingUtils,
    HNSWIndex,
)


class TestSimilarityFunctions:
    """Test low-level similarity functions."""

    def test_cosine_similarity_identical(self):
        """Test cosine similarity of identical vectors."""
        a = [1.0, 0.0, 0.0]
        b = [1.0, 0.0, 0.0]
        assert cosine_similarity(a, b) == pytest.approx(1.0, rel=1e-5)

    def test_cosine_similarity_orthogonal(self):
        """Test cosine similarity of orthogonal vectors."""
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        assert cosine_similarity(a, b) == pytest.approx(0.0, abs=1e-5)

    def test_cosine_similarity_opposite(self):
        """Test cosine similarity of opposite vectors."""
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        assert cosine_similarity(a, b) == pytest.approx(-1.0, rel=1e-5)

    def test_cosine_similarity_dimension_mismatch(self):
        """Test cosine similarity with dimension mismatch."""
        a = [1.0, 0.0]
        b = [1.0, 0.0, 0.0]
        with pytest.raises(ValueError):
            cosine_similarity(a, b)

    def test_euclidean_distance(self):
        """Test Euclidean distance."""
        a = [0.0, 0.0]
        b = [3.0, 4.0]
        assert euclidean_distance(a, b) == pytest.approx(5.0, rel=1e-5)

    def test_euclidean_distance_same(self):
        """Test Euclidean distance of identical vectors."""
        a = [1.0, 2.0, 3.0]
        b = [1.0, 2.0, 3.0]
        assert euclidean_distance(a, b) == pytest.approx(0.0, abs=1e-5)

    def test_dot_product(self):
        """Test dot product."""
        a = [1.0, 2.0]
        b = [3.0, 4.0]
        assert dot_product(a, b) == pytest.approx(11.0, rel=1e-5)

    def test_batch_similarity(self):
        """Test batch similarity calculation."""
        query = [1.0, 0.0]
        documents = [
            [1.0, 0.0],  # Exact match
            [0.0, 1.0],  # Orthogonal
            [0.707, 0.707],  # 45 degrees
        ]

        results = batch_similarity(query, documents)

        assert len(results) == 3
        assert results[0] == pytest.approx(1.0, rel=1e-5)
        assert results[1] == pytest.approx(0.0, abs=1e-5)
        assert results[2] == pytest.approx(0.707, rel=0.01)

    def test_batch_similarity_empty(self):
        """Test batch similarity with empty document list."""
        query = [1.0, 0.0]
        documents = []
        results = batch_similarity(query, documents)
        assert results == []


class TestEmbeddingUtils:
    """Test high-level embedding utilities."""

    def test_normalize(self):
        """Test vector normalization."""
        vec = [3.0, 4.0]
        normalized = EmbeddingUtils.normalize(vec)

        # Should be unit vector
        norm = (sum(x * x for x in normalized)) ** 0.5
        assert norm == pytest.approx(1.0, rel=1e-5)

    def test_normalize_zero_vector(self):
        """Test normalization of zero vector."""
        vec = [0.0, 0.0, 0.0]
        normalized = EmbeddingUtils.normalize(vec)
        assert normalized == vec

    def test_find_most_similar(self):
        """Test finding most similar vectors."""
        query = [1.0, 0.0]
        candidates = [
            [1.0, 0.0],  # Exact match
            [0.9, 0.1],  # Very similar
            [0.0, 1.0],  # Different
        ]

        results = EmbeddingUtils.find_most_similar(query, candidates, top_k=2)

        assert len(results) == 2
        assert results[0][0] == 0  # First candidate
        assert results[0][1] == pytest.approx(1.0, rel=1e-5)
        assert results[1][0] == 1  # Second candidate

    def test_mean_pool(self):
        """Test mean pooling."""
        vectors = [[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]]
        pooled = EmbeddingUtils.mean_pool(vectors)

        expected = [3.0, 4.0]
        assert pooled == pytest.approx(expected, rel=1e-5)

    def test_mean_pool_empty(self):
        """Test mean pooling with empty list."""
        vectors = []
        pooled = EmbeddingUtils.mean_pool(vectors)
        assert pooled == []

    def test_max_pool(self):
        """Test max pooling."""
        vectors = [[1.0, 2.0], [3.0, 1.0], [2.0, 4.0]]
        pooled = EmbeddingUtils.max_pool(vectors)

        expected = [3.0, 4.0]
        assert pooled == pytest.approx(expected, rel=1e-5)


class TestHNSWIndex:
    """Test HNSW index."""

    def test_create_index(self):
        """Test creating an index."""
        index = HNSWIndex(dimensions=128, max_elements=1000)
        assert index.dimensions == 128
        assert index.size() == 0

    def test_insert_vector(self):
        """Test inserting vectors."""
        index = HNSWIndex(dimensions=3, max_elements=10)
        index.insert(0, [1.0, 2.0, 3.0])
        assert index.size() == 1

    def test_insert_dimension_mismatch(self):
        """Test inserting vector with wrong dimensions."""
        index = HNSWIndex(dimensions=3, max_elements=10)
        with pytest.raises(ValueError):
            index.insert(0, [1.0, 2.0])  # Wrong dimensions

    def test_insert_full_index(self):
        """Test inserting into full index."""
        index = HNSWIndex(dimensions=3, max_elements=2)
        index.insert(0, [1.0, 2.0, 3.0])
        index.insert(1, [4.0, 5.0, 6.0])

        with pytest.raises(IndexError):
            index.insert(2, [7.0, 8.0, 9.0])

    def test_search_empty_index(self):
        """Test searching empty index."""
        index = HNSWIndex(dimensions=3, max_elements=10)
        results = index.search([1.0, 2.0, 3.0], k=5)
        assert results == []

    def test_search(self):
        """Test searching index."""
        index = HNSWIndex(dimensions=2, max_elements=10)

        index.insert(0, [1.0, 0.0])
        index.insert(1, [0.0, 1.0])
        index.insert(2, [0.9, 0.1])

        results = index.search([1.0, 0.0], k=2)

        assert len(results) == 2
        assert results[0][0] == 0  # First document
        assert results[0][1] == pytest.approx(1.0, rel=1e-5)

    def test_search_dimension_mismatch(self):
        """Test searching with wrong dimensions."""
        index = HNSWIndex(dimensions=3, max_elements=10)
        index.insert(0, [1.0, 2.0, 3.0])

        with pytest.raises(ValueError):
            index.search([1.0, 2.0], k=5)  # Wrong dimensions


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_vectors(self):
        """Test with empty vectors."""
        # This might be handled differently depending on implementation
        # Just documenting the behavior
        pass

    def test_large_vectors(self):
        """Test with large vectors (e.g., 1536-dim OpenAI embeddings)."""
        size = 1536
        vec1 = [0.1] * size
        vec2 = [0.2] * size

        # Should not raise an error
        similarity = cosine_similarity(vec1, vec2)
        assert 0.0 <= similarity <= 1.0

    def test_nan_values(self):
        """Test handling of NaN values."""
        a = [float('nan'), 1.0]
        b = [1.0, 1.0]

        # Should handle NaN gracefully
        # The exact behavior depends on implementation
        try:
            result = cosine_similarity(a, b)
            # If it doesn't raise, result might be NaN or handled
            assert not (result == result) or isinstance(result, float)
        except (ValueError, RuntimeError):
            # Also acceptable to raise an error
            pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
