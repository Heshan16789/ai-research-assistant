import express from "express";

import { clusterProjectPapers } from "../controllers/clusteringController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Cluster all research papers in a selected project.
router.post("/:projectId", protect, clusterProjectPapers);

export default router;