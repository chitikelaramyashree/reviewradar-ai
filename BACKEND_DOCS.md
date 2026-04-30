# ReviewRadar AI — Backend Code Documentation

This document explains every part of the backend code in plain English.
It is written to help you understand the project for a viva, project report, or if you are new to Python and AI development.

---

## Table of Contents

1. [What the Backend Does (Overview)](#1-what-the-backend-does-overview)
2. [How the Two Files Work Together](#2-how-the-two-files-work-together)
3. [app.py — Explained](#3-apppy--explained)
4. [model.py — Explained](#4-modelpy--explained)
5. [The Full Pipeline — Step by Step](#5-the-full-pipeline--step-by-step)
6. [Environment Variables Explained](#6-environment-variables-explained)
7. [Key Concepts Explained Simply](#7-key-concepts-explained-simply)
8. [What Happens at Startup vs at Upload vs at Search Time](#8-what-happens-at-startup-vs-at-upload-vs-at-search-time)
9. [Error Handling Explained](#9-error-handling-explained)
10. [Quick Reference — All Functions](#10-quick-reference--all-functions)

---

## 1. What the Backend Does (Overview)

The backend is the "brain" of ReviewRadar AI. The React frontend only shows things on screen — all the AI logic lives in the backend.

The system works in two phases:

**Phase 1 — Upload**
```
User uploads a CSV file
        |
        v
[1] Detect which column contains review text (auto-mapped)
        |
        v
[2] Clean the data (remove empty rows, fix types)
        |
        v
[3] Encode all reviews into number vectors (embeddings)
        |
        v
[4] Build a FAISS index for fast similarity search
        |
        v
[5] Store everything in memory
```

**Phase 2 — Search**
```
User types a query (e.g. "poor delivery")
        |
        v
[1] Embed the query into a number vector
        |
        v
[2] Search the FAISS index (or filter by product first)
        |
        v
[3] Check whether the query is positive or negative (DistilBERT)
        |
        v
[4] Keep reviews that match that sentiment (up to 5)
        |
        v
[5] Send top reviews to LLaMA 3 for summarization
        |
        v
[6] Compute analytics (positive %, negative %, sales insight)
        |
        v
[7] Return { reviews, summary, analytics } to the frontend
```

---

## 2. How the Two Files Work Together

```
app.py                             model.py
------                             --------
Receives HTTP requests             Loads ML models at startup
Validates inputs (Pydantic)        Holds dataset state (custom_state)
POST /upload  ─────────────────>   load_custom_dataset()
                                       detect_columns()
                                       encode all reviews
                                       build FAISS index
              <─────────────────   returns products[]

POST /search  ─────────────────>   search_and_summarize()
                                       embed query
                                       FAISS / product filter
                                       sentiment analysis
                                       LLaMA 3 summary
                                       compute analytics
              <─────────────────   returns { reviews, summary, analytics }

GET /status   ─────────────────>   reads custom_state
              <─────────────────   { dataset_loaded, num_reviews }
```

---

## 3. app.py — Explained

### Imports

```python
from fastapi import FastAPI, HTTPException, UploadFile, File
```
- `FastAPI` — creates the web server
- `HTTPException` — sends error responses with a status code (400, 500, etc.)
- `UploadFile, File` — FastAPI's types for handling file uploads

```python
from pydantic import BaseModel, field_validator
from typing import Optional
```
- `BaseModel` — base class for defining expected request shapes
- `field_validator` — adds custom validation on top of type checking
- `Optional` — marks fields that don't have to be provided

```python
from model import search_and_summarize, load_custom_dataset, custom_state
```
Importing `model.py` causes it to run top-to-bottom immediately — meaning ML models load into memory as soon as the server starts.

```python
import pandas as pd
import io
```
- `pandas` — reads the uploaded CSV bytes into a DataFrame
- `io.BytesIO` — wraps the raw file bytes so pandas can treat them like a file

---

### `POST /upload`

```python
@app.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
```
`async` is used here because reading file bytes from a network request is an I/O operation — `async` lets FastAPI handle other requests while waiting.

**Validation steps:**
1. Checks the file ends with `.csv` — rejects anything else with a 400 error
2. Reads the bytes and parses with pandas — returns a 400 if the file is corrupt
3. Calls `load_custom_dataset(df)` which internally detects columns — if no valid review column is found, a `ValueError` is raised and returned as a 400 error

**Response:**
```json
{ "message": "...", "review_count": 1842, "products": ["A", "B"] }
```

---

### `POST /search`

```python
class SearchRequest(BaseModel):
    query: str
    product_name: Optional[str] = None
```
Defines the expected request body. `product_name` is optional — omitting it means "search all products".

```python
@field_validator("query")
def query_must_not_be_empty(cls, v: str) -> str:
    if not v.strip():
        raise ValueError("Field 'query' must be a non-empty string")
    return v.strip()
```
Rejects blank queries (e.g. just spaces) before the AI pipeline even runs.

**Response:**
```json
{
  "reviews": [{ "sentiment": "negative", "text": "..." }],
  "summary": "* **Issue**: ...",
  "analytics": { "positive_count": 8, "negative_count": 22, ... }
}
```

If no dataset has been uploaded: returns `400 { "error": "No dataset uploaded..." }`.

---

### `GET /status`

```python
@app.get("/status")
def status():
    loaded = custom_state["index"] is not None
    return { "dataset_loaded": loaded, "num_reviews": len(custom_state["reviews"]) if loaded else 0 }
```
Reads directly from `custom_state` in `model.py`. Useful for the frontend to check server state without making a search.

---

### `GET /health`

```python
@app.get("/health")
def health():
    return {"status": "ready"}
```
Returns immediately. Used to confirm the server has started and models have loaded.

---

## 4. model.py — Explained

### Section 1 — API Client and ML Models

```python
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY")
)
```
Creates an OpenAI-compatible client pointed at OpenRouter. OpenRouter provides access to LLaMA 3 without needing Meta's API directly.

```python
model = SentenceTransformer("all-MiniLM-L6-v2")
```
Loads the sentence embedding model. Takes any text and outputs 384 numbers representing its meaning. Two texts with similar meaning produce numerically similar vectors — this is what powers semantic search.

```python
sentiment_model = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
```
Loads a DistilBERT model fine-tuned to classify text as POSITIVE or NEGATIVE. Both models load **once at startup** and stay in memory for the lifetime of the server.

---

### Section 2 — Dataset State

```python
custom_state = {
    "reviews": [],   # list of review text strings
    "df": None,      # cleaned pandas DataFrame
    "embeddings": None,  # numpy array of shape [n, 384]
    "index": None,   # FAISS IndexFlatL2
    "products": [],  # unique product names
}
```
This dictionary is the server's memory for the current dataset. It starts empty. `load_custom_dataset()` fills it. `search_and_summarize()` reads from it. A new upload replaces everything.

---

### Section 3 — Column Detection

```python
_REVIEW_KEYWORDS = ["review", "text", "content", "comment", "feedback"]
_PRODUCT_KEYWORDS = ["product", "category", "item", "title", "name"]
```
Short keyword lists used for **partial matching** — a column is accepted if its normalised name *contains* any keyword. First match across all columns wins.

```python
def _norm(col: str) -> str:
    return col.strip().lower().replace("_", " ").replace("-", " ")
```
Helper that normalises a column name for comparison: lowercase, strip whitespace, convert underscores and hyphens to spaces. For example: `"product_name"` → `"product name"`, `"REVIEW-TEXT"` → `"review text"`.

```python
def detect_columns(df: pd.DataFrame) -> tuple[str, str | None]:
```
**What this does:**
1. Prints all column names found in the uploaded CSV (visible in server logs)
2. Loops through every column; normalises its name with `_norm()`, then checks whether any keyword appears anywhere in that string (substring match)
3. Returns the first column whose normalised name contains a review keyword
4. Raises a `ValueError` with a helpful message if no review column is found
5. Repeats for product keywords — returns `None` if not found (product filtering simply won't be available)
6. Prints the matched column name and its normalised form for each detected column

**Why partial matching instead of exact matching?**
Real-world CSVs use wildly inconsistent column names. Exact matching only caught names like `"review"` or `"text"`. Partial matching catches `"product_name"`, `"ProductName"`, `"item_title"`, `"customer_feedback"`, and more — without needing to enumerate every possible variant.

| Raw column name | Normalised | Matched by keyword |
|---|---|---|
| `product_name` | `product name` | `"product"` |
| `ProductName` | `productname` | `"product"` |
| `PRODUCT` | `product` | `"product"` |
| `category_name` | `category name` | `"category"` |
| `item_name` | `item name` | `"item"` |
| `customer_feedback` | `customer feedback` | `"feedback"` |
| `review_text` | `review text` | `"review"` |

```python
def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
```
**What this does:**
1. Calls `detect_columns()` to get the real column names
2. Selects only those two columns and renames them to `"Review Text"` and `"Product Name"`
3. Coerces values to strings, strips whitespace, replaces blank strings and `"nan"` with `pd.NA`

After this function, the rest of the pipeline can always use `"Review Text"` and `"Product Name"` without knowing what the original column names were.

---

### Section 4 — Building the Dataset Index

```python
def load_custom_dataset(df: pd.DataFrame) -> list:
```
**What this does, step by step:**

```python
df = _normalise_columns(df)
df_clean = df[df["Review Text"].notna()].reset_index(drop=True)
reviews = df_clean["Review Text"].astype(str).tolist()
```
Normalises columns, removes rows with no review text, converts to a Python list.

```python
if not reviews:
    raise ValueError("No valid review rows found after cleaning...")
```
Guards against empty datasets before the expensive encoding step.

```python
embeddings = model.encode(reviews, batch_size=16, show_progress_bar=True)
```
Encodes all reviews into vectors. `batch_size=16` keeps memory usage low on modest hardware (raise to 32/64 on machines with more RAM). This is the most expensive step — done **once per upload**, never per search.

```python
dim = embeddings.shape[1]   # 384 for all-MiniLM-L6-v2
idx = faiss.IndexFlatL2(dim)
idx.add(embeddings)
```
Builds a flat L2 FAISS index. "Flat" means every vector is compared exactly (no approximation). Accurate but fast enough for datasets up to ~100k rows.

```python
products = sorted(df_clean["Product Name"].dropna().unique().tolist())
```
Extracts sorted unique product names (if the column exists).

All results stored in `custom_state` and `products` returned to `app.py`.

---

### Section 5 — Product Filtering

```python
def _product_indices(product_name: str) -> list:
```
Returns the row indices in the DataFrame that match the given product name. Used to build a subset for filtered searches.

```python
def _search_subset(query_emb: np.ndarray, indices: list, k: int) -> list:
```
For product-filtered searches, instead of using the full FAISS index, this function:
1. Extracts only the embeddings for the filtered rows
2. Computes dot-product similarity between the query and that subset
3. Returns the top-k global indices

**Why not use FAISS for this?**
FAISS `IndexFlatL2` doesn't support pre-filtering by a mask. Building a separate FAISS index per product would be wasteful. For a filtered subset, a direct numpy dot-product is simple and fast.

---

### Section 6 — Analytics

```python
def _compute_analytics(sentiments: list) -> dict:
```
Takes a list of `"POSITIVE"` / `"NEGATIVE"` strings and returns:
- Raw counts and percentages
- A business insight based on thresholds:
  - `> 70%` positive → "High potential for increased sales"
  - `40–70%` → "Moderate performance"
  - `< 40%` → "Risk of poor sales"

Analytics are computed over **all retrieved candidate reviews**, not just the 5 displayed. This gives a more representative signal.

---

### Section 7 — LLM Summary

```python
def openrouter_summary(text: str) -> str:
    response = client.chat.completions.create(
        model="meta-llama/llama-3-8b-instruct",
        messages=[
            {"role": "system", "content": "You analyze customer reviews and extract key insights."},
            {"role": "user", "content": "Analyze these reviews and give 3 clear bullet points...\n\n" + text}
        ]
    )
    return response.choices[0].message.content
```
Sends the collected review text to LLaMA 3 via OpenRouter. The `system` message sets the model's persona; the `user` message contains the actual reviews. This is the **prompt engineering** part of the project.

The text is truncated to 2000 characters before sending to stay within token limits and keep API costs low.

---

### Section 8 — Main Search Function

```python
def search_and_summarize(query: str, k: int = 15, product_name: str = None) -> dict:
```

```python
if custom_state["index"] is None:
    raise RuntimeError("No dataset uploaded. Please upload a dataset first.")
```
Hard guard — if no CSV has been uploaded, raises immediately. `app.py` catches this and returns a 400 error.

```python
if product_name:
    p_indices = _product_indices(product_name)
    candidate_indices = _search_subset(query_emb, p_indices, k * 3)
else:
    D, I = index.search(query_emb, min(k * 3, len(reviews)))
    candidate_indices = [i for i in I[0] if i >= 0]
```
Two search paths:
- **With product filter**: use `_search_subset` on the filtered indices
- **Without filter**: use full FAISS index search

`k * 3` (45 candidates by default) gives a large enough pool so that after sentiment filtering, at least 5 reviews of the right sentiment remain.

```python
target_sentiment = sentiment_model(query)[0]["label"]
```
Detects the user's intent. `"poor delivery"` → NEGATIVE; `"great quality"` → POSITIVE. The pipeline then surfaces only reviews matching this intent.

```python
seen_texts = set()

for idx in candidate_indices:
    sentiment = sentiment_model(text[:512])[0]["label"]
    all_sentiments.append(sentiment)
    if sentiment == target_sentiment and len(collected_reviews) < 5:
        normalised = text.strip().lower()
        if normalised in seen_texts:
            continue
        seen_texts.add(normalised)
        collected_reviews.append(...)
        collected_text += text + " "
```
Every candidate review is classified. All sentiments are saved for analytics. Only intent-matching reviews are collected for display (up to 5), with duplicates removed via a `seen_texts` set. The set stores each review text lowercased and stripped — so `"Does the Job"` and `"does the job"` are treated as the same entry and only the first is kept.

---

## 5. The Full Pipeline — Step by Step

### Startup (runs once)
```
uvicorn app:app starts
        |
        v
model.py is imported → runs top to bottom
        |
        v
SentenceTransformer loads (~10–20 sec, downloads ~91MB first time)
DistilBERT loads       (~15–30 sec, downloads ~268MB first time)
        |
        v
custom_state = all None/empty  ← no data loaded yet
        |
        v
"Application startup complete"
```

### Upload Phase (runs once per CSV upload)
```
POST /upload with CSV bytes
        |
        v
pandas reads CSV → DataFrame
        |
        v
detect_columns() → maps real column names to "Review Text" / "Product Name"
        |
        v
_normalise_columns() → renames, cleans, drops empty rows
        |
        v
model.encode(reviews, batch_size=16)  ← encodes all reviews (slow, done once)
        |
        v
faiss.IndexFlatL2 built and populated
        |
        v
custom_state populated with reviews, df, embeddings, index, products
        |
        v
Response: { review_count: 1842, products: [...] }
```

### Search Phase (runs on every query)
```
POST /search { query: "poor delivery", product_name: "ProductA" }
        |
        v
Pydantic validates body
        |
        v
check custom_state["index"] is not None  ← guard
        |
        v
model.encode([query]) → query_embedding (384 numbers)
        |
        v
if product_name → filter indices → dot-product rank
else            → FAISS index.search(query_embedding, 45)
        |
        v
sentiment_model(query) → target_sentiment = "NEGATIVE"
        |
        v
for each of 45 candidates:
    classify sentiment
    if matches target AND count < 5 → collect for display + LLM
        |
        v
openrouter_summary(collected_text[:2000]) → LLaMA 3 response
        |
        v
_compute_analytics(all 45 sentiments) → { positive_%, negative_%, insight }
        |
        v
return { reviews[], summary, analytics{} }
```

---

## 6. Environment Variables Explained

### What is an Environment Variable?

A value stored outside your code — in a file or the OS — that your code reads at runtime. Keeps sensitive information (API keys) out of source code.

### The `.env` File

```
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxx
```

Listed in `.gitignore` — never uploaded to GitHub.

### How it flows

```
backend/.env
        |
        | load_dotenv() reads the file
        v
OS environment variables
        |
        | os.getenv("OPENROUTER_API_KEY")
        v
client = OpenAI(api_key="sk-or-v1-xxxx")
        |
        v
used in every openrouter_summary() call
```

### In deployment (Hugging Face Spaces)

No `.env` file exists. The key is added as a **Secret** in HF Space Settings. HF injects it into the environment, so `os.getenv("OPENROUTER_API_KEY")` works identically.

---

## 7. Key Concepts Explained Simply

### What is a Vector / Embedding?

A computer cannot understand words. An embedding converts text into a list of numbers that captures its *meaning*. Texts with similar meaning produce numerically similar vectors.

```
"bad delivery"   → [0.12, -0.34, 0.87, ...]   (384 numbers)
"slow shipping"  → [0.11, -0.31, 0.85, ...]   (very similar!)
"great product"  → [-0.45, 0.92, -0.12, ...]  (very different)
```

FAISS uses this numeric similarity to find relevant reviews without needing keyword matches.

---

### What is FAISS?

FAISS (Facebook AI Similarity Search) searches through thousands of vectors in milliseconds using optimized data structures. `IndexFlatL2` computes exact L2 (Euclidean) distance between the query vector and every stored vector, returning the closest ones.

---

### What is Sentiment Analysis?

Classifying text as positive or negative. DistilBERT was pre-trained on movie and product reviews and returns:
```
"The product is amazing!" → POSITIVE (99% confidence)
"Broke after one day."    → NEGATIVE (98% confidence)
```

The same model classifies both the query (to detect intent) and each retrieved review (to filter matches).

---

### What is RAG?

RAG = Retrieval-Augmented Generation. Instead of asking LLaMA 3 to recall facts from memory, we retrieve relevant reviews first and inject them into the prompt as context.

```
Step 1 (Retrieve) → FAISS finds relevant reviews
Step 2 (Augment)  → reviews put into the LLM prompt
Step 3 (Generate) → LLaMA 3 summarizes only those reviews
```

Without RAG, LLaMA 3 would generate a generic answer with no connection to your data.

---

### What is Pydantic?

A validation library that checks incoming data automatically. Without it:
```python
query = data.get("query")
if query is None: return error
if not isinstance(query, str): return error
if not query.strip(): return error
```

With Pydantic, all of that is replaced by a class definition. FastAPI reads the class and handles all validation automatically.

---

## 8. What Happens at Startup vs at Upload vs at Search Time

### At Startup (slow — runs once)

| Action | Time |
|---|---|
| Load SentenceTransformer model | ~10–20 sec |
| Load DistilBERT sentiment model | ~15–30 sec |
| **Total** | **~20–60 sec** |

No dataset is loaded. Server is ready but `/search` will return a 400 until a CSV is uploaded.

### At Upload (medium — runs once per CSV)

| Action | Time (1,000 reviews) | Time (20,000 reviews) |
|---|---|---|
| Read CSV with pandas | < 1 sec | ~2 sec |
| Detect and normalise columns | < 1 sec | < 1 sec |
| Encode reviews (batch_size=16) | ~10 sec | ~3–5 min |
| Build FAISS index | < 1 sec | ~2 sec |

The encoding step dominates. Increase `batch_size` if your machine has more RAM.

### At Search Time (fast — runs on every query)

| Action | Time |
|---|---|
| Validate request (Pydantic) | < 1ms |
| Encode query with SentenceTransformer | ~50ms |
| FAISS search (or dot-product filter) | ~5ms |
| Sentiment classify 45 reviews | ~300ms |
| Call OpenRouter LLM API | ~2–5 sec |
| Compute analytics | < 1ms |

The LLM API call dominates search time.

---

## 9. Error Handling Explained

### Upload errors

```
POST /upload
      |
      | Is it a .csv file?
      | No  → 400 "Only CSV files are supported."
      |
      | Can pandas read it?
      | No  → 400 "Failed to read CSV: <reason>"
      |
      | Does it have a review column?
      | No  → 400 "Could not find a review-text column. Columns tried: ... Columns found: ..."
      |
      | Are there any valid rows?
      | No  → 400 "No valid review rows found after cleaning."
      |
      | Everything OK → 200 { review_count, products }
```

### Search errors

```
POST /search
      |
      | Is body valid JSON?
      | No  → 422 Unprocessable Entity (FastAPI automatic)
      |
      | Is query a non-empty string?
      | No  → 422 "Field 'query' must be a non-empty string"
      |
      | Is a dataset loaded?
      | No  → 400 { "error": "No dataset uploaded. Please upload a dataset first." }
      |
      | Does the pipeline crash?
      | Yes → 500 "Search pipeline failed." (full traceback printed to terminal)
      |
      | Everything OK → 200 { reviews, summary, analytics }
```

### HTTP Status Codes Used

| Code | Meaning | When |
|---|---|---|
| 200 | OK | Successful upload or search |
| 400 | Bad Request | Invalid file, missing column, no dataset loaded |
| 422 | Unprocessable Entity | Invalid request body (Pydantic) |
| 500 | Internal Server Error | Unexpected crash in the AI pipeline |

---

## 10. Quick Reference — All Functions

### app.py

| Function / Class | Purpose |
|---|---|
| `SearchRequest` | Pydantic model — validates `query` and optional `product_name` |
| `query_must_not_be_empty()` | Rejects blank or whitespace-only queries |
| `upload_dataset(file)` | `POST /upload` — reads CSV, calls `load_custom_dataset`, returns count + products |
| `search(body)` | `POST /search` — calls `search_and_summarize`, returns structured result |
| `status()` | `GET /status` — returns whether a dataset is loaded |
| `health()` | `GET /health` — confirms server is alive |

### model.py

| Function / Variable | Purpose |
|---|---|
| `model` | SentenceTransformer — converts text to 384-dim vectors |
| `sentiment_model` | DistilBERT pipeline — returns POSITIVE or NEGATIVE |
| `custom_state` | Global dict holding the current dataset, embeddings, and FAISS index |
| `_norm(col)` | Normalises a column name: lowercase, strip, underscores/hyphens → spaces |
| `detect_columns(df)` | Auto-detects review and product columns via partial keyword matching |
| `_normalise_columns(df)` | Renames detected columns to internal names; cleans data |
| `load_custom_dataset(df)` | Encodes reviews + builds FAISS index; called once per upload |
| `_product_indices(name)` | Returns DataFrame row indices matching a product name |
| `_search_subset(emb, indices, k)` | Dot-product similarity search within a subset of embeddings |
| `_compute_analytics(sentiments)` | Calculates sentiment %, counts, and business insight label |
| `openrouter_summary(text)` | Calls LLaMA 3 via OpenRouter, returns bullet-point summary |
| `search_and_summarize(query, product_name)` | Main pipeline — runs full RAG loop, returns structured dict |
