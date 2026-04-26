# ReviewRadar AI

An AI-powered review analysis system that extracts insights from customer reviews using semantic search and LLM-based summarization.

---

## Features

- Semantic search using FAISS
- AI-powered summarization (OpenRouter / LLaMA 3 8B)
- Sentiment filtering (positive/negative)
- Fast retrieval with precomputed embeddings
- Interactive React UI

---

## Tech Stack

**Backend**
- Python
- FastAPI
- Sentence Transformers
- FAISS
- HuggingFace Transformers
- OpenRouter API

**Frontend**
- React 19 (Vite)
- JavaScript
- CSS

---

## Project Structure

```
genAI/
├── backend/
│   ├── app.py               # FastAPI server
│   ├── model.py             # AI pipeline
│   ├── Dockerfile           # For Hugging Face Spaces deployment
│   ├── requirements.txt
│   ├── embeddings.npy
│   ├── faiss.index
│   └── Amazon_Reviews.csv
│
├── review-ui/
│   ├── src/
│   └── package.json
│
└── README.md
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

Backend starts at `http://127.0.0.1:8000`. Wait for `Application startup complete` before using the UI.

### 3. Frontend

Open a second terminal:
```bash
cd review-ui
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## API Docs

FastAPI auto-generates interactive docs at `http://127.0.0.1:8000/docs`.

---

## Deployment

| Part | Platform |
|---|---|
| Backend | Hugging Face Spaces (Docker) — free |
| Frontend | Vercel — free |

See `PROJECT_DOCS.md` for full deployment steps.

---

## Usage

- Open the app and click **Analyze Reviews**
- Type a natural language query: `"poor delivery"`, `"great quality"`, `"bad packaging"`
- View top matching reviews with sentiment labels and an AI-generated summary

---

## Notes

- Uses precomputed embeddings — no re-encoding on each request
- Requires internet only for OpenRouter API calls
- First startup takes 30–90 seconds while ML models load
