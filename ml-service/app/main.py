from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

import numpy as np
import yake

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans


app = FastAPI(
    title="AI Research Assistant ML Service",
    description="ML and NLP services for research papers",
    version="1.0.0"
)


# --------------------------------------------------
# Load NLP models
# --------------------------------------------------

keyword_extractor = yake.KeywordExtractor(
    lan="en",
    n=3,
    dedupLim=0.9,
    top=10
)

semantic_model = SentenceTransformer("all-MiniLM-L6-v2")


# --------------------------------------------------
# Request models
# --------------------------------------------------

class KeywordRequest(BaseModel):
    text: str = Field(min_length=30, max_length=20000)


class SimilarityRequest(BaseModel):
    text1: str = Field(min_length=30, max_length=20000)
    text2: str = Field(min_length=30, max_length=20000)


class ClusterPaper(BaseModel):
    paperId: str = Field(min_length=1)
    title: str = Field(min_length=1, max_length=300)
    abstract: str = Field(default="", max_length=10000)
    keywords: List[str] = Field(default_factory=list)


class ClusteringRequest(BaseModel):
    papers: List[ClusterPaper] = Field(min_length=2, max_length=100)
    numberOfClusters: Optional[int] = Field(default=None, ge=2, le=10)


class RecommendationRequest(BaseModel):
    targetPaperId: str = Field(min_length=1)
    papers: List[ClusterPaper] = Field(min_length=2, max_length=100)
    topK: int = Field(default=5, ge=1, le=20)


# --------------------------------------------------
# Shared text preparation
# --------------------------------------------------

def prepare_paper_text(paper):
    return " ".join([
        paper.title,
        paper.abstract,
        " ".join(paper.keywords)
    ]).strip()


# --------------------------------------------------
# Health check
# --------------------------------------------------

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Research Assistant ML Service"
    }


# --------------------------------------------------
# YAKE keyword extraction
# --------------------------------------------------

