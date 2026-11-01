import mongoose from "mongoose";

import Paper from "../models/Paper.js";
import Project from "../models/Project.js";

import { recommendPapers } from "../services/mlService.js";


export const getPaperRecommendations = async (req, res) => {
  try {
    const { projectId, paperId } = req.params;
    const requestedTopK = req.body?.topK ?? 5;

    if (
      !mongoose.isValidObjectId(projectId) ||
      !mongoose.isValidObjectId(paperId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID or paper ID.",
      });
    }

    if (
      !Number.isInteger(requestedTopK) ||
      requestedTopK < 1 ||
      requestedTopK > 20
    ) {
      return res.status(400).json({
        success: false,
        message: "topK must be an integer between 1 and 20.",
      });
    }

    // Verify that the authenticated user owns the project.
    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.userId,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied.",
      });
    }

    // Verify that the selected paper belongs to this project and user.
    const targetPaper = await Paper.findOne({
      _id: paperId,
      project: project._id,
      owner: req.user.userId,
    });

    if (!targetPaper) {
      return res.status(404).json({
        success: false,
        message: "Selected research paper not found or access denied.",
      });
    }

    // Retrieve all papers in the selected project.
    const papers = await Paper.find({
      project: project._id,
      owner: req.user.userId,
    })
      .select("title abstract keywords")
      .sort({ createdAt: -1 })
      .lean();

    if (papers.length < 2) {
      return res.status(400).json({
        success: false,
        message: "At least two papers are required for recommendations.",
        totalPapers: papers.length,
      });
    }

    const recommendationInput = papers.map((paper) => ({
      paperId: paper._id.toString(),
      title: paper.title,
      abstract: paper.abstract || "",
      keywords: paper.keywords || [],
    }));

    const result = await recommendPapers(
      targetPaper._id.toString(),
      recommendationInput,
      requestedTopK
    );

    return res.status(200).json({
      success: true,
      message: "Research paper recommendations generated successfully.",
      project: {
        projectId: project._id,
        title: project.title,
      },
      recommendation: result,
    });

  } catch (error) {
    console.error("Paper recommendation error:", error.message);

    return res.status(502).json({
      success: false,
      message: "Unable to generate recommendations. Check the ML service.",
    });
  }
};