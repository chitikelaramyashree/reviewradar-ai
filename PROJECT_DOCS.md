# ReviewRadar AI

An AI-powered review analysis system that extracts insights from Amazon customer reviews using semantic search, sentiment filtering, and LLM-based summarization.

---

## What This Project Does

ReviewRadar AI lets you search through thousands of Amazon reviews using natural language. Instead of keyword matching, it understands the *meaning* behind your query and returns the most relevant reviews — then uses a large language model to summarize the key issues into plain-English bullet points.

**Example:** You type `"poor battery life"`. The system finds the most semantically similar reviews, filters for negative sentiment, and returns a 3-point AI summary of what customers are saying about battery performance — even if the reviews themselves never use the phrase "battery life".

---

## The Problem It Solves

Reading thousands of product reviews manually is impractical. Traditional keyword search misses synonyms and misses intent. ReviewRadar AI combines three AI techniques to give you a signal instead of noise:

- Semantic search to find conceptually similar reviews
- Sentiment filtering to surface the right emotional tone
- LLM summarization to compress findings into action points

---

## What is RAG in This Project?

RAG stands for **Retrieval-Augmented Generation**. It is a pattern where a language model is given *retrieved context* rather than being asked to recall facts from memory.

In this project, RAG works as follows:

1. **Retrieve** — FAISS searches 21,000+ pre-embedded Amazon reviews and retrieves the most relevant ones for your query.
2. **Augment** — The top matching reviews are assembled into a text prompt.
3. **Generate** — LLaMA 3 reads those reviews and generates a structured summary.

Without the retrieval step, LLaMA 3 would have no knowledge of this specific review dataset. RAG gives the model real, domain-specific context at query time.

---

## Complete Working Flow

```
User types query
        ↓
React frontend sends POST /search { "query": "..." }
        ↓
Flask backend (app.py) validates the request
        ↓
model.py encodes the query using SentenceTransformer (all-MiniLM-L6-v2)
        ↓
FAISS searches the pre-built index, returns top-15 most similar review indices
        ↓
DistilBERT classifies the sentiment of the query (POSITIVE or NEGATIVE)
        ↓
Reviews with matching sentiment are selected (up to 5)
        ↓
Selected reviews are sent to OpenRouter (LLaMA 3 8B) for summarization
        ↓
Backend returns a structured text response
        ↓
parser.js in the frontend parses the text into structured cards
        ↓
UI renders: sentiment badges, review cards, and AI bullet-point summary
```

---

## Tech Stack

**Backend**
- Python, Flask, Flask-CORS
- Sentence Transformers (`all-MiniLM-L6-v2`)
- FAISS (vector similarity search)
- HuggingFace Transformers (DistilBERT sentiment)
- OpenRouter API (LLaMA 3 8B)

**Frontend**
- React 19 (Vite)
- Plain CSS (custom properties, dark mode, responsive)

---

## Project Structure

