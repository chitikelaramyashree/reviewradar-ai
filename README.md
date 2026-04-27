# ReviewRadar AI

An AI-powered review analysis system. Upload any CSV of customer reviews, ask questions in plain English, and get semantic search results, sentiment analysis, and LLM-generated insights — instantly.

---

## Features

- **Upload any CSV** — no fixed dataset; works with any review data
- **Smart column detection** — automatically maps columns like `review`, `text`, `content` → no manual renaming needed
- **Semantic search** using FAISS + SentenceTransformers
- **Sentiment filtering** — surfaces reviews matching the emotional tone of your query
- **Product filtering** — filter results by product if your CSV has a product column
- **Analytics** — positive %, negative %, total analyzed, and a sales insight label
- **AI summarization** — LLaMA 3 (via OpenRouter) distills findings into 3 bullet points
- **Fully dynamic** — embeddings and FAISS index are built on upload, not at startup

---

## Tech Stack

**Backend**
- Python, FastAPI
- Sentence Transformers (`all-MiniLM-L6-v2`)
- FAISS (vector similarity search)
- HuggingFace Transformers (DistilBERT sentiment)
- OpenRouter API (LLaMA 3 8B)
- Uvicorn / Gunicorn

**Frontend**
- React 19 (Vite)
- JavaScript
- CSS (custom properties, dark mode, responsive)

---

## Project Structure

```
genAI/
├── backend/
│   ├── app.py               # FastAPI server — API entry point
│   ├── model.py             # AI pipeline — search, sentiment, summarization
│   ├── Dockerfile           # For Hugging Face Spaces deployment
│   ├── requirements.txt     # Python dependencies
│   ├── .env                 # Your API key (never commit this)
│   └── .env.example         # Template — required variable names only
│
├── review-ui/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── AnalyzerPage.jsx
│   │   │   ├── ResultCard.jsx
│   │   │   └── SummaryCard.jsx
│   │   └── utils/
│   │       └── parser.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── README.md
├── PROJECT_DOCS.md
└── BACKEND_DOCS.md
```

---

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/chitikelaramyashree/reviewradar-ai.git
cd reviewradar-ai
```

### 2. Backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1       # Windows
# source venv/bin/activate        # macOS / Linux

pip install -r requirements.txt
```

Create `.env`:
```
OPENROUTER_API_KEY=your_api_key_here
```

Run:
```bash
uvicorn app:app --reload
```

Backend starts at `http://127.0.0.1:8000`. The first startup takes **20–60 seconds** while ML models load. Wait for `Application startup complete`.

### 3. Frontend

Open a second terminal:
```bash
cd review-ui
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Usage

1. Open the app and click **Get Started**
2. Upload a CSV file containing customer reviews
3. *(Optional)* Select a product from the dropdown if your CSV has a product column
4. Type a natural language query: `"poor delivery"`, `"great packaging"`, `"battery issues"`
5. View matching reviews with sentiment labels, analytics, and an AI-generated summary

### CSV Format

Your CSV must have a column containing review text. Accepted column names (case-insensitive):

| Review text | Product (optional) |
|---|---|
| `Review Text`, `review`, `text`, `content`, `comment` | `Product Name`, `product`, `category`, `title` |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/upload` | Upload a CSV, build embeddings + FAISS index |
| `POST` | `/search` | Search uploaded reviews, returns results + analytics |
| `GET` | `/status` | Returns `{ dataset_loaded, num_reviews }` |
| `GET` | `/health` | Returns `{ status: "ready" }` |

FastAPI auto-generates interactive docs at `http://127.0.0.1:8000/docs`.

---

## Deployment

| Part | Platform |
|---|---|
| Backend | Hugging Face Spaces (Docker) — free |
| Frontend | Vercel — free |

See `PROJECT_DOCS.md` for full deployment steps.

---

## Notes

- No dataset is preloaded — the system only works after a CSV is uploaded
- ML models (SentenceTransformer + DistilBERT) load once at startup and stay in memory
- Embeddings and FAISS index are built per-upload and held in memory; they are not persisted to disk
- Requires internet only for OpenRouter API calls (LLM summarization)
