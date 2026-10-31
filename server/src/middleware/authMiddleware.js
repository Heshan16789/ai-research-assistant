import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check whether the Authorization header exists.
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in.",
      });
    }

    // Extract the token after "Bearer ".
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    // Verify the token using the secret stored in .env.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the authenticated user's ID to the request.
    req.user = {
      userId: decoded.userId,
    };

    // Continue to the requested endpoint.
    next();
  } catch (error) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
      });
    }

    console.error("Authentication failed:", error.name);

    return res.status(500).json({
      success: false,
      message: "Authentication failed. Please try again.",
    });
  }
};