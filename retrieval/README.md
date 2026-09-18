# Hybrid Candidate Retrieval Service

The `apps/retrieval` package provides a high-performance **Hybrid Candidate Retrieval** pipeline that matches messy unstructured field evidence (from daily progress notes, site observations, photos/audio transcriptions) with schedule activities from a WBS/schedule hierarchy.

## Features

- **BM25 Keyword Retrieval**: Fast lexical matching using `rank-bm25` (BM25Okapi).
- **Semantic Vector Retrieval**: Dense vector embeddings generated with SentenceTransformers (`all-MiniLM-L6-v2`) and indexed using **FAISS** (`faiss.IndexFlatIP` cosine similarity).
- **Reciprocal Rank Fusion (RRF)**: Merges BM25 lexical ranks ($r_{bm25}$) and FAISS vector semantic ranks ($r_{vec}$) into unified, robust candidate matches:
  $$RRF\_Score(d) = \frac{1}{k + r_{bm25}(d)} + \frac{1}{k + r_{vec}(d)}$$
- **Scored Candidate Matches**: Each candidate includes `bm25_score`, `vector_score`, `rrf_score`, and overall 1-indexed `rank`.

## Architecture & File Structure

```
apps/retrieval/
├── README.md
├── requirements.txt
├── src/
│   ├── __init__.py
│   ├── models.py               # ScheduleActivity, FieldEvidence, CandidateMatch data models
│   ├── bm25_retriever.py       # BM25 lexical keyword retriever
│   ├── vector_retriever.py     # Sentence Transformers + FAISS vector retriever
│   ├── rrf_fusion.py           # Reciprocal Rank Fusion implementation
│   ├── retrieval_service.py    # HybridRetrievalService orchestrator
│   └── sample_data.py          # Sample construction activities, messy evidence & demo runner
└── tests/
    ├── __init__.py
    ├── test_bm25_retriever.py
    ├── test_vector_retriever.py
    ├── test_rrf_fusion.py
    └── test_retrieval_service.py
```

## Quickstart & Usage

### 1. Setup Virtual Environment

```bash
cd retrieval
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Start FastAPI Microservice (Port 8000)

```bash
python -m uvicorn src.server:app --port 8000 --reload
```

### 3. Python Code Usage

```python
from src import HybridRetrievalService, ScheduleActivity

# 1. Instantiate service
service = HybridRetrievalService()

# 2. Index schedule activities
activities = [
    ScheduleActivity(id="act_1", activity_id="ACT-103", name="Foundation Pier P2 Concreting and Pouring"),
    ScheduleActivity(id="act_2", activity_id="ACT-301", name="Stormwater Drainage Pipe Installation L1"),
]
service.index_activities(activities)

# 3. Retrieve candidates for field evidence query
result = service.retrieve_candidates(
    query="completed concreting work for pier P2 today",
    top_k=3
)

for match in result.matches:
    print(f"Rank {match.rank} | Code: {match.activity_code} | RRF Score: {match.rrf_score:.6f}")
    print(f"  BM25: {match.bm25_score:.3f} | Vector: {match.vector_score:.3f}")
```

### 4. Run Sample Demo

```bash
python -m src.sample_data
```

### 5. Run Tests

```bash
pytest tests/ -v
```

