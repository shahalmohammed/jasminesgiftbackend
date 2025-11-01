import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type JWTPayload = { sub: string; role: "user" | "admin" };

export const signJwt = (payload: JWTPayload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

export const verifyJwt = (token: string) =>
  jwt.verify(token, env.JWT_SECRET) as JWTPayload;
