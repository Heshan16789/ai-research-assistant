import express from "express";
import { comparePapers } from "../controllers/comparisonController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, comparePapers);

export default router;