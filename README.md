# 🚀 ReviewRadar AI

An AI-powered review analysis system that extracts insights from customer reviews using semantic search and LLM-based summarization.

---

## 🧠 Features

* 🔍 Semantic search using FAISS
* 🤖 AI-powered summarization (OpenRouter / LLaMA)
* 😊 Sentiment filtering (positive/negative)
* ⚡ Fast retrieval with precomputed embeddings
* 🎨 Interactive React UI

---

## 🛠️ Tech Stack

**Backend**

* Python
* Flask
* Sentence Transformers
* FAISS
* HuggingFace Transformers
* OpenRouter API

**Frontend**

* React (Vite)
* JavaScript
* CSS

---

## 📂 Project Structure

```
genAI/
│
├── backend/
│   ├── app.py
│   ├── model.py
│   ├── embeddings.npy
│   ├── faiss.index
│   ├── Amazon_Reviews.csv
│
├── review-ui/
│   ├── src/
│   ├── package.json
│
└── README.md
```

---

## ⚙️ Setup Instructions

### 1️⃣ Clone Repo

```bash
git clone https://github.com/your-username/reviewradar-ai.git
cd reviewradar-ai
```

---

### 2️⃣ Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env` file:

```
OPENROUTER_API_KEY=your_api_key_here
```

Run:

```bash
python app.py
```

---

### 3️⃣ Frontend Setup

```bash
cd review-ui
npm install
npm run dev
```

---

## 🌐 Usage

* Open: http://localhost:5173
* Enter query like:

  * "poor delivery"
  * "bad service"
* View:

  * Top matching reviews
  * AI-generated summary

---

## ⚡ Notes

* Uses precomputed embeddings (no recomputation needed)
* Works fully locally except LLM summarization
* Requires internet for OpenRouter API

---

## 🚀 Future Improvements

* Better UI/UX (dashboard style)
* Charts for sentiment analysis
* Filtering and sorting
* Deployment (Render / Vercel)

---

