import express from "express";

import { getPaperRecommendations } from "../controllers/recommendationController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Generate recommendations for a selected paper in a project.
router.post("/:projectId/:paperId", protect, getPaperRecommendations);

export default router;