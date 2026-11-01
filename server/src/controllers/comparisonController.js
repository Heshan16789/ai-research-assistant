import mongoose from "mongoose";
import Paper from "../models/Paper.js";
import { calculateSemanticSimilarity } from "../services/mlService.js";

// Common English words that provide little value for text comparison.
const stopWords = new Set([
  "a", "an", "the",
  "is", "are", "was", "were",
  "be", "been", "being",
  "and", "or", "but",
  "of", "in", "on", "at",
  "to", "from", "for", "with",
  "by", "as", "into",
  "this", "that", "these", "those",
  "it", "its", "they", "them",
  "their", "we", "our", "you",
  "he", "she", "his", "her",
  "which", "who", "whom",
  "what", "when", "where", "why", "how",
  "can", "could", "may", "might",
  "will", "would", "shall", "should",
  "do", "does", "did",
  "have", "has", "had",
  "not", "no", "so", "than",
  "then", "also", "such"
]);

// Analyse common and unique keywords across research papers.
const analyzeKeywords = (papers) => {
  const keywordSets = papers.map(
    (paper) =>
      new Set(
        (paper.keywords || [])
          .map((keyword) => keyword.trim().toLowerCase())
          .filter(Boolean)
      )
  );

  const commonKeywords = [...keywordSets[0]].filter(
    (keyword) => keywordSets.every((set) => set.has(keyword))
  );

  const paperKeywords = papers.map((paper, index) => ({
    paperId: paper._id,
    title: paper.title,
    uniqueKeywords: [...keywordSets[index]].filter(
      (keyword) =>
        !keywordSets.some(
          (set, otherIndex) =>
            otherIndex !== index && set.has(keyword)
        )
    ),
  }));

  return {
    commonKeywords,
    paperKeywords,
  };
};

// Analyse publication years and venues.
const analyzePublications = (papers) => {
  const papersWithYear = papers.filter(
    (paper) =>
      Number.isInteger(paper.publicationYear) &&
      paper.publicationYear >= 1900 &&
      paper.publicationYear <= 2100
  );

  const years = papersWithYear.map(
    (paper) => paper.publicationYear
  );

  const earliestYear =
    years.length > 0 ? Math.min(...years) : null;

  const latestYear =
    years.length > 0 ? Math.max(...years) : null;

  const yearRange =
    years.length > 0 ? latestYear - earliestYear : null;

  const venues = [
    ...new Set(
      papers
        .map((paper) => paper.venue?.trim())
        .filter(Boolean)
    ),
  ];

  const chronologicalOrder = [...papersWithYear]
    .sort((a, b) => a.publicationYear - b.publicationYear)
    .map((paper) => ({
      paperId: paper._id,
      title: paper.title,
      publicationYear: paper.publicationYear,
    }));

  return {
    earliestYear,
    latestYear,
    yearRange,
    venueCount: venues.length,
    venues,
    chronologicalOrder,
  };
};

// Analyse the abstracts of selected research papers.
const analyzeAbstracts = (papers) => {
  return papers.map((paper) => {
    const abstract = (paper.abstract || "").trim();

    const words = abstract
      ? abstract.split(/\s+/).filter(Boolean)
      : [];

    return {
      paperId: paper._id,
      title: paper.title,
      abstractLength: abstract.length,
      wordCount: words.length,
      hasAbstract: abstract.length > 0,
    };
  });
};

// Calculate TF-IDF vectors for research paper abstracts.
const calculateTFIDF = (documents) => {
  const tokenizedDocuments = documents.map((document) =>
    document
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(
        (word) => word.length > 1 && !stopWords.has(word)
      )
  );

  const vocabulary = [
    ...new Set(tokenizedDocuments.flat()),
  ];

  const totalDocuments = tokenizedDocuments.length;

  const vectors = tokenizedDocuments.map((tokens) => {
    const termCounts = {};

    tokens.forEach((token) => {
      termCounts[token] = (termCounts[token] || 0) + 1;
    });

    return vocabulary.map((term) => {
      const termFrequency =
        tokens.length > 0
          ? (termCounts[term] || 0) / tokens.length
          : 0;

      const documentFrequency = tokenizedDocuments.filter(
        (document) => document.includes(term)
      ).length;

      const inverseDocumentFrequency =
        Math.log(
          (totalDocuments + 1) / (documentFrequency + 1)
        ) + 1;

      return termFrequency * inverseDocumentFrequency;
    });
  });

  return vectors;
};

// Calculate cosine similarity between two vectors.
const calculateCosineSimilarity = (vectorA, vectorB) => {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];

    magnitudeA += vectorA[i] ** 2;
    magnitudeB += vectorB[i] ** 2;
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
};

