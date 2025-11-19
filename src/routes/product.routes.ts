// src/routes/products.ts
import { Router } from "express";
import multer from "multer";
import * as Product from "../controllers/product.controller";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.get("/", Product.listProducts);
router.get("/popular", Product.getPopularProducts);
router.get("/:id", Product.getProduct);

// CREATE — allow up to 5 images under field name "images"
router.post(
  "/",
  requireAuth,
  requireRole(["admin"]),
  upload.array("images", 5),
  Product.createProduct
);

// UPDATE — allow up to 5 images under field name "images"
router.patch(
  "/:id",
  requireAuth,
  requireRole(["admin"]),
  upload.array("images", 5),
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
