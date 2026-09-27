"""
Vector Semantic Retrieval Module using Scikit-Learn TF-IDF dense embeddings (with optional Sentence Transformers fallback) and NumPy vector similarity.
Optimized for low-memory, high-speed execution on resource-constrained deployments (e.g., Render Free Tier).
"""

import os
from typing import List, Tuple, Optional, Any
import numpy as np

TfidfVectorizer: Any = None
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

from .models import ScheduleActivity

USE_ST_ENV = os.getenv("USE_SENTENCE_TRANSFORMERS", "false").lower() in ("true", "1")


def _normalize_l2(x: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(x, axis=-1, keepdims=True)
    norm[norm == 0] = 1.0
    return x / norm


def _to_dense_array(matrix: Any) -> np.ndarray:
    """
    Safely converts a SciPy sparse matrix (or dense array) to a float32 NumPy ndarray.
    Resolves static type checker warnings regarding spmatrix attribute access.
    """
    if hasattr(matrix, "toarray"):
        arr = matrix.toarray()
    elif hasattr(matrix, "todense"):
        arr = np.asarray(matrix.todense())
    else:
        arr = np.asarray(matrix)
    return np.asarray(arr, dtype=np.float32)


class VectorRetriever:
    """
    Lightweight, high-performance semantic vector retriever using TF-IDF sublinear n-gram
    embeddings with L2-normalized cosine similarity via NumPy.
    Supports optional SentenceTransformers fallback when explicitly enabled.
    """

    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        use_sentence_transformers: Optional[bool] = None,
    ):
        self.model_name = model_name
        self.activities: List[ScheduleActivity] = []
        self.embeddings: Optional[np.ndarray] = None
        self.dimension: Optional[int] = None
        self._vectorizer: Optional[Any] = None

        if use_sentence_transformers is None:
            self.use_sentence_transformers = USE_ST_ENV
        else:
            self.use_sentence_transformers = use_sentence_transformers

        self.model = None
        if self.use_sentence_transformers:
            try:
                import importlib
                st_module = importlib.import_module("sentence_transformers")
                st_cls = getattr(st_module, "SentenceTransformer")
                self.model = st_cls(model_name)
            except Exception:
                self.use_sentence_transformers = False

    def fit(self, activities: List[ScheduleActivity]) -> None:
        """
        Encode schedule activities into vector embeddings and index them in memory.
        """
        self.activities = list(activities)
        if not self.activities:
            self.embeddings = None
            self.dimension = None
            self._vectorizer = None
            return

        texts = [act.to_search_text() for act in self.activities]

        if self.use_sentence_transformers and self.model is not None:
            raw_emb = self.model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
            self.embeddings = _normalize_l2(raw_emb.astype(np.float32))
            self.dimension = self.embeddings.shape[1]
        else:
            if not HAS_SKLEARN or TfidfVectorizer is None:
                raise RuntimeError("scikit-learn is required for vector retrieval.")
            vectorizer: Any = TfidfVectorizer(
                ngram_range=(1, 2),
                token_pattern=r"(?u)\b\w+\b",
                sublinear_tf=True,
                norm="l2",
                min_df=1,
            )
            self._vectorizer = vectorizer
            raw_matrix: Any = vectorizer.fit_transform(texts)
            dense_mat = _to_dense_array(raw_matrix)
            self.embeddings = dense_mat
            self.dimension = dense_mat.shape[1]

    def search(self, query: str, top_k: int = 10) -> List[Tuple[ScheduleActivity, float, int]]:
        """
        Perform vector similarity search for a given query string.

        Returns:
            List of tuples: (ScheduleActivity, vector_similarity_score, rank_1_indexed)
        """
        if not self.activities or self.embeddings is None:
            return []

        actual_k = min(top_k, len(self.activities))
        if actual_k <= 0:
            return []

        if self.use_sentence_transformers and self.model is not None:
            query_embedding = self.model.encode([query], convert_to_numpy=True, show_progress_bar=False)
            query_norm = _normalize_l2(query_embedding.astype(np.float32))
        else:
            if self._vectorizer is None:
                return []
            q_raw: Any = self._vectorizer.transform([query])
            q_mat = _to_dense_array(q_raw)
            query_norm = _normalize_l2(q_mat)

        sims = np.dot(self.embeddings, query_norm.T).flatten()
        top_indices = np.argsort(-sims)[:actual_k]
        score_list = sims[top_indices]
        idx_list = top_indices

        results: List[Tuple[ScheduleActivity, float, int]] = []
        for rank_idx, (score, idx) in enumerate(zip(score_list, idx_list), start=1):
            if idx < 0 or idx >= len(self.activities):
                continue
            results.append((self.activities[idx], float(score), rank_idx))

        return results
