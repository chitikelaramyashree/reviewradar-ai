# ReviewRadar AI — Frontend

React 19 (Vite) frontend for the ReviewRadar AI project.

---

## Stack

- React 19
- Vite
- Plain CSS (custom properties, dark mode, responsive)

---

## Structure

```
src/
├── App.jsx               # Routes between LandingPage and AnalyzerPage
├── App.css               # All app styles
├── main.jsx              # React entry point
├── index.css             # Base resets only
├── components/
│   ├── LandingPage.jsx   # Hero page with feature overview
│   ├── AnalyzerPage.jsx  # Upload + filter + search + results
│   ├── ResultCard.jsx    # Single review card with sentiment badge
│   └── SummaryCard.jsx   # Single AI insight bullet card
└── utils/
    └── parser.js         # Parses LLM markdown into card data
```

---

## Local Development

```bash
npm install
npm run dev
```

Starts at `http://localhost:5173`. Requires the FastAPI backend running at `http://127.0.0.1:8000`.

---

## Environment Variable

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://127.0.0.1:8000` | FastAPI backend URL |

Create `.env` in this directory if you need to point to a deployed backend:

```
VITE_API_URL=https://your-backend.hf.space
```

---

## Build for Production

```bash
npm run build
```

Output in `dist/`. Deploy to Vercel by setting the root directory to `review-ui`.
