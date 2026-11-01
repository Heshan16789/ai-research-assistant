
import express from "express";
import { generateKeywords } from "../controllers/keywordController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/extract", protect, generateKeywords);

export default router;
