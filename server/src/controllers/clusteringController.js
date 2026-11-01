import mongoose from "mongoose";

import Paper from "../models/Paper.js";
import Project from "../models/Project.js";

import { clusterPapers } from "../services/mlService.js";


// --------------------------------------------------
// Cluster research papers in a project
// --------------------------------------------------

export const clusterProjectPapers = async (req, res) => {
  try {
    const { projectId } = req.params;

    const requestedClusters = req.body?.numberOfClusters;

    // Validate project ID.
    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID.",
      });
    }

    // Verify project ownership.
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

    // Retrieve only papers belonging to this user and project.
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
        message: "At least two research papers are required for clustering.",
        totalPapers: papers.length,
      });
    }

    // Validate requested cluster count when provided.
    if (requestedClusters !== undefined) {
      if (
        !Number.isInteger(requestedClusters) ||
        requestedClusters < 2 ||
        requestedClusters > Math.min(10, papers.length)
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Number of clusters must be between 2 and ${Math.min(10, papers.length)}.`,
        });
      }
    }

    // Prepare paper data for the Python ML service.
    const clusteringInput = papers.map((paper) => ({
      paperId: paper._id.toString(),
      title: paper.title,
      abstract: paper.abstract || "",
      keywords: paper.keywords || [],
    }));

    // Execute K-Means clustering.
    const result = await clusterPapers(
      clusteringInput,
      requestedClusters
    );

    return res.status(200).json({
      success: true,
      message: "Research papers clustered successfully.",
      project: {
        projectId: project._id,
        title: project.title,
      },
      clustering: result,
    });

  } catch (error) {
    console.error("Paper clustering error:", error.message);

    return res.status(502).json({
      success: false,
      message: "Unable to complete paper clustering. Check the ML service.",
    });
  }
};