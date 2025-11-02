import type { Request, Response, NextFunction } from "express";
import { verifyJwt, AppJwtPayload } from "../utils/jwt";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: "admin" | "user";
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized auth" });

  const token = header.slice("Bearer ".length);
  const payload = verifyJwt<AppJwtPayload>(token); // <-- typed
  req.userId = payload.sub;
  req.userRole = payload.role;
  next();
}
