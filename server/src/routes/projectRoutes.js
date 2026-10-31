import express from "express";

import {
  createProject,
  getMyProjects,
  updateProject,
  deleteProject,
} from "../controllers/projectController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all projects belonging to the logged-in user
router.get("/", protect, getMyProjects);

// Create a new research project
router.post("/", protect, createProject);

// Update an existing research project
router.put("/:id", protect, updateProject);

// Delete an existing research project
router.delete("/:id", protect, deleteProject);

export default router;