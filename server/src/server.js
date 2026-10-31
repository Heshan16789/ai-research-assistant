import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import dns from "node:dns";
import authRoutes from "./routes/authRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import paperRoutes from "./routes/paperRoutes.js";

// Load environment variables from server/.env
dotenv.config();

// Workaround for the DNS lookup issue on your Windows setup
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const app = express();
const PORT = process.env.PORT || 5000;

// Read JSON request bodies
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/papers", paperRoutes);

// Check API and database connection status
app.get("/api/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    message: "Research Assistant API is running",
    database: databaseConnected ? "connected" : "disconnected",
  });
});

// Connect to MongoDB before starting the server
const startServer = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from server/.env");
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "research_assistant",
      serverSelectionTimeoutMS: 10000,
    });

    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Startup failed:", error.name);
    console.error("Details:", error.message);
    console.error(
      "Check MONGODB_URI in server/.env, your database password, and Atlas IP access."
    );

    process.exit(1);
  }
};

startServer();