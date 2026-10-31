import Paper from "../models/Paper.js";
import Project from "../models/Project.js";

export const createPaper = async (req, res) => {
  try {
    const {
      title,
      authors,
      abstract,
      publicationYear,
      venue,
      doi,
      keywords,
      pdfUrl,
    } = req.body ?? {};

    const { projectId } = req.params;

    // Validate paper title
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Paper title is required.",
      });
    }

    if (title.trim().length > 300) {
      return res.status(400).json({
        success: false,
        message: "Paper title cannot exceed 300 characters.",
      });
    }

    // Validate optional text fields
    if (
      abstract !== undefined &&
      typeof abstract !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Abstract must be a string.",
      });
    }

    if (
      venue !== undefined &&
      typeof venue !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Venue must be a string.",
      });
    }

    if (
      doi !== undefined &&
      typeof doi !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "DOI must be a string.",
      });
    }

    if (
      pdfUrl !== undefined &&
      typeof pdfUrl !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "PDF URL must be a string.",
      });
    }

    // Validate authors and keywords
    if (
      authors !== undefined &&
      (!Array.isArray(authors) ||
        !authors.every((author) => typeof author === "string"))
    ) {
      return res.status(400).json({
        success: false,
        message: "Authors must be an array of strings.",
      });
    }

    if (
      keywords !== undefined &&
      (!Array.isArray(keywords) ||
        !keywords.every((keyword) => typeof keyword === "string"))
    ) {
      return res.status(400).json({
        success: false,
        message: "Keywords must be an array of strings.",
      });
    }

    // Validate publication year
    if (
      publicationYear !== undefined &&
      (!Number.isInteger(publicationYear) ||
        publicationYear < 1900 ||
        publicationYear > 2100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid publication year.",
      });
    }

    // Verify that the project belongs to the logged-in user
    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.userId,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Research project not found.",
      });
    }

    // Save the paper
    const paper = await Paper.create({
      title: title.trim(),
      authors: (authors || []).map((author) => author.trim()),
      abstract: abstract?.trim() || "",
      publicationYear,
      venue: venue?.trim() || "",
      doi: doi?.trim() || "",
      keywords: (keywords || [])
        .map((keyword) => keyword.trim())
        .filter(Boolean),
      pdfUrl: pdfUrl?.trim() || "",
      project: project._id,
      owner: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Research paper added successfully.",
      paper,
    });
  } catch (error) {
    console.error("Paper creation failed:", error.name);

    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid paper information or project ID.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to add research paper.",
    });
  }
};

// Get all papers belonging to a project
export const getProjectPapers = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Check whether the project belongs to the logged-in user
    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.userId,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    // Retrieve papers belonging to this project
    const papers = await Paper.find({
      project: projectId,
      owner: req.user.userId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: papers.length,
      papers,
    });
  } catch (error) {
    console.error("Get project papers error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve research papers.",
    });
  }
};

export const updatePaper = async (req, res) => {
  try {
    const { projectId, paperId } = req.params;

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

    const updates = {};

    // Only allow approved fields to be updated
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update.",
      });
    }

    if (
      updates.title !== undefined &&
      (typeof updates.title !== "string" || !updates.title.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Paper title cannot be empty.",
      });
    }

    const paper = await Paper.findOneAndUpdate(
      {
        _id: paperId,
        project: projectId,
        owner: req.user.userId,
      },
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: "Research paper not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Research paper updated successfully.",
      paper,
    });
  } catch (error) {
    console.error("Update paper error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update research paper.",
    });
  }
};

export const deletePaper = async (req, res) => {
  try {
    const { projectId, paperId } = req.params;

    const paper = await Paper.findOneAndDelete({
      _id: paperId,
      project: projectId,
      owner: req.user.userId,
    });

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: "Research paper not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Research paper deleted successfully.",
    });
  } catch (error) {
    console.error("Delete paper error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete research paper.",
    });
  }
};