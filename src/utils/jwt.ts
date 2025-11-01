// src/utils/jwt.ts
import jwt, { SignOptions, JwtPayload as BaseJwtPayload } from "jsonwebtoken";

export interface AppJwtPayload extends BaseJwtPayload {
  sub: string;
  role: "admin" | "user";
}

const JWT_SECRET: string = process.env.JWT_SECRET || "";
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

export function signJwt(payload: object, options?: SignOptions) {
  // JWT_SECRET is a guaranteed string
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m", ...options });
}

export function verifyJwt<T extends object = AppJwtPayload>(token: string): T {
  return jwt.verify(token, JWT_SECRET) as T;
}
