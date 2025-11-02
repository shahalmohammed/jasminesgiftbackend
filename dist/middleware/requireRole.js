"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = void 0;
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        if (!req.userRole || !roles.includes(req.userRole)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        next();
    };
};
exports.requireRole = requireRole;
