"""
SuperInstance - High-performance native modules for AI applications.

This package provides Python bindings to Rust implementations of:
- Vector operations and similarity search
- Semantic caching for AI responses
- Conflict-free replicated data types (CRDTs)
- Cryptographic primitives

Example:
    >>> import superinstance as si
    >>> # Calculate similarity
    >>> sim = si.cosine_similarity([1.0, 0.0], [1.0, 0.0])
    >>> # Use semantic cache
    >>> cache = si.SemanticCache(threshold=0.85)
    >>> cache.set("key", "query", [0.1, 0.2], {"result": "value"})
"""

__version__ = "0.1.0"

# Import native module
try:
    from .superinstance import *
except ImportError:
    raise ImportError(
        "Failed to import native SuperInstance module. "
        "Please build the Rust extension first. "
        "See: https://github.com/SuperInstance/SmartCRDT/blob/main/python/README.md"
    )

# High-level Python API
from .cache import SemanticCache as HighLevelSemanticCache
from .embeddings import EmbeddingUtils
from .crdt import GCounter, PNCounter, LWWRegister, ORSet
from .crypto import CryptoUtils

__all__ = [
    # Low-level native bindings
    "cosine_similarity",
    "euclidean_distance",
    "dot_product",
    "batch_similarity",
    "PySemanticCache",
    "PyGCounter",
    "PyPNCounter",
    "PyLWWRegister",
    "PyORSet",
    "HashAlgorithm",
    "hash",
    "hash_blake3",
    "hash_sha256",
    "encrypt",
    "decrypt",
    "derive_key",
    "secure_random",
    # High-level Python API
    "HighLevelSemanticCache",
    "EmbeddingUtils",
    "GCounter",
    "PNCounter",
    "LWWRegister",
    "ORSet",
    "CryptoUtils",
]
