import express from "express";
import cors from "cors";
import { connectDB } from "./db";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import productRoutes from "./routes/product.routes";
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => res.send("Auth API is running"));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:8080"], 
  credentials: true,
  allowedHeaders: ["Authorization", "Content-Type"],
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
}));

connectDB().then(() => {
  app.listen(Number(env.PORT), () => {
    console.log(`🚀 Server http://localhost:${env.PORT}`);
  });
});
