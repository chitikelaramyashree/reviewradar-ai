# ReviewRadar AI — Project Documentation

An AI-powered review analysis system. Upload any CSV of customer reviews, ask questions in plain English, and get semantic search, sentiment analysis, product filtering, analytics, and LLM-generated insights.

---

## What This Project Does

ReviewRadar AI lets you analyse any dataset of customer reviews using natural language. Instead of keyword matching, it understands the *meaning* behind your query and returns the most relevant reviews — then uses a large language model to summarize the key issues into plain-English bullet points.

**Example:** You upload a CSV of electronics reviews and type `"poor battery life"`. The system finds the most semantically similar reviews, filters for negative sentiment, and returns a 3-point AI summary of what customers are saying — even if the reviews never use the phrase "battery life". It also shows what percentage of retrieved reviews were positive vs negative and whether the product is at risk of poor sales.

---

## The Problem It Solves

Reading thousands of product reviews manually is impractical. Traditional keyword search misses synonyms and ignores intent. ReviewRadar AI combines four AI techniques to give you a signal instead of noise:

- **Semantic search** — finds reviews that mean the same as your query
- **Sentiment filtering** — surfaces reviews with the right emotional tone
- **LLM summarization** — compresses findings into actionable bullet points
- **Analytics** — gives you a quantified breakdown, not just text

---

## What is RAG in This Project?

RAG stands for **Retrieval-Augmented Generation**. It is a pattern where a language model is given *retrieved context* rather than being asked to recall facts from memory.

In this project, RAG works as follows:

1. **Retrieve** — FAISS searches the uploaded reviews and retrieves the most relevant ones for your query.
2. **Augment** — The top matching reviews are assembled into a text prompt.
3. **Generate** — LLaMA 3 reads those reviews and generates a structured summary.

Without the retrieval step, LLaMA 3 would have no knowledge of your specific dataset. RAG gives the model real, domain-specific context at query time.

---

## Complete Working Flow

### Phase 1 — Upload

```
User uploads CSV
        ↓
FastAPI /upload validates the file
        ↓
pandas reads the CSV into a DataFrame
        ↓
detect_columns() partial-matches column names to "Review Text" / "Product Name"
        ↓
        (normalises: lowercase, strip, underscores/hyphens → spaces; substring match)
        ↓
SentenceTransformer encodes all reviews into 384-dim vectors (batch_size=16)
        ↓
FAISS IndexFlatL2 is built from those vectors
        ↓
Everything stored in memory (custom_state)
        ↓
Response: { review_count, products[] }
```

### Phase 2 — Search

```
User types query + optional product filter
        ↓
React frontend sends POST /search { query, product_name? }
        ↓
FastAPI validates request via Pydantic
        ↓
If product_name: filter dataset indices first, then rank by cosine similarity
If no filter:    FAISS searches full index, returns top candidates
        ↓
DistilBERT classifies the sentiment of the query (POSITIVE or NEGATIVE)
        ↓
Each candidate review is classified; reviews matching query sentiment kept (up to 5, deduped)
        ↓
Selected reviews sent to OpenRouter (LLaMA 3 8B) for summarization
        ↓
Analytics computed over ALL candidates (not just the 5 shown)
        ↓
Backend returns { reviews[], summary, analytics{} }
        ↓
Frontend renders: analytics card, sentiment bar, review cards, AI summary bullets
```

---

## Tech Stack

**Backend**
- Python, FastAPI
- Pydantic (request validation)
- Sentence Transformers (`all-MiniLM-L6-v2`)
- FAISS (vector similarity search)
- HuggingFace Transformers (DistilBERT sentiment)
- OpenRouter API (LLaMA 3 8B)
- Uvicorn / Gunicorn (ASGI server)

**Frontend**
- React 19 (Vite)
- Plain CSS (custom properties, dark mode, responsive)

---

## Project Structure

