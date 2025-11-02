import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";

export const requireRole = (roles: ("user" | "admin")[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};
