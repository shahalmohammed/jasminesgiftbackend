"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_1 = require("../middleware/auth");
const requireRole_1 = require("../middleware/requireRole");
const router = (0, express_1.Router)();
router.post("/register", auth_controller_1.register);
router.post("/login", auth_controller_1.login);
// Example protected endpoints:
router.get("/me", auth_1.requireAuth, auth_controller_1.me);
router.get("/admin-only", auth_1.requireAuth, (0, requireRole_1.requireRole)(["admin"]), (_req, res) => {
    res.json({ ok: true, message: "Hello, admin!" });
});
exports.default = router;
