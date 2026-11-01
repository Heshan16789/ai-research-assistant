
import { extractKeywords } from "../services/mlService.js";

export const generateKeywords = async (req, res) => {
  try {
    const { text } = req.body ?? {};

    if (typeof text !== "string" || text.trim().length < 30) {
      return res.status(400).json({
        success: false,
        message: "Please provide an abstract containing at least 30 characters.",
      });
    }

    if (text.length > 20000) {
      return res.status(400).json({
        success: false,
        message: "Abstract cannot exceed 20,000 characters.",
      });
    }

    const result = await extractKeywords(text.trim());

    return res.status(200).json({
      success: true,
      message: "Keywords extracted successfully.",
      algorithm: result.algorithm,
      totalKeywords: result.totalKeywords,
      keywords: result.keywords,
    });
  } catch (error) {
    console.error("Keyword extraction error:", error.message);

    return res.status(503).json({
      success: false,
      message: error.message,
    });
  }
};
