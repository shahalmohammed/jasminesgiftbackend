import { Router } from "express";
import { register, login, me } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.post("/register", register);
router.post("/login", login);

// Example protected endpoints:
router.get("/me", requireAuth, me);
router.get("/admin-only", requireAuth, requireRole(["admin"]), (_req, res) => {
  res.json({ ok: true, message: "Hello, admin!" });
});

export default router;
