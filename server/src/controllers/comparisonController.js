
import mongoose from "mongoose";
import Paper from "../models/Paper.js";

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

  // Find keywords shared by all selected papers.
  const commonKeywords = [...keywordSets[0]].filter(
    (keyword) => keywordSets.every((set) => set.has(keyword))
  );

  // Find keywords unique to each paper.
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

  // Collect unique publication venues.
  const venues = [
    ...new Set(
      papers
        .map((paper) => paper.venue?.trim())
        .filter(Boolean)
    ),
  ];

  // Sort papers from oldest to newest.
  const chronologicalOrder = [...papersWithYear]
    .sort(
      (a, b) => a.publicationYear - b.publicationYear
    )
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

// Compare selected research papers.
export const comparePapers = async (req, res) => {
  try {
    const { paperIds } = req.body;

    // Validate the submitted paper IDs.
    if (!Array.isArray(paperIds) || paperIds.length < 2) {
      return res.status(400).json({
        message:
          "Please select at least two research papers to compare.",
      });
    }

    // Limit the number of papers in a single comparison.
    if (paperIds.length > 5) {
      return res.status(400).json({
        message:
          "You can compare a maximum of five papers at a time.",
      });
    }

    // Ensure every ID is valid.
    const validIds = paperIds.every((id) =>
      mongoose.isValidObjectId(id)
    );

    if (!validIds) {
      return res.status(400).json({
        message: "One or more paper IDs are invalid.",
      });
    }

    // Prevent duplicate paper selections.
    const uniqueIds = [...new Set(paperIds)];

    if (uniqueIds.length !== paperIds.length) {
      return res.status(400).json({
        message: "Please select each paper only once.",
      });
    }

    // Retrieve only papers owned by the authenticated user.
    const papers = await Paper.find({
      _id: { $in: paperIds },
      owner: req.user.userId,
    }).lean();

    // Ensure every requested paper was found and belongs to the user.
    if (papers.length !== paperIds.length) {
      return res.status(404).json({
        message:
          "One or more papers were not found or you do not have permission to access them.",
      });
    }

    // Analyse keywords, publication details, and abstracts.
    const keywordAnalysis = analyzeKeywords(papers);
    const publicationAnalysis = analyzePublications(papers);
    const abstractAnalysis = analyzeAbstracts(papers);

    // Build the structured comparison.
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