```
genAI/
├── backend/
│   ├── app.py               # FastAPI server — API entry point
│   ├── model.py             # AI pipeline — column detection, search, sentiment, summarization
│   ├── Dockerfile           # Docker config for Hugging Face Spaces deployment
│   ├── requirements.txt     # Python dependencies
│   ├── .env                 # Your API key (never commit this)
│   └── .env.example         # Template — shows required variable names only
│
├── review-ui/
│   ├── src/
│   │   ├── App.jsx              # Main app — routes between landing and analyzer
│   │   ├── App.css              # All styles (light/dark, responsive)
│   │   ├── main.jsx             # React entry point
│   │   ├── index.css            # Base resets only
│   │   ├── components/
│   │   │   ├── LandingPage.jsx  # Hero page with call-to-action
│   │   │   ├── AnalyzerPage.jsx # Upload + filter + search + results interface
│   │   │   ├── ResultCard.jsx   # Single review card with sentiment badge
│   │   │   └── SummaryCard.jsx  # Single AI insight bullet card
│   │   └── utils/
│   │       └── parser.js        # Parses LLM markdown into structured card data
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── README.md
├── PROJECT_DOCS.md
└── BACKEND_DOCS.md
```

---

## File Explanations

### Backend

**`app.py`**
FastAPI server with four routes:
- `POST /upload` — accepts a CSV file, validates it, calls `load_custom_dataset()`, returns `{ review_count, products[] }`
- `POST /search` — accepts `{ query, product_name? }`, calls `search_and_summarize()`, returns `{ reviews[], summary, analytics{} }`
- `GET /status` — returns `{ dataset_loaded: bool, num_reviews: int }` — useful for checking server state
- `GET /health` — returns `{ status: "ready" }` — used to confirm the server is alive

Interactive API docs are auto-generated at `/docs` (Swagger UI).

**`model.py`**
The complete AI pipeline. Loads at startup:
- `SentenceTransformer("all-MiniLM-L6-v2")` — encodes text into 384-dimensional vectors
- `DistilBERT` sentiment pipeline — classifies positive/negative sentiment

Key functions:
- `detect_columns(df)` — auto-detects review and product columns via partial keyword matching (normalises names: lowercase, strip, underscores/hyphens → spaces; matches if any keyword is a substring)
- `_normalise_columns(df)` — renames detected columns to internal names and cleans data
- `load_custom_dataset(df)` — builds embeddings + FAISS index from uploaded data; called once per upload
- `search_and_summarize(query, product_name)` — runs the full RAG pipeline
- `_compute_analytics(sentiments)` — calculates sentiment breakdown and business insight

**`Dockerfile`**
Docker configuration for deploying to Hugging Face Spaces. Uses Python 3.11 slim, installs dependencies, and starts Uvicorn on port 7860 (required by HF Spaces).

**`requirements.txt`**
All Python dependencies. Key additions vs a standard FastAPI app: `python-multipart` (required for file upload), `sentence-transformers`, `transformers`, `faiss-cpu`, `torch`.

### Frontend

**`AnalyzerPage.jsx`**
The main working interface. Contains three steps:
1. **Upload** — file picker + upload button; shows indexed review count and detected products on success
2. **Filter** — product dropdown (only shown when CSV has a product column); shows "not available" message otherwise
3. **Analyze** — search input + button; both disabled until a dataset is loaded

Results section shows: analytics card (with sentiment bar), key insights (SummaryCards), top reviews (ResultCards).

**`parser.js`**
Exports `parseSummary(text)` — converts the LLM's markdown bullet string into `[{ title, description }]` objects for rendering as `SummaryCard` components.

**`ResultCard.jsx`**
Renders one review with a colour-coded sentiment badge: green for positive, red for negative.

**`SummaryCard.jsx`**
Renders one AI-generated bullet point. Bold markdown titles (`**Title**`) are shown as a card heading.

---

## API Response Formats

### `POST /upload`

```json
{
  "message": "Dataset uploaded and indexed successfully.",
  "review_count": 1842,
  "products": ["ProductA", "ProductB"]
}
```

### `POST /search`

