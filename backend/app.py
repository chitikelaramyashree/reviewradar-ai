from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from typing import Optional
from model import search_and_summarize, load_custom_dataset, custom_state
import traceback
import pandas as pd
import io

app = FastAPI(
    title="ReviewRadar AI",
    description="Semantic retrieval and analysis system for product reviews",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    query: str
    product_name: Optional[str] = None

    @field_validator("query")
    @classmethod
    def query_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Field 'query' must be a non-empty string")
        return v.strip()


@app.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """
    Accept a user-uploaded CSV, validate it, generate embeddings, and build a
    FAISS index — all stored in memory so /search never rebuilds the index.

    Required column: "Review Text"
    Optional column: "Product Name" (enables product-wise filtering)
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        contents = await file.read()
        df = pd.read_csv(
            io.BytesIO(contents), encoding="latin1", engine="python", on_bad_lines="skip"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV: {str(e)}")

    try:
        products = load_custom_dataset(df)
    except ValueError as e:
        # Column detection failed — return the descriptive message directly
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to process the dataset.")

    # custom_state["reviews"] is set inside load_custom_dataset after cleaning
    valid_count = len(custom_state["reviews"])

    return {
        "message": "Dataset uploaded and indexed successfully.",
        "review_count": valid_count,
        "products": products,
    }


@app.post("/search")
def search(body: SearchRequest):
    """
    Search pipeline: Query → (Product Filter) → Embedding → FAISS → Sentiment → LLM

    Returns 400 with { "error": "..." } when no dataset has been uploaded yet.
    """
    try:
        result = search_and_summarize(body.query, product_name=body.product_name)
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail={"error": str(e)})
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Search pipeline failed. Please try again.")


@app.get("/status")
def status():
    """Return whether a dataset is currently loaded and how many reviews it contains."""
    loaded = custom_state["index"] is not None
    return {
        "dataset_loaded": loaded,
        "num_reviews": len(custom_state["reviews"]) if loaded else 0,
    }


@app.get("/health")
def health():
    return {"status": "ready"}
