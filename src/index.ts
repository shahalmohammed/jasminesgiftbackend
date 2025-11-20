import express from "express";
import cors from "cors";
import { connectDB } from "./db";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import productRoutes from "./routes/product.routes";

const app = express();

// Single CORS setup (only once)
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:8080"],
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);

// JSON parser (used only for JSON endpoints)
app.use(express.json());

// Do NOT parse multipart—Multer handles that per-route

app.get("/", (_req, res) => res.send("Auth API is running"));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);

// Start server
connectDB().then(() => {
  app.listen(Number(env.PORT), () => {
    console.log(`🚀 Server http://localhost:${env.PORT}`);
  });
});
