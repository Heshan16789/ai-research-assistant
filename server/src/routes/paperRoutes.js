import express from "express";

import {
  createPaper,
  getProjectPapers,
  updatePaper,
  deletePaper,
} from "../controllers/paperController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/:projectId", protect, createPaper);

router.get("/:projectId", protect, getProjectPapers);

router.put("/:projectId/:paperId", protect, updatePaper);

router.delete("/:projectId/:paperId", protect, deletePaper);

export default router;