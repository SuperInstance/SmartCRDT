"""
High-level embedding utilities for Python.

Provides convenient wrappers for vector operations and similarity search.
"""

from typing import List, Tuple, Optional
import numpy as np

try:
    from .superinstance import (
        cosine_similarity as _cosine_similarity,
        euclidean_distance as _euclidean_distance,
        dot_product as _dot_product,
        batch_similarity as _batch_similarity,
    )
except ImportError:
    raise ImportError(
        "Native module not found. Please build the Rust extension first."
    )


class EmbeddingUtils:
    """
    Utility functions for working with embeddings.

    Example:
        >>> utils = EmbeddingUtils()
        >>> sim = utils.cosine_similarity([1.0, 0.0], [1.0, 0.0])
        >>> print(sim)  # 1.0
    """

    @staticmethod
    def cosine_similarity(a: List[float], b: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors.

        Args:
            a: First vector
            b: Second vector

        Returns:
            Similarity score between 0.0 and 1.0, where 1.0 means identical

        Raises:
            ValueError: If vectors have different dimensions

        Example:
            >>> EmbeddingUtils.cosine_similarity([1.0, 0.0], [1.0, 0.0])
            1.0
            >>> EmbeddingUtils.cosine_similarity([1.0, 0.0], [0.0, 1.0])
            0.0
        """
        return _cosine_similarity(a, b)

    @staticmethod
    def euclidean_distance(a: List[float], b: List[float]) -> float:
        """
        Calculate Euclidean distance between two vectors.

        Args:
            a: First vector
            b: Second vector

        Returns:
            Distance (lower is more similar)

        Example:
            >>> EmbeddingUtils.euclidean_distance([0.0, 0.0], [3.0, 4.0])
            5.0
        """
        return _euclidean_distance(a, b)

    @staticmethod
    def dot_product(a: List[float], b: List[float]) -> float:
        """
        Calculate dot product of two vectors.

        Args:
            a: First vector
            b: Second vector

        Returns:
            Dot product

        Example:
            >>> EmbeddingUtils.dot_product([1.0, 2.0], [3.0, 4.0])
            11.0
        """
        return _dot_product(a, b)

    @staticmethod
    def batch_similarity(
        query: List[float], documents: List[List[float]]
    ) -> List[float]:
        """
        Calculate similarities between query and multiple documents.

        Args:
            query: Query embedding
            documents: List of document embeddings

        Returns:
            List of similarity scores (same length as documents)

        Example:
            >>> query = [1.0, 0.0]
            >>> docs = [[1.0, 0.0], [0.0, 1.0], [0.707, 0.707]]
            >>> similarities = EmbeddingUtils.batch_similarity(query, docs)
            >>> print(similarities)  # [1.0, 0.0, ~0.707]
        """
        return _batch_similarity(query, documents)

    @staticmethod
    def normalize(vector: List[float]) -> List[float]:
        """
        Normalize a vector to unit length.

        Args:
            vector: Vector to normalize

        Returns:
            Normalized vector

        Example:
            >>> EmbeddingUtils.normalize([3.0, 4.0])
            [0.6, 0.8]
        """
        arr = np.array(vector, dtype=np.float32)
        norm = np.linalg.norm(arr)
        if norm == 0:
            return vector
        return (arr / norm).tolist()

    @staticmethod
    def find_most_similar(
        query: List[float],
        candidates: List[List[float]],
        top_k: int = 5,
    ) -> List[Tuple[int, float]]:
        """
        Find the k most similar vectors to a query.

        Args:
            query: Query embedding
            candidates: List of candidate embeddings
            top_k: Number of results to return

        Returns:
            List of (index, similarity) tuples, sorted by similarity (descending)

        Example:
            >>> query = [1.0, 0.0]
            >>> candidates = [[1.0, 0.0], [0.0, 1.0], [0.9, 0.1]]
            >>> results = EmbeddingUtils.find_most_similar(query, candidates, top_k=2)
            >>> print(results)  # [(0, 1.0), (2, 0.905)]
        """
        similarities = _batch_similarity(query, candidates)

        # Sort by similarity (descending) and get top-k
        indexed = list(enumerate(similarities))
        indexed.sort(key=lambda x: x[1], reverse=True)
        return indexed[:top_k]

    @staticmethod
    def mean_pool(vectors: List[List[float]]) -> List[float]:
        """
        Calculate mean pooling of multiple vectors.

        Args:
            vectors: List of vectors to pool

        Returns:
            Mean-pooled vector

        Example:
            >>> vectors = [[1.0, 2.0], [3.0, 4.0]]
            >>> EmbeddingUtils.mean_pool(vectors)
            [2.0, 3.0]
        """
        if not vectors:
            return []

        arr = np.array(vectors, dtype=np.float32)
        return np.mean(arr, axis=0).tolist()

    @staticmethod
    def max_pool(vectors: List[List[float]]) -> List[float]:
        """
        Calculate max pooling of multiple vectors.

        Args:
            vectors: List of vectors to pool

        Returns:
            Max-pooled vector
        """
        if not vectors:
            return []

        arr = np.array(vectors, dtype=np.float32)
        return np.max(arr, axis=0).tolist()


class HNSWIndex:
    """
    In-memory HNSW (Hierarchical Navigable Small World) index.

    Note: This is a Python wrapper. For production use with large datasets,
    consider using the native Rust implementation or faiss.

    Args:
        dimensions: Embedding dimensions
        max_elements: Maximum number of elements (default: 10000)
        ef_construction: HNSW ef_construction parameter (default: 200)

    Example:
        >>> index = HNSWIndex(dimensions=768, max_elements=10000)
        >>> index.insert(0, [0.1, 0.2, ...])
        >>> results = index.search([0.1, 0.2, ...], k=5)
    """

    def __init__(
        self,
        dimensions: int,
        max_elements: int = 10000,
        ef_construction: int = 200,
    ):
        self.dimensions = dimensions
        self.max_elements = max_elements
        self._vectors: List[List[float]] = []
        self._ids: List[int] = []

    def insert(self, doc_id: int, vector: List[float]) -> None:
        """
        Insert a vector into the index.

        Args:
            doc_id: Document ID
            vector: Embedding vector
        """
        if len(vector) != self.dimensions:
            raise ValueError(f"Expected {self.dimensions} dimensions, got {len(vector)}")

        if len(self._vectors) >= self.max_elements:
            raise IndexError(f"Index full (max_elements={self.max_elements})")

        self._ids.append(doc_id)
        self._vectors.append(vector)

    def search(self, query: List[float], k: int = 5) -> List[Tuple[int, float]]:
        """
        Search for k nearest neighbors.

        Args:
            query: Query embedding
            k: Number of results

        Returns:
            List of (doc_id, similarity) tuples
        """
        if len(query) != self.dimensions:
            raise ValueError(f"Expected {self.dimensions} dimensions, got {len(query)}")

        if not self._vectors:
            return []

        # Calculate similarities to all vectors
        similarities = _batch_similarity(query, self._vectors)

        # Sort and get top-k
        indexed = list(zip(self._ids, similarities))
        indexed.sort(key=lambda x: x[1], reverse=True)
        return indexed[:k]

    def size(self) -> int:
        """Get current index size."""
        return len(self._vectors)

    def __repr__(self) -> str:
        return f"HNSWIndex(size={self.size()}/{self.max_elements}, dim={self.dimensions})"


# Convenience functions
def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    return EmbeddingUtils.cosine_similarity(a, b)


def euclidean_distance(a: List[float], b: List[float]) -> float:
    """Calculate Euclidean distance between two vectors."""
    return EmbeddingUtils.euclidean_distance(a, b)


def dot_product(a: List[float], b: List[float]) -> float:
    """Calculate dot product of two vectors."""
    return EmbeddingUtils.dot_product(a, b)


def batch_similarity(query: List[float], documents: List[List[float]]) -> List[float]:
    """Calculate similarities between query and multiple documents."""
    return EmbeddingUtils.batch_similarity(query, documents)
