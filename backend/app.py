from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from model import search_and_summarize
import traceback

app = FastAPI(
    title="ReviewRadar AI",
    description="Semantic retrieval and analysis system for Amazon product reviews",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    query: str

    @field_validator("query")
    @classmethod
    def query_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Field 'query' must be a non-empty string")
        return v.strip()


@app.post("/search")
def search(body: SearchRequest):
    try:
        result = search_and_summarize(body.query)
        return {"response": result}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Search pipeline failed. Please try again.")


@app.get("/health")
def health():
    return {"status": "ready"}
