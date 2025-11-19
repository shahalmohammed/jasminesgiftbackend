// src/server.ts (or src/index.ts depending on your setup)
import express from "express";
import cors from "cors";
import { connectDB } from "./db";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import productRoutes from "./routes/product.routes";

const app = express();

// CORS configuration (do this once, before routes)
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:8080"],
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);

// JSON body parsing
app.use(express.json());

// Root route – just to confirm server is up
app.get("/", (_req, res) => res.send("Auth API is running"));

// Simple health check for Postman / Vercel
app.get("/api/health", (_req, res) => {
  console.log("Health check hit");
  res.json({ ok: true, time: new Date().toISOString() });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);

// Connect DB
connectDB()
  .then(() => {
    console.log("✅ MongoDB connected");
    // Local dev: start listening if this file is run directly
    if (require.main === module) {
      const port = Number(env.PORT) || 4000;
      app.listen(port, () => {
        console.log(`🚀 Server http://localhost:${port}`);
      });
    }
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err);
  });

// Export the app for serverless / Vercel adapters
export default app;
