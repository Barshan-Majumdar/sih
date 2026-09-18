"""
Vector Semantic Retrieval Module using Sentence Transformers (or Dense TF-IDF vector embeddings) and FAISS.
"""

from typing import List, Tuple, Optional
import numpy as np

try:
    import faiss
    HAS_FAISS = True
except ImportError:
    HAS_FAISS = False

from .models import ScheduleActivity

# Try importing sentence_transformers
try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False

# Try importing sklearn for fallback dense vector generation
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.decomposition import TruncatedSVD
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


def _normalize_l2(x: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(x, axis=1, keepdims=True)
    norm[norm == 0] = 1.0
    return x / norm


class VectorRetriever:
    """
    Semantic vector search retriever using SentenceTransformers (or dense vector embeddings) and FAISS (with numpy fallback).
    """

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.use_sentence_transformers = HAS_SENTENCE_TRANSFORMERS
        self.model = None
        self.activities: List[ScheduleActivity] = []
        self.index = None
        self.embeddings: Optional[np.ndarray] = None
        self.dimension: Optional[int] = None

        # Fallback vectorizer objects
        self._tfidf_vectorizer = None
        self._svd_transformer = None

        if self.use_sentence_transformers:
            try:
                self.model = SentenceTransformer(model_name)
            except Exception:
                self.use_sentence_transformers = False

    def _encode_fallback(self, texts: List[str], fit: bool = False) -> np.ndarray:
        """
        Fallback dense vector encoder using TF-IDF + TruncatedSVD when sentence-transformers is unavailable.
        """
        if not HAS_SKLEARN:
            raise RuntimeError("Neither sentence-transformers nor scikit-learn is available for vector encoding.")

        if fit:
            self._tfidf_vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
            tfidf_matrix = self._tfidf_vectorizer.fit_transform(texts)

            n_components = min(384, tfidf_matrix.shape[1] - 1) if tfidf_matrix.shape[1] > 1 else 1
            if n_components > 0:
                self._svd_transformer = TruncatedSVD(n_components=n_components, random_state=42)
                dense_matrix = self._svd_transformer.fit_transform(tfidf_matrix)
            else:
                dense_matrix = tfidf_matrix.toarray()
            return dense_matrix.astype(np.float32)
        else:
            if not self._tfidf_vectorizer:
                return np.zeros((len(texts), 384), dtype=np.float32)
            tfidf_matrix = self._tfidf_vectorizer.transform(texts)
            if self._svd_transformer:
                dense_matrix = self._svd_transformer.transform(tfidf_matrix)
            else:
                dense_matrix = tfidf_matrix.toarray()
            return dense_matrix.astype(np.float32)

    def fit(self, activities: List[ScheduleActivity]) -> None:
        """
        Encode schedule activities into vector embeddings and index them in FAISS or numpy memory.
        """
        self.activities = list(activities)
        if not self.activities:
            self.index = None
            self.embeddings = None
            return

        texts = [act.to_search_text() for act in self.activities]

        if self.use_sentence_transformers and self.model is not None:
            embeddings = self.model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
            embeddings = embeddings.astype(np.float32)
        else:
            embeddings = self._encode_fallback(texts, fit=True)

        if HAS_FAISS:
            faiss.normalize_L2(embeddings)
            self.dimension = embeddings.shape[1]
            self.index = faiss.IndexFlatIP(self.dimension)
            self.index.add(embeddings)
        else:
            embeddings = _normalize_l2(embeddings)
            self.embeddings = embeddings
            self.dimension = embeddings.shape[1]

    def search(self, query: str, top_k: int = 10) -> List[Tuple[ScheduleActivity, float, int]]:
        """
        Perform vector similarity search for a given query string.
        
        Returns:
            List of tuples: (ScheduleActivity, vector_similarity_score, rank_1_indexed)
        """
        if not self.activities:
            return []

        if HAS_FAISS and not self.index:
            return []
        if not HAS_FAISS and self.embeddings is None:
            return []

        if self.use_sentence_transformers and self.model is not None:
            query_embedding = self.model.encode([query], convert_to_numpy=True, show_progress_bar=False)
            query_embedding = query_embedding.astype(np.float32)
        else:
            query_embedding = self._encode_fallback([query], fit=False)

        actual_k = min(top_k, len(self.activities))

        if HAS_FAISS and self.index is not None:
            faiss.normalize_L2(query_embedding)
            scores, indices = self.index.search(query_embedding, actual_k)
            score_list = scores[0]
            idx_list = indices[0]
        else:
            query_norm = _normalize_l2(query_embedding)
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
