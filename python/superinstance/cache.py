"""
High-level semantic cache API for Python.

Provides a Pythonic interface to the Rust-based semantic cache with automatic
embedding generation and intelligent caching strategies.
"""

from typing import List, Dict, Any, Optional
import json
import hashlib

try:
    from .superinstance import PySemanticCache
except ImportError:
    raise ImportError(
        "Native module not found. Please build the Rust extension first."
    )


class SemanticCache:
    """
    High-performance semantic cache for AI responses.

    This cache automatically generates embeddings for queries and uses
    similarity search to find cached responses, reducing redundant
    API calls and improving response times.

    Args:
        threshold: Similarity threshold for cache hits (0.0 to 1.0, default: 0.85)
        max_size: Maximum number of cache entries (default: 1000)
        ttl_ms: Time-to-live for cache entries in milliseconds (default: 3600000 = 1 hour)
        embedding_fn: Optional function to generate embeddings (default: None)
                     If None, uses OpenAI's text-embedding-ada-002

    Example:
        >>> cache = SemanticCache(threshold=0.85)
        >>> cache.set("What is AI?", {"answer": "Artificial Intelligence"})
        >>> result = cache.get("What is AI?")
        >>> print(result)  # Returns cached answer if similar enough
    """

    def __init__(
        self,
        threshold: float = 0.85,
        max_size: int = 1000,
        ttl_ms: Optional[int] = 3600000,
        embedding_fn: Optional[callable] = None,
    ):
        self._inner = PySemanticCache(
            max_size=max_size,
            threshold=threshold,
            ttl_ms=ttl_ms,
            num_threads=0,  # Auto-detect
        )
        self._embedding_fn = embedding_fn
        self._stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
        }

    def get(self, query: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached response for a query.

        Args:
            query: The query text to look up

        Returns:
            Cached response dict if found and similarity > threshold, else None

        Example:
            >>> result = cache.get("What is machine learning?")
            >>> if result:
            ...     print(f"Found cached answer (similarity: {result['similarity']})")
            ...     print(result['result'])
        """
        # Generate embedding
        embedding = self._embed(query)
        if embedding is None:
            return None

        # Generate cache key from query
        key = self._hash_key(query)

        # Try to get from cache
        result = self._inner.get(key, embedding)

        if result:
            self._stats["hits"] += 1
            return {
                "result": result["result"],
                "similarity": result["similarity"],
                "query": result["query"],
            }
        else:
            self._stats["misses"] += 1
            return None

    def set(self, query: str, response: Any) -> None:
        """
        Cache a response for a query.

        Args:
            query: The query text
            response: The response to cache (any JSON-serializable type)

        Example:
            >>> cache.set("What is AI?", {
            ...     "answer": "Artificial Intelligence",
            ...     "sources": ["textbook1", "website2"]
            ... })
        """
        # Generate embedding
        embedding = self._embed(query)
        if embedding is None:
            return

        # Generate cache key
        key = self._hash_key(query)

        # Cache the response
        self._inner.set(key, query, embedding, response)
        self._stats["sets"] += 1

    def find_similar(self, query: str, threshold: float = 0.7) -> List[Dict[str, Any]]:
        """
        Find all similar queries in the cache.

        Args:
            query: The query text
            threshold: Minimum similarity threshold (default: 0.7)

        Returns:
            List of dicts with keys: key, query, similarity

        Example:
            >>> similar = cache.find_similar("machine learning")
            >>> for item in similar:
            ...     print(f"{item['query']}: {item['similarity']:.3f}")
        """
        embedding = self._embed(query)
        if embedding is None:
            return []

        return self._inner.find_similar(embedding, threshold)

    def clear(self) -> None:
        """Clear all cache entries."""
        self._inner.clear()
        self._stats = {"hits": 0, "misses": 0, "sets": 0}

    def size(self) -> int:
        """Get current cache size."""
        return self._inner.size()

    def has(self, query: str) -> bool:
        """Check if query exists in cache."""
        key = self._hash_key(query)
        return self._inner.has(key)

    def delete(self, query: str) -> bool:
        """Delete a specific query from cache."""
        key = self._hash_key(query)
        return self._inner.delete(key)

    def keys(self) -> List[str]:
        """Get all cache keys."""
        return self._inner.keys()

    def stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.

        Returns:
            Dict with keys: hits, misses, sets, hit_rate, size
        """
        total_requests = self._stats["hits"] + self._stats["misses"]
        hit_rate = self._stats["hits"] / total_requests if total_requests > 0 else 0.0

        return {
            **self._stats,
            "hit_rate": hit_rate,
            "size": self.size(),
        }

    def _embed(self, text: str) -> Optional[List[float]]:
        """Generate embedding for text."""
        if self._embedding_fn:
            return self._embedding_fn(text)
        else:
            # Default: use OpenAI embeddings
            try:
                import openai

                response = openai.Embedding.create(
                    input=text, model="text-embedding-ada-002"
                )
                return response["data"][0]["embedding"]
            except ImportError:
                raise ImportError(
                    "OpenAI package not installed. "
                    "Either install openai or provide an embedding_fn."
                )
            except Exception as e:
                print(f"Warning: Failed to generate embedding: {e}")
                return None

    @staticmethod
    def _hash_key(text: str) -> str:
        """Generate a cache key from text."""
        return hashlib.sha256(text.encode()).hexdigest()[:32]

    def __repr__(self) -> str:
        return f"SemanticCache(size={self.size()}, stats={self.stats()})"


class VectorCache:
    """
    Simple vector cache with exact matching.

    Useful for caching embeddings themselves or other vector data.

    Args:
        max_size: Maximum cache size (default: 10000)

    Example:
        >>> cache = VectorCache(max_size=10000)
        >>> cache.set("doc1", [0.1, 0.2, 0.3])
        >>> embedding = cache.get("doc1")
    """

    def __init__(self, max_size: int = 10000):
        self._cache: Dict[str, List[float]] = {}
        self._max_size = max_size
        self._lru: List[str] = []

    def get(self, key: str) -> Optional[List[float]]:
        """Get vector by key."""
        if key in self._cache:
            # Update LRU
            self._lru.remove(key)
            self._lru.append(key)
            return self._cache[key]
        return None

    def set(self, key: str, vector: List[float]) -> None:
        """Cache a vector."""
        if key in self._cache:
            # Update existing
            self._cache[key] = vector
            self._lru.remove(key)
            self._lru.append(key)
        else:
            # Add new
            if len(self._cache) >= self._max_size:
                # Evict LRU
                oldest = self._lru.pop(0)
                del self._cache[oldest]
            self._cache[key] = vector
            self._lru.append(key)

    def clear(self) -> None:
        """Clear cache."""
        self._cache.clear()
        self._lru.clear()

    def size(self) -> int:
        """Get cache size."""
        return len(self._cache)

    def __repr__(self) -> str:
        return f"VectorCache(size={self.size()}/{self._max_size})"
