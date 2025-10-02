import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { router as programRouter } from "./routes/program-with-progress";
import { router as sessionRouter } from "./routes/session";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API routes
app.use("/api/programs", programRouter);
app.use("/api/sessions", sessionRouter);

app.get("/", (req, res) => {
  res.json({
    message: "🏭 AI Program Factory API",
    version: "1.0.0",
    endpoints: {
      "POST /api/programs": "Create a new training program",
      "GET /api/programs/:id": "Get program details"
    }
  });
});

// Handle 404s
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});