
import mongoose from "mongoose";

import Paper from "../models/Paper.js";
import Project from "../models/Project.js";


// --------------------------------------------------
// Validation helpers
// --------------------------------------------------

const isValidId = (id) => mongoose.isValidObjectId(id);

const allowedFields = [
  "title",
  "authors",
  "abstract",
  "publicationYear",
  "venue",
  "doi",
  "keywords",
  "pdfUrl",
];

const validatePaperData = (body, isCreate = false) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      error: "Invalid research paper information.",
    };
  }

  const updates = {};

  const textLimits = {
    title: 300,
    abstract: 10000,
    venue: 500,
    doi: 500,
    pdfUrl: 2000,
  };

  for (const field of Object.keys(textLimits)) {
    if (body[field] === undefined) continue;

    if (typeof body[field] !== "string") {
      return { error: `${field} must be text.` };
    }

    const value = body[field].trim();

    if (field === "title" && !value) {
      return { error: "Paper title is required." };
    }

    if (value.length > textLimits[field]) {
      return {
        error: `${field} cannot exceed ${textLimits[field]} characters.`,
      };
    }

    if (field === "pdfUrl" && value) {
      try {
        const parsedUrl = new URL(value);

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          return { error: "PDF URL must use HTTP or HTTPS." };
        }
      } catch {
        return { error: "Please provide a valid PDF URL." };
      }
    }

    updates[field] = value;
  }

  if (body.authors !== undefined) {
    if (
      !Array.isArray(body.authors) ||
      !body.authors.every(
        (author) =>
          typeof author === "string" && author.length <= 200
      )
    ) {
      return {
        error: "Authors must be an array of text values (maximum 200 characters each).",
      };
    }

    if (body.authors.length > 50) {
      return { error: "A maximum of 50 authors is allowed." };
    }

    updates.authors = body.authors
      .map((author) => author.trim())
      .filter(Boolean);
  }

  if (body.keywords !== undefined) {
    if (
      !Array.isArray(body.keywords) ||
      !body.keywords.every(
        (keyword) =>
          typeof keyword === "string" && keyword.length <= 200
      )
    ) {
      return {
        error: "Keywords must be an array of text values (maximum 200 characters each).",
      };
    }

    if (body.keywords.length > 50) {
      return { error: "A maximum of 50 keywords is allowed." };
    }

    updates.keywords = [
      ...new Set(
        body.keywords
          .map((keyword) => keyword.trim())
          .filter(Boolean)
      ),
    ];
  }

  if (body.publicationYear !== undefined) {
    const year = body.publicationYear;

    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > 2100
    ) {
      return {
        error: "Publication year must be an integer between 1900 and 2100.",
      };
    }

    updates.publicationYear = year;
  }

  if (isCreate && !updates.title) {
    return { error: "Paper title is required." };
  }

  if (!isCreate && Object.keys(updates).length === 0) {
    return {
      error: "Provide at least one valid field to update.",
    };
  }

  return { updates };
};


// --------------------------------------------------
// Verify project ownership
// --------------------------------------------------

const findOwnedProject = async (projectId, userId) => {
  return Project.findOne({
    _id: projectId,
    owner: userId,
  });
};


// --------------------------------------------------
// CREATE: Add a research paper
// POST /api/papers/:projectId
// --------------------------------------------------

export const createPaper = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!isValidId(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID.",
      });
    }

    const project = await findOwnedProject(
      projectId,
      req.user.userId
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Research project not found or access denied.",
      });
    }

    const validation = validatePaperData(req.body, true);

    if (validation.error) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const paper = await Paper.create({
      ...validation.updates,
      project: project._id,
      owner: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Research paper added successfully.",
      paper,
    });

  } catch (error) {
    console.error("Paper creation error:", error.message);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Please check the research paper information.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to add research paper.",
    });
  }
};


