import mongoose from "mongoose";
import { env } from "./config/env";

export const connectDB = async () => {
  await mongoose.connect(env.MONGODB_URI);
  console.log("✅ MongoDB connected");
};
