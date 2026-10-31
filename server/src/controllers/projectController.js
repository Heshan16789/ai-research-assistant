import Project from "../models/Project.js";

export const createProject = async (req, res) => {
  try {
    const {
      title,
      description,
      researchQuestion,
      status,
      tags,
    } = req.body ?? {};

    // Validate project title
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project title is required.",
      });
    }

    if (title.trim().length > 150) {
      return res.status(400).json({
        success: false,
        message: "Project title cannot exceed 150 characters.",
      });
    }

    // Validate optional text fields
    if (
      description !== undefined &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be a string.",
      });
    }

    if (
      researchQuestion !== undefined &&
      typeof researchQuestion !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Research question must be a string.",
      });
    }

    // Validate status
    const allowedStatuses = [
      "Planning",
      "In Progress",
      "Completed",
    ];

    if (
      status !== undefined &&
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid project status.",
      });
    }

    // Validate tags
    if (
      tags !== undefined &&
      (!Array.isArray(tags) ||
        !tags.every((tag) => typeof tag === "string"))
    ) {
      return res.status(400).json({
        success: false,
        message: "Tags must be an array of strings.",
      });
    }

    // Create project
    const project = await Project.create({
      title: title.trim(),
      description: description?.trim() || "",
      researchQuestion: researchQuestion?.trim() || "",
      status: status || "Planning",
      tags: (tags || [])
        .map((tag) => tag.trim())
        .filter(Boolean),
      owner: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Research project created successfully.",
      project,
    });
  } catch (error) {
    console.error("Project creation failed:", error.name);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid project information.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create research project.",
    });
  }
};

export const getMyProjects = async (req, res) => {
  try {
    const projects = await Project.find({
      owner: req.user.userId,
    }).sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: projects.length,
      projects,
    });
  } catch (error) {
    console.error("Fetching projects failed:", error.name);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve research projects.",
    });
  }
};

export const updateProject = async (req, res) => {
  try {
    const { title, description, researchQuestion, status, tags } =
      req.body ?? {};

    const updates = {};

    // Validate and prepare title
    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Project title cannot be empty.",
        });
      }

      if (title.trim().length > 150) {
        return res.status(400).json({
          success: false,
          message: "Project title cannot exceed 150 characters.",
        });
      }

      updates.title = title.trim();
    }

    // Validate description
    if (description !== undefined) {
      if (typeof description !== "string") {
        return res.status(400).json({
          success: false,
          message: "Description must be a string.",
        });
      }

      updates.description = description.trim();
    }

    // Validate research question
    if (researchQuestion !== undefined) {
      if (typeof researchQuestion !== "string") {
        return res.status(400).json({
          success: false,
          message: "Research question must be a string.",
        });
      }

      updates.researchQuestion = researchQuestion.trim();
    }

    // Validate status
    if (status !== undefined) {
      const allowedStatuses = [
        "Planning",
        "In Progress",
        "Completed",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid project status.",
        });
      }

      updates.status = status;
    }

    // Validate tags
    if (tags !== undefined) {
      if (
        !Array.isArray(tags) ||
        !tags.every((tag) => typeof tag === "string")
      ) {
        return res.status(400).json({
          success: false,
          message: "Tags must be an array of strings.",
        });
      }

      updates.tags = tags.map((tag) => tag.trim()).filter(Boolean);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update.",
      });
    }

    // Update only a project owned by the authenticated user
    const project = await Project.findOneAndUpdate(
      {
        _id: req.params.id,
        owner: req.user.userId,
      },
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Research project updated successfully.",
      project,
    });
  } catch (error) {
    console.error("Project update failed:", error.name);

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid project information or project ID.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to update research project.",
    });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({
      _id: req.params.id,
      owner: req.user.userId,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Research project deleted successfully.",
    });
  } catch (error) {
    console.error("Project deletion failed:", error.name);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to delete research project.",
    });
  }
};