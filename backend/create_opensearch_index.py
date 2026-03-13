"""Create the OpenSearch forum embeddings index with k-NN mapping.

Run from the ``backend/`` directory after the OpenSearch collection is available:

    python create_opensearch_index.py

Requires:
  - For local OpenSearch: OPENSEARCH_HOST, OPENSEARCH_PORT, OPENSEARCH_USERNAME, etc.
  - For OpenSearch Serverless: OPENSEARCH_SERVERLESS=true, OPENSEARCH_HOST (collection endpoint)

The script is idempotent – it skips index creation if the index already exists.
"""

from __future__ import annotations

from app.core.config import settings
from app.services.opensearch import get_opensearch_client

_INDEX_NAME = "prism-forum-embeddings"

_INDEX_BODY = {
    "settings": {
        "index.knn": True,
    },
    "mappings": {
        "properties": {
            "thread_id": {"type": "keyword"},
            "course_id": {"type": "keyword"},
            "cluster_id": {"type": "keyword"},
            "title": {"type": "text"},
            "content": {"type": "text"},
            "embedding": {
                "type": "knn_vector",
                "dimension": 1536,
                "method": {
                    "engine": "faiss",
                    "name": "hnsw",
                },
            },
            "is_authoritative": {"type": "boolean"},
        }
    },
}


def main() -> None:
    index = settings.OPENSEARCH_FORUM_INDEX
    client = get_opensearch_client()

    if client.indices.exists(index=index):
        print(f"  Index already exists (skipped): {index}")
        return

    client.indices.create(index=index, body=_INDEX_BODY)
    print(f"  Created index: {index}")


if __name__ == "__main__":
    port = 443 if settings.OPENSEARCH_SERVERLESS else settings.OPENSEARCH_PORT
    print(f"Connecting to OpenSearch at: {settings.OPENSEARCH_HOST}:{port}")
    if settings.OPENSEARCH_SERVERLESS:
        print("  Auth: IAM SigV4 (OpenSearch Serverless)")
    main()
    print("Done.")
