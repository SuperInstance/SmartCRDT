#!/usr/bin/env python3
"""
Semantic Search Example using SuperInstance.

Demonstrates high-performance vector similarity search for semantic search.
"""

import sys
sys.path.insert(0, '../')

from superinstance import EmbeddingUtils, HNSWIndex, batch_similarity


def mock_embedding(text: str) -> list:
    """
    Mock embedding function.
    In production, use OpenAI, Sentence Transformers, or similar.
    """
    # Simple hash-based mock embedding (not for production!)
    import hashlib
    hash_obj = hashlib.sha256(text.encode())
    hash_bytes = hash_obj.digest()

    # Convert to 768-dimensional vector (OpenAI ada-002 size)
    # Pad or truncate to 768 dimensions
    values = [float(b) / 255.0 for b in hash_bytes]
    if len(values) < 768:
        values.extend([0.0] * (768 - len(values)))
    return values[:768]


def main():
    print("=" * 60)
    print("Semantic Search Example")
    print("=" * 60)
    print()

    # Sample documents
    documents = [
        "Machine learning is a subset of artificial intelligence.",
        "Python is a popular programming language for data science.",
        "Rust provides memory safety and high performance.",
        "Natural language processing enables computers to understand text.",
        "Deep learning uses neural networks with multiple layers.",
        "JavaScript is commonly used for web development.",
        "CRDTs enable conflict-free replicated data types.",
        "Vector databases enable efficient similarity search.",
        "Transformers revolutionized natural language processing.",
        "Semantic search finds meaning beyond keyword matching.",
    ]

    print("Creating embeddings for documents...")
    embeddings = [mock_embedding(doc) for doc in documents]

    # Create HNSW index
    print("\nBuilding HNSW index...")
    index = HNSWIndex(dimensions=768, max_elements=10000)
    for i, emb in enumerate(embeddings):
        index.insert(i, emb)
    print(f"Index size: {index.size()}")

    # Sample queries
    queries = [
        "AI and neural networks",
        "Programming languages",
        "Database search",
    ]

    print("\n" + "=" * 60)
    print("Search Results")
    print("=" * 60)

    for query in queries:
        print(f"\nQuery: '{query}'")
        print("-" * 60)

        # Generate query embedding
        query_emb = mock_embedding(query)

        # Search
        results = index.search(query_emb, k=3)

        # Display results
        for doc_id, similarity in results:
            print(f"  [{similarity:.3f}] {documents[doc_id]}")

    # Demonstrate batch similarity
    print("\n" + "=" * 60)
    print("Batch Similarity Example")
    print("=" * 60)

    query = "artificial intelligence and machine learning"
    query_emb = mock_embedding(query)

    print(f"\nQuery: '{query}'")
    print(f"Calculating similarities to all {len(documents)} documents...")

    similarities = batch_similarity(query_emb, embeddings)

    # Sort by similarity
    ranked = sorted(enumerate(similarities), key=lambda x: x[1], reverse=True)

    print("\nTop 5 results:")
    for doc_id, similarity in ranked[:5]:
        print(f"  [{similarity:.3f}] {documents[doc_id]}")

    # Demonstrate embedding utilities
    print("\n" + "=" * 60)
    print("Embedding Utilities")
    print("=" * 60)

    vec1 = [1.0, 0.0, 0.0]
    vec2 = [0.707, 0.707, 0.0]
    vec3 = [0.0, 1.0, 0.0]

    print(f"\nVector 1: {vec1}")
    print(f"Vector 2: {vec2}")
    print(f"Vector 3: {vec3}")

    print(f"\nCosine similarity (v1, v1): {EmbeddingUtils.cosine_similarity(vec1, vec1):.3f}")
    print(f"Cosine similarity (v1, v2): {EmbeddingUtils.cosine_similarity(vec1, vec2):.3f}")
    print(f"Cosine similarity (v1, v3): {EmbeddingUtils.cosine_similarity(vec1, vec3):.3f}")

    print(f"\nEuclidean distance (v1, v3): {EmbeddingUtils.euclidean_distance(vec1, vec3):.3f}")

    # Demonstrate find_most_similar
    print("\n" + "=" * 60)
    print("Find Most Similar")
    print("=" * 60)

    candidates = [
        [1.0, 0.0, 0.0],  # Exact match
        [0.9, 0.1, 0.0],  # Very similar
        [0.7, 0.7, 0.0],  # Somewhat similar
        [0.0, 1.0, 0.0],  # Orthogonal
        [0.0, 0.0, 1.0],  # Different dimension
    ]

    query_vec = [1.0, 0.0, 0.0]
    results = EmbeddingUtils.find_most_similar(query_vec, candidates, top_k=3)

    print(f"\nQuery: {query_vec}")
    print("Top 3 most similar:")
    for idx, similarity in results:
        print(f"  [{similarity:.3f}] {candidates[idx]}")

    print("\n" + "=" * 60)
    print("Example complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
