import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: process.env.PORT || "4000",
  MONGODB_URI: process.env.MONGODB_URI || "",
  JWT_SECRET: process.env.JWT_SECRET || "",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1d",
};

if (!env.MONGODB_URI) throw new Error("MONGODB_URI is required");
if (!env.JWT_SECRET) throw new Error("JWT_SECRET is required");
