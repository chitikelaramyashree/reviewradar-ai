from openai import OpenAI
from dotenv import load_dotenv
import os
import numpy as np
import faiss
import pandas as pd
from sentence_transformers import SentenceTransformer
from transformers import pipeline

load_dotenv()

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY")
)

# Load ML models once at startup
model = SentenceTransformer("all-MiniLM-L6-v2")
sentiment_model = pipeline(
    "sentiment-analysis",
    model="distilbert-base-uncased-finetuned-sst-2-english"
)

# ── Dataset state — empty until the user uploads a CSV via /upload ──
custom_state = {
    "reviews": [],
    "df": None,
    "embeddings": None,
    "index": None,
    "products": [],
}


# Keyword lists for partial matching — a column is accepted if its normalised
# name *contains* any of these keywords (first match wins).
_REVIEW_KEYWORDS = ["review", "text", "content", "comment", "feedback"]
_PRODUCT_KEYWORDS = ["product", "category", "item", "title", "name"]


def _norm(col: str) -> str:
    """Lowercase, strip whitespace, replace underscores/hyphens with spaces."""
    return col.strip().lower().replace("_", " ").replace("-", " ")


def detect_columns(df: pd.DataFrame) -> tuple[str, str | None]:
    """
    Scan df.columns for the best review-text and product-name columns using
    partial (substring) matching on normalised column names.

    Normalisation: lowercase → strip whitespace → underscores/hyphens → spaces.
    A column matches a keyword list when any keyword appears anywhere in its
    normalised name (e.g. "product_name" → "product name" contains "product").

    Returns:
        (review_col, product_col)  — product_col is None when not found.
    Raises:
        ValueError if no review-text column can be identified.
    """
    cols = list(df.columns)
    print(f"[column detection] all columns in CSV: {cols}")

    def first_partial_match(keywords: list) -> str | None:
        for col in cols:
            normed = _norm(col)
            for kw in keywords:
                if kw in normed:
                    return col
        return None

    review_col = first_partial_match(_REVIEW_KEYWORDS)
    if review_col is None:
        tried = ", ".join(f'"{kw}"' for kw in _REVIEW_KEYWORDS)
        raise ValueError(
            f"Could not find a review-text column. "
            f"Keywords tried (partial match): {tried}. "
            f"Columns found in your CSV: {cols}"
        )

    product_col = first_partial_match(_PRODUCT_KEYWORDS)

    print(f"[column detection] review text  → '{review_col}' (normalised: '{_norm(review_col)}')")
    if product_col:
        print(f"[column detection] product name → '{product_col}' (normalised: '{_norm(product_col)}')")
    else:
        print("[column detection] product name → not found (product filtering disabled)")

    return review_col, product_col


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Detect and rename the review / product columns to the internal names
    ('Review Text', 'Product Name') so the rest of the pipeline is unchanged.
    Drops all other columns and handles empty/mixed-type values.
    """
    review_col, product_col = detect_columns(df)

    keep = {review_col: "Review Text"}
    if product_col:
        keep[product_col] = "Product Name"

    df = df[list(keep.keys())].rename(columns=keep).copy()

    # Coerce to string, replace blank/whitespace-only strings with NaN
    df["Review Text"] = (
        df["Review Text"]
        .astype(str)
        .str.strip()
        .replace("", pd.NA)
        .replace("nan", pd.NA)
    )
    if "Product Name" in df.columns:
        df["Product Name"] = (
            df["Product Name"]
            .astype(str)
            .str.strip()
            .replace("", pd.NA)
            .replace("nan", pd.NA)
        )

    return df


def load_custom_dataset(df: pd.DataFrame) -> list:
    """
    Build embeddings and FAISS index from the uploaded DataFrame.
    Called exactly once after /upload; search reuses this index every time.
    Returns the list of unique Product Name values (empty if column absent).
    """
    # Auto-detect and normalise columns before anything else touches the data
    df = _normalise_columns(df)

    df_clean = df[df["Review Text"].notna()].reset_index(drop=True)
    reviews = df_clean["Review Text"].astype(str).tolist()

    if not reviews:
        raise ValueError("No valid review rows found after cleaning. Check that your review column contains text data.")

    # Batch-encode all reviews (expensive — done once).
    # batch_size=16 reduces peak RAM/CPU usage on modest hardware; raise it
    # (e.g. 32 or 64) if your machine has more memory and you want faster indexing.
    embeddings = model.encode(reviews, batch_size=16, show_progress_bar=True)
    embeddings = np.array(embeddings).astype("float32")

    # FAISS flat L2 index
    dim = embeddings.shape[1]
    idx = faiss.IndexFlatL2(dim)
    idx.add(embeddings)

    products = []
    if "Product Name" in df_clean.columns:
        products = sorted(df_clean["Product Name"].dropna().unique().tolist())

    custom_state["reviews"] = reviews
    custom_state["df"] = df_clean
    custom_state["embeddings"] = embeddings
    custom_state["index"] = idx
    custom_state["products"] = products

    return products


def _product_indices(product_name: str) -> list:
    """Return DataFrame row indices whose Product Name matches the filter."""
    df = custom_state["df"]
    if df is None or "Product Name" not in df.columns:
        return list(range(len(custom_state["reviews"])))
    return df[df["Product Name"] == product_name].index.tolist()


def _search_subset(query_emb: np.ndarray, indices: list, k: int) -> list:
    """
    Rank a subset of custom embeddings by cosine similarity (dot product on
    unit-normalised all-MiniLM vectors) and return top-k global indices.
    Used for product-filtered searches instead of whole-index FAISS scan.
    """
    if not indices:
        return []
    subset = custom_state["embeddings"][indices]
    scores = np.dot(subset, query_emb.T).flatten()
    top_local = np.argsort(scores)[::-1][: min(k, len(indices))]
    return [indices[i] for i in top_local]


def _compute_analytics(sentiments: list) -> dict:
    """
    Derive sentiment counts, percentages, and a business-insight label
    from the list of 'POSITIVE' / 'NEGATIVE' strings returned by DistilBERT.
    Thresholds: >70 % positive → high potential, 40–70 % → moderate, <40 % → risk.
    """
    total = len(sentiments)
    if total == 0:
        return {
            "positive_count": 0,
            "negative_count": 0,
            "positive_percentage": 0.0,
            "negative_percentage": 0.0,
            "total_reviews_analyzed": 0,
            "sales_insight": "No reviews analyzed.",
        }

    pos = sum(1 for s in sentiments if s == "POSITIVE")
    neg = total - pos
    pos_pct = round((pos / total) * 100, 1)
    neg_pct = round((neg / total) * 100, 1)

    if pos_pct > 70:
        insight = "High potential for increased sales"
    elif pos_pct >= 40:
        insight = "Moderate performance"
    else:
        insight = "Risk of poor sales"

    return {
        "positive_count": pos,
        "negative_count": neg,
        "positive_percentage": pos_pct,
        "negative_percentage": neg_pct,
        "total_reviews_analyzed": total,
        "sales_insight": insight,
    }


def openrouter_summary(text: str) -> str:
    response = client.chat.completions.create(
        model="meta-llama/llama-3-8b-instruct",
        messages=[
            {
                "role": "system",
                "content": "You analyze customer reviews and extract key insights.",
            },
            {
                "role": "user",
                "content": (
                    "Analyze these reviews and give 3 clear bullet points of the main issues:\n\n"
                    + text
                ),
            },
        ],
    )
    return response.choices[0].message.content


def search_and_summarize(query: str, k: int = 15, product_name: str = None) -> dict:
    """
    Full pipeline: Query → (Product Filter) → Embedding → FAISS → Sentiment → LLM → Analytics

    Raises RuntimeError if no dataset has been uploaded yet.

    Returns:
        {
            reviews:   [{sentiment, text}, ...],   # up to 5 reviews matching query intent
            summary:   "<LLM markdown string>",
            analytics: {positive_count, negative_count, positive_percentage,
                         negative_percentage, total_reviews_analyzed, sales_insight}
        }
    """
    if custom_state["index"] is None:
        raise RuntimeError("No dataset uploaded. Please upload a dataset first.")

    reviews = custom_state["reviews"]
    index = custom_state["index"]

    query_emb = model.encode([query]).astype("float32")

    # Retrieve candidate indices — use product-filtered subset when applicable
    if product_name:
        p_indices = _product_indices(product_name)
        candidate_indices = _search_subset(query_emb, p_indices, k * 3)
    else:
        D, I = index.search(query_emb, min(k * 3, len(reviews)))
        candidate_indices = [i for i in I[0] if i >= 0]

    # Sentiment intent of the query guides which reviews to surface
    target_sentiment = sentiment_model(query)[0]["label"]

    collected_reviews = []
    all_sentiments = []
    collected_text = ""
    seen_texts = set()

    for idx in candidate_indices:
        if idx < 0 or idx >= len(reviews):
            continue
        text = reviews[idx]
        sentiment = sentiment_model(text[:512])[0]["label"]
        all_sentiments.append(sentiment)

        # Keep up to 5 reviews that match the query's sentiment intent, deduped
        if sentiment == target_sentiment and len(collected_reviews) < 5:
            normalised = text.strip().lower()
            if normalised in seen_texts:
                continue
            seen_texts.add(normalised)
            collected_reviews.append({"sentiment": sentiment.lower(), "text": text})
            collected_text += text + " "

    summary = openrouter_summary(collected_text[:2000]) if collected_text else ""

    # Analytics covers ALL retrieved candidates, not just the 5 shown
    analytics = _compute_analytics(all_sentiments)

    return {"reviews": collected_reviews, "summary": summary, "analytics": analytics}
