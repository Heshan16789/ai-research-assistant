
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import yake

app = FastAPI(
    title="AI Research Assistant ML Service",
    description="Machine learning and NLP services for research papers",
    version="1.0.0"
)

# Initialize YAKE keyword extractor
keyword_extractor = yake.KeywordExtractor(
    lan="en",
    n=3,
    dedupLim=0.9,
    top=10
)


class KeywordRequest(BaseModel):
    text: str = Field(min_length=30, max_length=20000)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Research Assistant ML Service"
    }


@app.post("/api/keywords")
def extract_keywords(request: KeywordRequest):
    try:
        extracted_keywords = keyword_extractor.extract_keywords(
            request.text
        )

        return {
            "message": "Keywords extracted successfully",
            "algorithm": "YAKE",
            "totalKeywords": len(extracted_keywords),
            "keywords": [
                {
                    "keyword": keyword,
                    "score": round(score, 4)
                }
                for keyword, score in extracted_keywords
            ]
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Keyword extraction failed: {str(error)}"
        )
