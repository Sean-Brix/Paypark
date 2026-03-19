import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { router } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "../public");

export const app = express();

// Open CORS for all origins as requested.
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api", router);

// Serve static files from public directory (built React app)
app.use(express.static(publicDir));

// SPA fallback: serve index.html for any unmatched routes
// This allows client-side routing to work (e.g., /dashboard, /kiosk)
app.get("*", (req, res) => {
  const indexPath = path.join(publicDir, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).json({
        success: false,
        message: "Frontend not found. Run 'npm run build' from root to generate it.",
      });
    }
  });
});

app.use(errorHandler);
