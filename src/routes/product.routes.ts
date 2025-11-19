// src/routes/products.ts
import { Router } from "express";
import multer from "multer";
import * as Product from "../controllers/product.controller";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// Public routes
router.get("/", Product.listProducts);
router.get("/popular", Product.getPopularProducts);
router.get("/:id", Product.getProduct);

// CREATE — accept files from any field, limit handled in controller
router.post(
  "/",
  requireAuth,
  requireRole(["admin"]),
  upload.any(),
  Product.createProduct
);

// UPDATE — accept files from any field, limit handled in controller
router.patch(
  "/:id",
  requireAuth,
  requireRole(["admin"]),
  upload.any(),
  Product.updateProduct
);

router.patch(
  "/:id/toggle-popular",
  requireAuth,
  requireRole(["admin"]),
  Product.togglePopular
);

router.delete(
  "/:id",
  requireAuth,
  requireRole(["admin"]),
  Product.deleteProduct
);

router.post(
  "/:id/sell",
  requireAuth,
  requireRole(["admin"]),
  Product.addSale
);

export default router;