@app.post("/api/keywords")
def extract_keywords(request: KeywordRequest):
    try:
        extracted_keywords = keyword_extractor.extract_keywords(
            request.text
        )

        return {
            "success": True,
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


# --------------------------------------------------
# Sentence-BERT semantic similarity
# --------------------------------------------------

@app.post("/api/semantic-similarity")
def calculate_semantic_similarity(request: SimilarityRequest):
    try:
        embeddings = semantic_model.encode(
            [request.text1, request.text2]
        )

        score = float(
            cosine_similarity(
                [embeddings[0]],
                [embeddings[1]]
            )[0][0]
        )

        percentage = max(0.0, min(100.0, score * 100))

        return {
            "success": True,
            "algorithm": "Sentence-BERT (all-MiniLM-L6-v2)",
            "similarityScore": round(score, 4),
            "similarityPercentage": round(percentage, 2)
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Semantic similarity failed: {str(error)}"
        )


# --------------------------------------------------
# TF-IDF + K-Means research paper clustering
# --------------------------------------------------

@app.post("/api/cluster-papers")
def cluster_research_papers(request: ClusteringRequest):
    try:
        papers = request.papers

        number_of_clusters = (
            request.numberOfClusters
            if request.numberOfClusters is not None
            else min(3, len(papers))
        )

        if number_of_clusters > len(papers):
            raise HTTPException(
                status_code=400,
                detail="Number of clusters cannot exceed the number of papers."
            )

        documents = [
            prepare_paper_text(paper)
            for paper in papers
        ]

        vectorizer = TfidfVectorizer(
            stop_words="english",
            max_features=5000,
            ngram_range=(1, 2)
        )

        try:
            tfidf_matrix = vectorizer.fit_transform(documents)

        except ValueError as error:
            raise HTTPException(
                status_code=400,
                detail=f"Unable to extract text features: {str(error)}"
            )

        kmeans = KMeans(
            n_clusters=number_of_clusters,
            random_state=42,
            n_init=10
        )

        assignments = kmeans.fit_predict(tfidf_matrix)

        feature_names = vectorizer.get_feature_names_out()
        distances = kmeans.transform(tfidf_matrix)

        clusters = []

        for cluster_index in sorted(set(assignments)):

            paper_indices = [
                index
                for index, assigned_cluster in enumerate(assignments)
                if assigned_cluster == cluster_index
            ]

            center = kmeans.cluster_centers_[cluster_index]
            top_indices = np.argsort(center)[::-1][:5]

            top_terms = [
                feature_names[index]
                for index in top_indices
                if center[index] > 0
            ]

            cluster_label = (
                ", ".join(term.title() for term in top_terms)
                if top_terms
                else f"Research Cluster {cluster_index + 1}"
            )

            cluster_papers = []

            for paper_index in paper_indices:
                paper = papers[paper_index]

                cluster_papers.append({
                    "paperId": paper.paperId,
                    "title": paper.title,
                    "keywords": paper.keywords,
                    "distanceFromCenter": round(
                        float(distances[paper_index, cluster_index]),
                        4
                    )
                })

            clusters.append({
                "clusterId": int(cluster_index + 1),
                "label": cluster_label,
                "importantTerms": top_terms,
                "totalPapers": len(cluster_papers),
                "papers": cluster_papers
            })

        return {
            "success": True,
            "message": "Research papers clustered successfully.",
            "algorithm": "TF-IDF + K-Means Clustering",
            "totalPapers": len(papers),
            "requestedClusters": number_of_clusters,
            "actualClusters": len(clusters),
            "clusters": clusters
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Paper clustering failed: {str(error)}"
        )


# --------------------------------------------------
# Sentence-BERT research paper recommendations
# --------------------------------------------------

@app.post("/api/recommend-papers")
def recommend_research_papers(request: RecommendationRequest):
    try:
        papers = request.papers

        target_indices = [
            index
            for index, paper in enumerate(papers)
            if paper.paperId == request.targetPaperId
        ]

        if not target_indices:
            raise HTTPException(
                status_code=404,
                detail="The selected research paper was not found."
            )

        if len(target_indices) > 1:
            raise HTTPException(
                status_code=400,
                detail="Duplicate paper IDs were provided."
            )

        target_index = target_indices[0]

        documents = [
            prepare_paper_text(paper)
            for paper in papers
        ]

        # Generate normalized Sentence-BERT embeddings.
        embeddings = semantic_model.encode(
            documents,
            convert_to_numpy=True,
            normalize_embeddings=True
        )

        # Compare the selected paper with every other paper.
        scores = cosine_similarity(
            [embeddings[target_index]],
            embeddings
        )[0]

        recommendations = []

        for index, paper in enumerate(papers):

            # A paper must never recommend itself.
            if index == target_index:
                continue

            score = float(scores[index])

            common_keywords = sorted(
                {
                    keyword.strip().lower()
                    for keyword in papers[target_index].keywords
                    if keyword.strip()
                }
                &
                {
                    keyword.strip().lower()
                    for keyword in paper.keywords
                    if keyword.strip()
                }
            )

            recommendations.append({
                "paperId": paper.paperId,
                "title": paper.title,
                "similarityScore": round(score, 4),
                "similarityPercentage": round(
                    max(0.0, min(100.0, score * 100)),
                    2
                ),
                "matchingKeywords": common_keywords
            })

        # Rank the most relevant papers first.
        recommendations.sort(
            key=lambda item: item["similarityScore"],
            reverse=True
        )

        recommendations = recommendations[:request.topK]

        return {
            "success": True,
            "message": "Research paper recommendations generated successfully.",
            "algorithm": "Sentence-BERT + Cosine Similarity",
            "targetPaper": {
                "paperId": papers[target_index].paperId,
                "title": papers[target_index].title
            },
            "totalRecommendations": len(recommendations),
            "recommendations": recommendations
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Paper recommendation failed: {str(error)}"
        )