```
genAI/
├── backend/
│   ├── app.py               # Flask server — API entry point
│   ├── model.py             # AI pipeline — search, sentiment, summarization
│   ├── requirements.txt     # Python dependencies
│   ├── Amazon_Reviews.csv   # Raw review dataset (~21,000 rows)
│   ├── embeddings.npy       # Pre-computed review embeddings (31MB)
│   ├── faiss.index          # Pre-built FAISS similarity index (31MB)
│   ├── .env                 # Your API key (never commit this)
│   └── .env.example         # Template — shows required variable names only
│
├── review-ui/
│   ├── src/
│   │   ├── App.jsx              # Main app — landing page + analyzer page
│   │   ├── App.css              # All styles (light/dark, responsive)
│   │   ├── main.jsx             # React entry point
│   │   ├── components/
│   │   │   ├── ResultCard.jsx   # Single review card with sentiment badge
│   │   │   └── SummaryCard.jsx  # Single AI insight bullet card
│   │   └── utils/
│   │       └── parser.js        # Parses raw backend text into structured data
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

---

## File Explanations

### Backend

**`app.py`**
Flask server with two routes:
- `POST /search` — validates the incoming JSON request, calls `search_and_summarize`, and returns the result as JSON. Returns descriptive 400/500 errors if validation fails or the pipeline throws.
- `GET /health` — returns `{"status": "ready"}`. Use this to confirm the server has finished loading models.

**`model.py`**
The complete AI pipeline. Loads at startup:
- `SentenceTransformer("all-MiniLM-L6-v2")` — encodes queries into 384-dimensional vectors
- `pipeline("sentiment-analysis")` using DistilBERT — classifies positive/negative sentiment
- Pre-built FAISS index and embeddings from disk

The exported `search_and_summarize(query)` function runs the full RAG loop.

**`requirements.txt`**
All Python packages needed. Install with `pip install -r requirements.txt`.

### Frontend

**`App.jsx`**
Two pages managed by a `page` state variable (`"home"` or `"analyzer"`):
- `LandingPage` — explains the product and shows a "Analyze Reviews" call-to-action button.
- `AnalyzerPage` — the search interface. Sends the query to the backend, receives results, and passes them to `parser.js`. Has a Back button to return to the landing page and a Clear button to reset results.

**`parser.js`**
The backend returns plain text with markers like `🔍 Query:`, `[POSITIVE]`/`[NEGATIVE]` tags, `Top Results:`, and `Summary:`. `parseAIResponse()` uses regex to extract these sections and returns a plain JavaScript object `{ query, results, summary }` that the UI renders from.

**`ResultCard.jsx`**
Renders one review with a color-coded sentiment badge: green for positive, red for negative, grey for neutral.

**`SummaryCard.jsx`**
Renders one AI-generated bullet point. If the LLM included a bold title (markdown `**Title**`), it is displayed as a card heading.

**`App.css`**
CSS custom properties (`--accent`, `--bg-primary`, etc.) drive the entire theme. A `@media (prefers-color-scheme: dark)` block swaps the palette for dark mode automatically. No external CSS library is used.

### Data Files

**`Amazon_Reviews.csv`** (13MB, ~21,000 rows)
The raw dataset. Each row has a `Review Text` column. Loaded once at startup into a Python list. Not queried at search time — only used to retrieve the text content of matching indices returned by FAISS.

**`embeddings.npy`** (31MB)
A NumPy array of shape `[num_reviews, 384]`. Each row is the pre-computed sentence embedding for the corresponding review. Pre-computing avoids re-encoding 21,000 reviews on every request.

**`faiss.index`** (31MB)
A FAISS index built from `embeddings.npy`. Given a query vector, FAISS finds the nearest neighbours in milliseconds across the full dataset without scanning every row.

---

## Environment Variables

### Backend — `backend/.env`

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | API key from openrouter.ai — used to call LLaMA 3 8B for summarization |
| `FLASK_DEBUG` | No | Set to `true` to enable Flask debug mode. Never use in production. |

Copy `.env.example` to `.env` and fill in your key:

```
OPENROUTER_API_KEY=your_key_here
```

### Frontend — `review-ui/.env` (optional)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://127.0.0.1:5000` | Base URL of the Flask backend |

Only needed if you deploy the backend somewhere other than localhost. Create `review-ui/.env`:

```
VITE_API_URL=https://your-deployed-backend.com
```

---

## Installation and Setup

### 1. Clone the repo

```bash
git clone https://github.com/chitikelaramyashree/reviewradar-ai.git
cd reviewradar-ai
```

### 2. Backend setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

# Install all dependencies
pip install -r requirements.txt

# Set up your API key
cp .env.example .env
# Open .env and replace the placeholder with your real OpenRouter key

# Start the server
python app.py
```

The backend starts at `http://127.0.0.1:5000`. The first startup takes **30–90 seconds** while the ML models and index load into memory. Wait for the `* Running on http://127.0.0.1:5000` message before using the UI.

### 3. Frontend setup

Open a second terminal:

```bash
cd review-ui
npm install
npm run dev
```

The UI starts at `http://localhost:5173`. Open that URL in your browser.

---

## Testing the API Directly

```bash
# Confirm the server is ready
curl http://127.0.0.1:5000/health

# Run a search
curl -X POST http://127.0.0.1:5000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "poor delivery experience"}'
```

---

## Known Limitations

- **Slow cold start** — Both ML models load into memory at startup. Expect 30–90 seconds before the first request works.
- **No dataset regeneration script** — If you want to use a different CSV, you must rebuild `embeddings.npy` and `faiss.index` manually.
- **Single dataset** — The reviews come from one Amazon product category. Queries outside that domain will return results but they may not be meaningful.
- **LLM rate limits** — OpenRouter free-tier keys have usage caps. Sustained use may hit limits.
- **Fixed result count** — Always retrieves 15 candidates and shows up to 5. Not configurable from the UI.
- **Large binary files in git** — `embeddings.npy` and `faiss.index` are 31MB each and tracked in git history. Git LFS is the proper solution for this.

---

## Future Improvements

- Sentiment toggle in the UI — let the user choose positive, negative, or both
- Regeneration script — CLI tool to rebuild embeddings and the FAISS index from a new CSV
- Charts — sentiment distribution visualization for search results
- Review count controls — let the user choose how many results to return
- Pagination — load more results without rerunning the search
- Deployment — Render for the backend, Vercel for the frontend
- Git LFS — move large binary files out of regular git tracking
