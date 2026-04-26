# ReviewRadar AI — Backend Code Documentation

This document explains every line of the backend code in plain English.
It is written to help you understand the project for a viva, project report, or if you are new to Python and AI development.

---

## Table of Contents

1. [What the Backend Does (Overview)](#1-what-the-backend-does-overview)
2. [How the Two Files Work Together](#2-how-the-two-files-work-together)
3. [app.py — Line by Line](#3-apppy--line-by-line)
4. [model.py — Line by Line](#4-modelpy--line-by-line)
5. [The Full Pipeline — Step by Step](#5-the-full-pipeline--step-by-step)
6. [Environment Variables Explained](#6-environment-variables-explained)
7. [Key Concepts Explained Simply](#7-key-concepts-explained-simply)
8. [What Happens at Startup vs at Search Time](#8-what-happens-at-startup-vs-at-search-time)
9. [Error Handling Explained](#9-error-handling-explained)
10. [Quick Reference — All Functions](#10-quick-reference--all-functions)

---

## 1. What the Backend Does (Overview)

The backend is the "brain" of ReviewRadar AI. The React frontend only shows things on screen — it does not do any AI work. All the intelligence lives in the backend.

When a user types a query like `"poor delivery"` and clicks Analyze, this is what the backend does:

```
User query ("poor delivery")
        |
        v
[1] Convert query into a number vector (embedding)
        |
        v
[2] Search 21,000 reviews for the most similar ones (FAISS)
        |
        v
[3] Check whether the query is positive or negative (DistilBERT)
        |
        v
[4] Keep only reviews that match that sentiment
        |
        v
[5] Send the top 5 reviews to an LLM (LLaMA 3) for summarization
        |
        v
[6] Return the results + summary back to the frontend
```

---

## 2. How the Two Files Work Together

```
app.py                          model.py
------                          --------
Receives HTTP request           Loads all AI models at startup
Validates the input             Runs the search pipeline
Calls search_and_summarize() -->  search_and_summarize()
Returns JSON response               encodes query
                                    searches FAISS index
                                    filters by sentiment
                                    calls OpenRouter LLM
                                <-- returns result string
```

- `app.py` is the **entry point** — it handles HTTP communication
- `model.py` is the **engine** — it handles all the AI logic

---

## 3. app.py — Line by Line

```python
from fastapi import FastAPI, HTTPException
```
**What this does:** Imports two things from the FastAPI library.
- `FastAPI` — the main class used to create the web server
- `HTTPException` — used to send error responses with a status code (like 400 or 500)

---

```python
from fastapi.middleware.cors import CORSMiddleware
```
**What this does:** Imports CORS middleware.

**What is CORS?**
CORS stands for Cross-Origin Resource Sharing. When the React frontend (running on `localhost:5173`) tries to call the backend (running on `localhost:8000`), the browser blocks it by default because they are on different ports (different "origins"). CORSMiddleware tells the browser: "It's okay, allow requests from anywhere."

---

```python
from pydantic import BaseModel, field_validator
```
**What this does:** Imports two things from Pydantic (a data validation library).
- `BaseModel` — a base class used to define what shape the incoming request data should have
- `field_validator` — a decorator used to add custom validation rules on top of the basic type check

---

```python
from model import search_and_summarize
```
**What this does:** Imports the main AI function from `model.py`. This line causes `model.py` to run from top to bottom immediately — meaning all models load into memory as soon as the server starts.

---

```python
import traceback
```
**What this does:** Imports the traceback module. When an unexpected error happens inside a function, `traceback.print_exc()` prints the full error details to the terminal so the developer can debug it.

---

```python
app = FastAPI(
    title="ReviewRadar AI",
    description="Semantic retrieval and analysis system for Amazon product reviews",
)
```
**What this does:** Creates the FastAPI application instance. The `title` and `description` appear in the auto-generated documentation at `/docs`.

---

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```
**What this does:** Attaches the CORS middleware to the app.
- `allow_origins=["*"]` — allow requests from any domain (the `*` means "all")
- `allow_methods=["*"]` — allow any HTTP method (GET, POST, etc.)
- `allow_headers=["*"]` — allow any request headers

This is what allows the React frontend to communicate with the backend without the browser blocking it.

---

```python
class SearchRequest(BaseModel):
    query: str
```
**What this does:** Defines the expected shape of the request body. When a POST request comes in, FastAPI will automatically check that the body contains a field called `query` and that it is a string. If it is missing or the wrong type, FastAPI returns a 422 error automatically — no manual checking needed.

---

```python
    @field_validator("query")
    @classmethod
    def query_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Field 'query' must be a non-empty string")
        return v.strip()
```
**What this does:** Adds a custom validation rule on top of the basic type check.
- `@field_validator("query")` — this function runs whenever the `query` field is being validated
- `@classmethod` — required by Pydantic for validators
- `v` — the value of the `query` field
- `v.strip()` — removes leading and trailing whitespace
- `if not v.strip()` — if the query is blank spaces only (e.g. `"   "`), treat it as empty and reject it
- `return v.strip()` — if valid, return the cleaned version (whitespace trimmed)

**Why this matters:** Without this, a user could send `"   "` (just spaces) as a query, which would cause the AI pipeline to behave unexpectedly.

---

```python
@app.post("/search")
def search(body: SearchRequest):
```
**What this does:** Creates a POST endpoint at `/search`. When the frontend sends a POST request to `http://127.0.0.1:8000/search`, this function runs. FastAPI automatically reads the request body, validates it using `SearchRequest`, and passes the result as `body`.

---

```python
    try:
        result = search_and_summarize(body.query)
        return {"response": result}
```
**What this does:**
- Calls the `search_and_summarize` function from `model.py`, passing in the validated query string
- If it succeeds, returns a JSON object like `{"response": "...results and summary text..."}`
- FastAPI automatically converts the Python dictionary into JSON

---

```python
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Search pipeline failed. Please try again.")
```
**What this does:** Catches any error that occurs inside the AI pipeline.
- `traceback.print_exc()` — prints the full error to the terminal (so the developer can see what went wrong)
- `raise HTTPException(status_code=500, ...)` — sends a 500 Internal Server Error response to the frontend with a friendly message

---

```python
@app.get("/health")
def health():
    return {"status": "ready"}
```
**What this does:** Creates a simple GET endpoint at `/health`. It returns `{"status": "ready"}` immediately. This is used to check if the server has started and is accepting requests. The frontend or a monitoring tool can ping this route to confirm the backend is alive.

---

## 4. model.py — Line by Line

### Section 1 — API Client Setup

```python
from openai import OpenAI
from dotenv import load_dotenv
import os
```
**What this does:**
- `OpenAI` — imports the OpenAI client class. Even though we are using OpenRouter (not OpenAI directly), OpenRouter is compatible with the OpenAI SDK, so we reuse it
- `load_dotenv` — a function that reads the `.env` file and loads the variables into the environment
- `os` — Python's built-in module for interacting with the operating system (used to read environment variables)

---

```python
load_dotenv()
```
**What this does:** Reads the `backend/.env` file and loads `OPENROUTER_API_KEY` into the environment. This must be called before `os.getenv(...)` is used, otherwise the variable will be `None`.

---

```python
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY")
)
```
**What this does:** Creates an OpenAI-compatible API client pointed at OpenRouter instead of OpenAI.
- `base_url` — redirects all API calls to OpenRouter's server
- `api_key` — reads the API key from the environment (loaded from `.env` by `load_dotenv()`)
- `os.getenv("OPENROUTER_API_KEY")` — looks up the value of that variable from the environment

This client is used later inside `openrouter_summary()` to call LLaMA 3.

---

### Section 2 — Loading the Dataset

```python
import pandas as pd

df = pd.read_csv(
    "Amazon_Reviews.csv",
    encoding='latin1',
    engine='python',
    on_bad_lines='skip'
)
```
**What this does:** Loads the CSV file into a DataFrame (a table in memory).
- `encoding='latin1'` — the CSV uses the Latin-1 character encoding (not UTF-8). Using the wrong encoding would cause errors on special characters
- `engine='python'` — uses Python's CSV parser instead of the faster C parser, because the C parser can be strict about malformed rows
- `on_bad_lines='skip'` — if a row is corrupted or malformed, skip it instead of crashing

---

```python
reviews = df["Review Text"].dropna().astype(str).tolist()
```
**What this does:** Extracts the review text column and converts it to a plain Python list.
- `df["Review Text"]` — selects only the review text column from the table
- `.dropna()` — removes any rows where the review text is empty/null
- `.astype(str)` — converts all values to strings (in case any are stored as other types)
- `.tolist()` — converts from a pandas Series to a plain Python list

After this line, `reviews` is a list like:
```
["The product was great but shipping took forever.", "Terrible quality...", ...]
```

The index of each review in this list matches the index in the FAISS index and the embeddings array. This alignment is critical — if FAISS returns index 42, then `reviews[42]` is the correct review text.

---

### Section 3 — Loading the AI Models

```python
from sentence_transformers import SentenceTransformer
from transformers import pipeline
```
**What this does:** Imports the two AI model libraries.
- `SentenceTransformer` — for converting text into number vectors (embeddings)
- `pipeline` — a HuggingFace helper that wraps any model into a simple callable function

---

```python
model = SentenceTransformer("all-MiniLM-L6-v2")
```
**What this does:** Downloads (first time) and loads the `all-MiniLM-L6-v2` model into memory.

**What this model does:**
- Takes any text as input
- Outputs a vector of 384 numbers that represents the *meaning* of that text
- Two texts with similar meaning will produce vectors that are numerically close to each other
- This is what enables semantic search — finding reviews that mean the same thing as the query, not just matching the same words

**Example:**
```
"bad shipping"    --> [0.12, -0.34, 0.87, ...]   (384 numbers)
"slow delivery"   --> [0.11, -0.31, 0.85, ...]   (384 numbers, similar!)
"great product"   --> [-0.45, 0.92, -0.12, ...]  (very different numbers)
```

---

```python
sentiment_model = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
```
**What this does:** Loads a pre-trained DistilBERT model fine-tuned for sentiment analysis.

**What this model does:**
- Takes any text as input
- Returns `POSITIVE` or `NEGATIVE` with a confidence score
- Trained on the SST-2 dataset (Stanford Sentiment Treebank)

**Example:**
```
sentiment_model("great product")   --> {"label": "POSITIVE", "score": 0.99}
sentiment_model("terrible quality") --> {"label": "NEGATIVE", "score": 0.98}
```

---

### Section 4 — The LLM Summary Function

```python
def openrouter_summary(text):
    response = client.chat.completions.create(
        model="meta-llama/llama-3-8b-instruct",
```
**What this does:** Calls the OpenRouter API to generate a summary using LLaMA 3 8B Instruct.
- `meta/llama-3-8b-instruct` — specifies which model to use. LLaMA 3 8B is Meta's open-source language model with 8 billion parameters

---

```python
        messages=[
            {
                "role": "system",
                "content": "You analyze customer reviews and extract key insights."
            },
            {
                "role": "user",
                "content": f"""
Analyze these reviews and give 3 clear bullet points of the main issues:

{text}
"""
            }
        ]
```
**What this does:** Sends a two-part conversation to the LLM.
- `"role": "system"` — sets the LLM's persona/instructions. It tells the model what kind of assistant it should be
- `"role": "user"` — the actual question/prompt. It injects the collected review text using an f-string
- The `{text}` placeholder is replaced with the actual review content at runtime

This is the **prompt engineering** part of the project — carefully crafting the instruction to get useful output from the LLM.

---

```python
    return response.choices[0].message.content
```
**What this does:** Extracts the text response from the API result.
- `response.choices` — a list of possible responses (usually just one)
- `[0]` — takes the first (and only) response
- `.message.content` — extracts the actual text string from the response object

---

### Section 5 — Loading the FAISS Index

```python
import numpy as np
import faiss

review_embeddings = np.load("embeddings.npy")
index = faiss.read_index("faiss.index")
```
**What this does:** Loads the pre-built vector database from disk.
- `np.load("embeddings.npy")` — loads the NumPy array of pre-computed embeddings (shape: 21055 × 384)
- `faiss.read_index("faiss.index")` — loads the FAISS index, which is a data structure optimized for fast nearest-neighbour search

**Why pre-computed?**
Encoding 21,000 reviews with SentenceTransformer takes several minutes. By computing all embeddings once and saving them, the server loads in seconds and never has to re-encode the dataset.

---

### Section 6 — The Main Search Function

```python
def search_and_summarize(query, k=15):
```
**What this does:** Defines the main function that runs the full AI pipeline. `k=15` means "retrieve the top 15 most similar reviews" (default value, can be overridden when calling).

---

```python
    query_embedding = model.encode([query])
```
**What this does:** Converts the user's query text into a 384-dimensional vector using SentenceTransformer.
- `[query]` — wraps the string in a list because `encode()` expects a list of strings
- Returns a NumPy array of shape `(1, 384)`

---

```python
    D, I = index.search(query_embedding, k)
```
**What this does:** Searches the FAISS index for the `k` nearest vectors to the query embedding.
- `D` — distances (how similar each result is — lower distance = more similar)
- `I` — indices (the position of each matching review in the `reviews` list)
- `I[0]` is a list of 15 index numbers, e.g. `[4521, 102, 8834, ...]`

This is the core semantic search step. FAISS scans all 21,000 embeddings in milliseconds using optimized vector math.

---

```python
    output = f"🔍 Query: {query}\n\nTop Results:\n\n"
    collected_text = ""
```
**What this does:** Initializes two strings.
- `output` — the final response string that will be returned to the frontend. Starts with the query label
- `collected_text` — accumulates the text of matching reviews, which will later be sent to the LLM

---

```python
    target_sentiment = sentiment_model(query)[0]['label']
```
**What this does:** Runs the query itself through the sentiment model to determine the user's intent.
- `sentiment_model(query)` — returns a list like `[{"label": "NEGATIVE", "score": 0.97}]`
- `[0]['label']` — extracts just the label string: `"POSITIVE"` or `"NEGATIVE"`

**Why this is important:** If someone searches for `"great battery life"`, they want positive reviews about battery. If they search for `"poor battery life"`, they want negative reviews. This step detects that intent automatically.

---

```python
    count = 0

    for idx in I[0]:
        text = reviews[idx]
```
**What this does:** Loops over the 15 indices returned by FAISS and looks up the actual review text using the index.
- `I[0]` — the list of 15 indices (e.g. `[4521, 102, 8834, ...]`)
- `reviews[idx]` — looks up that index in the reviews list to get the text

---

```python
        sentiment = sentiment_model(text[:512])[0]['label']
```
**What this does:** Runs each review through the sentiment model.
- `text[:512]` — truncates the review to 512 characters. DistilBERT has a maximum input length, so very long reviews must be trimmed before classifying

---

```python
        if target_sentiment is None or sentiment == target_sentiment:
            output += f"[{sentiment}] {text}\n\n"
            collected_text += text + " "
            count += 1
```
**What this does:** Filters reviews to keep only those matching the query's sentiment.
- `sentiment == target_sentiment` — only include reviews where the sentiment matches (e.g. both NEGATIVE)
- `output += f"[{sentiment}] {text}\n\n"` — appends the review to the output string with a sentiment label like `[NEGATIVE]`
- `collected_text += text + " "` — also collects the raw text for the LLM summary

---

```python
        if count >= 5:
            break
```
**What this does:** Stops after collecting 5 matching reviews. We search 15 but only show 5 — the extras are a buffer in case some don't match the target sentiment.

---

```python
    if collected_text:
        summary = openrouter_summary(collected_text[:2000])
        output += "\nSummary:\n" + summary
    return output
```
**What this does:**
- `if collected_text` — only calls the LLM if there is at least one matching review
- `collected_text[:2000]` — truncates to 2000 characters to stay within LLM token limits and keep API costs low
- Appends the LLM-generated summary to the output string
- Returns the complete output string back to `app.py`

---

## 5. The Full Pipeline — Step by Step

```
STARTUP (runs once when server starts)
=======================================

  Amazon_Reviews.csv
          |
          | pandas reads CSV
          v
  reviews[] list (21,055 review texts in memory)

  embeddings.npy
          |
          | numpy loads array
          v
  review_embeddings (21,055 × 384 matrix)

  faiss.index
          |
          | faiss reads index
          v
  index (searchable vector database)

  SentenceTransformer loads --> model (encodes text to vectors)
  DistilBERT loads          --> sentiment_model (positive/negative)



QUERY TIME (runs on every search request)
==========================================

  User types: "poor delivery experience"
          |
          v
  [app.py] POST /search received
          |
          | Pydantic validates body
          v
  SearchRequest.query = "poor delivery experience"
          |
          | calls search_and_summarize()
          v
  [model.py] model.encode(["poor delivery experience"])
          |
          | SentenceTransformer converts text to vector
          v
  query_embedding = [0.12, -0.45, 0.87, ...] (384 numbers)
          |
          | FAISS searches 21,055 vectors
          v
  Top 15 most similar review indices: [4521, 102, 8834, ...]
          |
          | sentiment_model("poor delivery experience")
          v
  target_sentiment = "NEGATIVE"
          |
          | Loop through 15 reviews
          | Keep only NEGATIVE ones
          v
  Top 5 matching reviews selected
          |
          | collected_text sent to OpenRouter API
          v
  LLaMA 3 generates 3-bullet summary
          |
          | Build output string
          v
  output = "Query: ... Top Results: ... Summary: ..."
          |
          | app.py returns as JSON
          v
  {"response": "...full output text..."}
          |
          | Frontend receives JSON
          | parser.js parses it into cards
          v
  UI renders review cards + summary bullets
```

---

## 6. Environment Variables Explained

### What is an Environment Variable?

An environment variable is a value stored outside your code — in the operating system or a special file — that your code can read at runtime. This keeps sensitive information like API keys out of your source code.

### The `.env` File

```
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxx
```

This file lives at `backend/.env`. It is listed in `.gitignore` so it is never uploaded to GitHub.

### How it flows through the code

```
backend/.env file
        |
        | load_dotenv() reads the file
        v
Operating system environment
        |
        | os.getenv("OPENROUTER_API_KEY")
        v
client = OpenAI(api_key="sk-or-v1-xxxx")
        |
        | used in every API call
        v
openrouter_summary() sends request with this key
```

### Step by step

1. `load_dotenv()` is called at the top of `model.py`
2. It reads `backend/.env` and loads the key-value pairs into the environment
3. `os.getenv("OPENROUTER_API_KEY")` retrieves the value by name
4. The value is passed to the OpenAI client as `api_key`
5. Every time `openrouter_summary()` is called, the client uses this key to authenticate with OpenRouter

### In deployment (Hugging Face Spaces)

When deployed, there is no `.env` file. Instead, the API key is added as a **Secret** in the HF Space settings. HF injects it into the environment automatically, so `os.getenv("OPENROUTER_API_KEY")` still works without any code changes.

```
HF Space Secret: OPENROUTER_API_KEY = sk-or-v1-xxxx
        |
        | HF injects into environment at runtime
        v
os.getenv("OPENROUTER_API_KEY") reads it
        |
        v
Works exactly the same as local .env
```

---

## 7. Key Concepts Explained Simply

### What is a Vector / Embedding?

A computer cannot understand the word "delivery" or "bad". It only understands numbers.

An embedding is a way of converting text into a list of numbers that captures the *meaning* of the text. The numbers are not random — they are produced by a neural network trained on billions of sentences.

```
"bad delivery"   --> [0.12, -0.34, 0.87, 0.05, ...] (384 numbers)
"slow shipping"  --> [0.11, -0.31, 0.85, 0.04, ...] (very similar numbers!)
"great product"  --> [-0.45, 0.92, -0.12, 0.78, ...] (very different numbers)
```

Because "bad delivery" and "slow shipping" mean similar things, their number lists are similar. FAISS uses this similarity to find relevant reviews.

---

### What is FAISS?

FAISS (Facebook AI Similarity Search) is a library that can search through millions of vectors very fast.

Imagine you have 21,000 review embeddings and you want to find the 15 most similar to your query. Checking every single one mathematically would take too long. FAISS uses clever data structures to do this in milliseconds.

```
Query vector: [0.12, -0.34, 0.87, ...]
        |
        | FAISS searches 21,000 stored vectors
        | using optimized index structure
        v
Returns: top 15 indices whose vectors are closest
```

---

### What is Sentiment Analysis?

Sentiment analysis is classifying text as positive or negative.

DistilBERT is a lightweight version of BERT (Bidirectional Encoder Representations from Transformers), a model trained by Google. The version used here was fine-tuned on labelled positive/negative movie and product reviews.

```
"The product is amazing!"     --> POSITIVE (99% confidence)
"Terrible, broke in one day." --> NEGATIVE (98% confidence)
```

---

### What is RAG (Retrieval-Augmented Generation)?

LLaMA 3 is a powerful language model but it has never seen your specific Amazon review dataset. If you ask it "what do customers say about delivery?", it will make up a generic answer.

RAG solves this by:

```
Step 1 (Retrieve): Search your dataset for relevant reviews
                        ↓
Step 2 (Augment):  Put those reviews into the prompt as context
                        ↓
Step 3 (Generate): Ask the LLM to summarize ONLY those reviews
```

Now LLaMA 3 is summarizing real reviews from your data, not hallucinating.

---

### What is Pydantic?

Pydantic is a Python library for data validation. It checks that the data coming into your API has the right shape before your code even runs.

Without Pydantic:
```python
query = data.get("query")
if query is None:
    return error...
if not isinstance(query, str):
    return error...
if not query.strip():
    return error...
```

With Pydantic:
```python
class SearchRequest(BaseModel):
    query: str

    @field_validator("query")
    def query_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError("...")
        return v.strip()
```

FastAPI + Pydantic together handle all validation automatically and return descriptive error messages to the client.

---

## 8. What Happens at Startup vs at Search Time

This is important to understand because the backend takes 30–90 seconds to start. Here is why.

### At Startup (slow — runs once)

| Action | Time | Why |
|---|---|---|
| Load `Amazon_Reviews.csv` into memory | ~2 sec | 13MB file, 21,000 rows |
| Load `SentenceTransformer` model | ~10 sec | Downloads ~91MB model weights |
| Load `DistilBERT` sentiment model | ~15 sec | Downloads ~268MB model weights |
| Load `embeddings.npy` into memory | ~1 sec | 32MB NumPy array |
| Load `faiss.index` from disk | ~1 sec | 32MB index file |

All of this happens **once** when you run `uvicorn app:app --reload`. After that, everything stays in memory.

### At Search Time (fast — runs on every query)

| Action | Time |
|---|---|
| Validate request (Pydantic) | < 1ms |
| Encode query with SentenceTransformer | ~50ms |
| FAISS nearest-neighbour search | ~5ms |
| Sentiment classify query + 15 reviews | ~200ms |
| Call OpenRouter LLM API | ~2–5 sec |
| Return response | < 1ms |

The only slow step at search time is the LLM API call (network request to OpenRouter).

---

## 9. Error Handling Explained

### In app.py

```
Request arrives
      |
      | Is body valid JSON?
      | No  --> 422 Unprocessable Entity (FastAPI automatic)
      |
      | Does body have "query" field?
      | No  --> 422 Unprocessable Entity (Pydantic automatic)
      |
      | Is "query" a non-empty string?
      | No  --> 422 with "Field 'query' must be a non-empty string"
      |
      | Does search_and_summarize() crash?
      | Yes --> 500 "Search pipeline failed. Please try again."
      |         (full traceback printed to terminal for debugging)
      |
      | Everything OK --> 200 {"response": "..."}
```

### HTTP Status Codes Used

| Code | Meaning | When it happens |
|---|---|---|
| 200 | OK | Successful search |
| 422 | Unprocessable Entity | Invalid request body (Pydantic) |
| 500 | Internal Server Error | AI pipeline crashed unexpectedly |

---

## 10. Quick Reference — All Functions

### app.py

| Function / Class | Purpose |
|---|---|
| `SearchRequest` | Pydantic model that validates the incoming POST body |
| `SearchRequest.query_must_not_be_empty()` | Custom validator — rejects blank queries |
| `search(body)` | POST `/search` handler — calls the AI pipeline and returns results |
| `health()` | GET `/health` handler — returns server status |

### model.py

| Function / Variable | Purpose |
|---|---|
| `load_dotenv()` | Loads API key from `.env` file into environment |
| `client` | OpenAI-compatible HTTP client pointed at OpenRouter |
| `df` | Pandas DataFrame loaded from `Amazon_Reviews.csv` |
| `reviews` | Plain Python list of all review text strings |
| `model` | SentenceTransformer — converts text to 384-dim vectors |
| `sentiment_model` | DistilBERT pipeline — returns POSITIVE or NEGATIVE |
| `review_embeddings` | NumPy array of pre-computed review vectors (21055 × 384) |
| `index` | FAISS index — used for fast nearest-neighbour search |
| `openrouter_summary(text)` | Calls LLaMA 3 via OpenRouter API, returns bullet-point summary |
| `search_and_summarize(query, k)` | Main pipeline — runs search, sentiment filter, and summarization |
