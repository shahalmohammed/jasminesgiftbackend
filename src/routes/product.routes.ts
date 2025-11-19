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

// CREATE — allow up to 5 images under "images" and optionally single "image"
router.post(
  "/",
  requireAuth,
  requireRole(["admin"]),
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "image", maxCount: 1 }, // legacy / single-file field
  ]),
  Product.createProduct
);

// UPDATE — allow up to 5 images under "images" and optionally single "image"
router.patch(
  "/:id",
  requireAuth,
  requireRole(["admin"]),
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "image", maxCount: 1 },
  ]),
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