// Compare abstracts using TF-IDF.
const analyzeAbstractSimilarity = (papers) => {
  const documents = papers.map(
    (paper) => paper.abstract || ""
  );

  const vectors = calculateTFIDF(documents);

  const similarities = [];

  for (let i = 0; i < papers.length; i++) {
    for (let j = i + 1; j < papers.length; j++) {
      const similarity = calculateCosineSimilarity(
        vectors[i],
        vectors[j]
      );

      similarities.push({
        paperA: {
          paperId: papers[i]._id,
          title: papers[i].title,
        },
        paperB: {
          paperId: papers[j]._id,
          title: papers[j].title,
        },
        similarityScore: Number(similarity.toFixed(4)),
        similarityPercentage: Number(
          (similarity * 100).toFixed(2)
        ),
      });
    }
  }

  return {
    method: "TF-IDF with Smoothed IDF and Cosine Similarity",
    preprocessing: [
      "Lowercase conversion",
      "Punctuation removal",
      "Stop-word removal",
      "Single-character token removal",
    ],
    totalComparisons: similarities.length,
    similarities,
  };
};

// Compare abstracts using Sentence-BERT semantic embeddings.
const analyzeSemanticSimilarity = async (papers) => {
  const papersWithAbstracts = papers.filter(
    (paper) =>
      typeof paper.abstract === "string" &&
      paper.abstract.trim().length >= 30
  );

  const similarities = [];

  for (let i = 0; i < papersWithAbstracts.length; i++) {
    for (let j = i + 1; j < papersWithAbstracts.length; j++) {
      const paperA = papersWithAbstracts[i];
      const paperB = papersWithAbstracts[j];

      const result = await calculateSemanticSimilarity(
        paperA.abstract.trim(),
        paperB.abstract.trim()
      );

      similarities.push({
        paperA: {
          paperId: paperA._id,
          title: paperA.title,
        },
        paperB: {
          paperId: paperB._id,
          title: paperB.title,
        },
        similarityScore: result.similarityScore,
        similarityPercentage: result.similarityPercentage,
      });
    }
  }

  return {
    method: "Sentence-BERT (all-MiniLM-L6-v2) with Cosine Similarity",
    totalComparisons: similarities.length,
    skippedPapers: papers.length - papersWithAbstracts.length,
    similarities,
  };
};

// Compare selected research papers.
export const comparePapers = async (req, res) => {
  try {
    const { paperIds } = req.body ?? {};

    if (!Array.isArray(paperIds) || paperIds.length < 2) {
      return res.status(400).json({
        message:
          "Please select at least two research papers to compare.",
      });
    }

    if (paperIds.length > 5) {
      return res.status(400).json({
        message:
          "You can compare a maximum of five papers at a time.",
      });
    }

    const validIds = paperIds.every((id) =>
      mongoose.isValidObjectId(id)
    );

    if (!validIds) {
      return res.status(400).json({
        message: "One or more paper IDs are invalid.",
      });
    }

    const uniqueIds = [...new Set(paperIds)];

    if (uniqueIds.length !== paperIds.length) {
      return res.status(400).json({
        message: "Please select each paper only once.",
      });
    }

    // Only retrieve papers owned by the authenticated user.
    const papers = await Paper.find({
      _id: { $in: paperIds },
      owner: req.user.userId,
    }).lean();

    if (papers.length !== paperIds.length) {
      return res.status(404).json({
        message:
          "One or more papers were not found or you do not have permission to access them.",
      });
    }

    // Run existing analyses and the new semantic analysis.
    const keywordAnalysis = analyzeKeywords(papers);
    const publicationAnalysis = analyzePublications(papers);
    const abstractAnalysis = analyzeAbstracts(papers);
    const abstractSimilarity = analyzeAbstractSimilarity(papers);
    const semanticSimilarity = await analyzeSemanticSimilarity(papers);

    const comparison = {
      totalPapers: papers.length,

      papers: papers.map((paper) => ({
        id: paper._id,
        title: paper.title,
        authors: paper.authors,
        publicationYear: paper.publicationYear ?? null,
        venue: paper.venue,
        abstract: paper.abstract,
        keywords: paper.keywords,
      })),

      keywordAnalysis,
      publicationAnalysis,
      abstractAnalysis,
      abstractSimilarity,
      semanticSimilarity,
    };

    return res.status(200).json({
      message: "Research papers compared successfully.",
      comparison,
    });
  } catch (error) {
    console.error("Paper comparison error:", error);

    return res.status(500).json({
      message:
        "An error occurred while comparing research papers.",
    });
  }
};