```json
{
  "reviews": [
    { "sentiment": "negative", "text": "The battery died after 2 hours..." }
  ],
  "summary": "* **Short life**: Multiple reviewers report...\n* ...",
  "analytics": {
    "positive_count": 8,
    "negative_count": 22,
    "positive_percentage": 26.7,
    "negative_percentage": 73.3,
    "total_reviews_analyzed": 30,
    "sales_insight": "Risk of poor sales"
  }
}
```

### `GET /status`

```json
{ "dataset_loaded": true, "num_reviews": 1842 }
```

---

## Environment Variables

### Backend — `backend/.env`

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | API key from openrouter.ai — used to call LLaMA 3 8B |

```
OPENROUTER_API_KEY=your_key_here
```

### Frontend — `review-ui/.env` (optional)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://127.0.0.1:8000` | Base URL of the FastAPI backend |

Only needed when the backend is deployed somewhere other than localhost:

```
VITE_API_URL=https://your-deployed-backend.com
```

---

## Installation and Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/chitikelaramyashree/reviewradar-ai.git
cd reviewradar-ai
```

### 2. Backend setup

```bash
cd backend

python -m venv venv
.\venv\Scripts\Activate.ps1      # Windows
# source venv/bin/activate       # macOS / Linux

pip install -r requirements.txt

cp .env.example .env
# Open .env and add your OpenRouter API key

uvicorn app:app --reload
```

The first startup takes **20–60 seconds** while ML models download and load. Wait for `Application startup complete`.

### 3. Frontend setup

```bash
cd review-ui
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## Testing the API Directly

```bash
# Check server is ready
curl http://127.0.0.1:8000/health

# Check dataset status
curl http://127.0.0.1:8000/status

# Upload a CSV
curl -X POST http://127.0.0.1:8000/upload \
  -F "file=@your_reviews.csv"

# Run a search
curl -X POST http://127.0.0.1:8000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "poor delivery experience"}'

# Search with product filter
curl -X POST http://127.0.0.1:8000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "great quality", "product_name": "ProductA"}'
```

---

## Deployment

### Backend — Hugging Face Spaces (free, 16GB RAM)

1. Create a free account at **huggingface.co**
2. Create a new Space → choose **Docker** SDK
3. Clone the Space repo and copy all backend files into it
4. Add `OPENROUTER_API_KEY` as a Secret in Space Settings
5. Push — HF builds and deploys automatically

No large files to track with Git LFS — embeddings are generated at runtime from uploaded data.

Your backend URL: `https://YOUR_USERNAME-reviewradar-backend.hf.space`

> Note: Free tier Spaces sleep after inactivity. First request after sleep takes ~30 seconds to wake.

### Frontend — Vercel (free)

1. Go to **vercel.com** → import your GitHub repo
2. Set root directory to `review-ui`
3. Add environment variable: `VITE_API_URL = https://YOUR_USERNAME-reviewradar-backend.hf.space`
4. Deploy

### Production start command

```bash
gunicorn app:app -k uvicorn.workers.UvicornWorker
```

---

## Known Limitations

- **In-memory only** — uploaded datasets and their indexes are held in RAM. They are lost when the server restarts. Users must re-upload after a restart or cold start.
- **Single concurrent dataset** — the server holds one dataset in memory at a time. A new upload replaces the previous one.
- **Slow cold start** — ML models load at startup. Expect 20–60 seconds before the first request works.
- **LLM rate limits** — OpenRouter free-tier keys have usage caps. Sustained use may hit limits.
- **HF Spaces sleep** — free tier goes to sleep after inactivity, causing ~30 second cold starts.

---

## Future Improvements

- **Persist indexes** — save embeddings + FAISS index to disk or object storage so they survive restarts
- **Multi-user sessions** — per-session dataset isolation instead of a single shared state
- **Sentiment toggle** — let users choose positive, negative, or both in the UI
- **Charts** — sentiment distribution visualization for search results
- **Result count controls** — let users choose how many reviews to return
- **Chunking** — split long reviews into smaller pieces for better retrieval precision
