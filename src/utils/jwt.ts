import { env } from "../config/env";

import jwt, { SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

export function signJwt(payload: object, options?: SignOptions) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m", ...options });
}

export function verifyJwt<T = object>(token: string): T {
  return jwt.verify(token, JWT_SECRET) as T;
}
