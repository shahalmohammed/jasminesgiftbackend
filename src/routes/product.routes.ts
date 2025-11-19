// src/routes/products.ts
import { Router } from "express";
import multer from "multer";
import * as Product from "../controllers/product.controller";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

const storage = multer.memoryStorage();

// accept up to 5 files from field name "images"
const upload = multer({ storage }).array("images", 5);

// Public routes
router.get("/", Product.listProducts);
router.get("/popular", Product.getPopularProducts);
router.get("/:id", Product.getProduct);

// Admin routes
router.post(
  "/",
  requireAuth,
  requireRole(["admin"]),
  upload,
  Product.createProduct
);

router.patch(
  "/:id",
  requireAuth,
  requireRole(["admin"]),
  upload,
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