// --------------------------------------------------
// READ: Retrieve project papers
// GET /api/papers/:projectId
// Optional query parameters:
// search, year, venue, sortBy, sortOrder
// --------------------------------------------------

export const getProjectPapers = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!isValidId(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID.",
      });
    }

    const project = await findOwnedProject(
      projectId,
      req.user.userId
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Research project not found or access denied.",
      });
    }

    const {
      search,
      year,
      venue,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Only accept known sorting fields.
    const allowedSortFields = [
      "title",
      "publicationYear",
      "venue",
      "createdAt",
      "updatedAt",
    ];

    if (!allowedSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sorting field.",
      });
    }

    if (!["asc", "desc"].includes(sortOrder)) {
      return res.status(400).json({
        success: false,
        message: "Sort order must be asc or desc.",
      });
    }

    const filter = {
      project: project._id,
      owner: req.user.userId,
    };

    // Search across multiple paper fields.
    if (search?.trim()) {
      const safeSearch = search.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const searchRegex = new RegExp(safeSearch, "i");

      filter.$or = [
        { title: searchRegex },
        { abstract: searchRegex },
        { authors: searchRegex },
        { keywords: searchRegex },
        { venue: searchRegex },
        { doi: searchRegex },
      ];
    }

    // Filter by publication year.
    if (year !== undefined) {
      const publicationYear = Number(year);

      if (
        !Number.isInteger(publicationYear) ||
        publicationYear < 1900 ||
        publicationYear > 2100
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid publication year filter.",
        });
      }

      filter.publicationYear = publicationYear;
    }

    // Filter by publication venue.
    if (venue?.trim()) {
      filter.venue = {
        $regex: venue.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    }

    const direction = sortOrder === "asc" ? 1 : -1;
    const sort = { [sortBy]: direction };

    // Use paper title as a secondary sorting field.
    if (sortBy !== "title") {
      sort.title = 1;
    }

    const papers = await Paper.find(filter)
      .sort(sort)
      .lean();

    return res.status(200).json({
      success: true,
      count: papers.length,
      papers,
      filters: {
        search: search || "",
        year: year || null,
        venue: venue || "",
        sortBy,
        sortOrder,
      },
    });

  } catch (error) {
    console.error("Get project papers error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve research papers.",
    });
  }
};


// --------------------------------------------------
// UPDATE: Edit a research paper
// PUT /api/papers/:projectId/:paperId
// --------------------------------------------------

export const updatePaper = async (req, res) => {
  try {
    const { projectId, paperId } = req.params;

    if (!isValidId(projectId) || !isValidId(paperId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID or paper ID.",
      });
    }

    const project = await findOwnedProject(
      projectId,
      req.user.userId
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Research project not found or access denied.",
      });
    }

    const validation = validatePaperData(req.body);

    if (validation.error) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const paper = await Paper.findOneAndUpdate(
      {
        _id: paperId,
        project: project._id,
        owner: req.user.userId,
      },
      {
        $set: validation.updates,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: "Research paper not found or access denied.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Research paper updated successfully.",
      paper,
    });

  } catch (error) {
    console.error("Update paper error:", error.message);

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid research paper information.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update research paper.",
    });
  }
};


// --------------------------------------------------
// DELETE: Remove a research paper
// DELETE /api/papers/:projectId/:paperId
// --------------------------------------------------

export const deletePaper = async (req, res) => {
  try {
    const { projectId, paperId } = req.params;

    if (!isValidId(projectId) || !isValidId(paperId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID or paper ID.",
      });
    }

    const project = await findOwnedProject(
      projectId,
      req.user.userId
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Research project not found or access denied.",
      });
    }

    const paper = await Paper.findOneAndDelete({
      _id: paperId,
      project: project._id,
      owner: req.user.userId,
    });

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: "Research paper not found or access denied.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Research paper deleted successfully.",
      deletedPaperId: paper._id,
    });

  } catch (error) {
    console.error("Delete paper error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to delete research paper.",
    });
  }
};
