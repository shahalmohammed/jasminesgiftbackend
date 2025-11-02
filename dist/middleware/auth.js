"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jwt_1 = require("../utils/jwt");
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
        return res.status(401).json({ message: "Unauthorized auth" });
    const token = header.slice("Bearer ".length);
    const payload = (0, jwt_1.verifyJwt)(token); // <-- typed
    req.userId = payload.sub;
    req.userRole = payload.role;
    next();
}
