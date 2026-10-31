import express from "express";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/protected", protect, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "You have accessed a protected route!",
    userId: req.user.userId,
  });
});

export default router;