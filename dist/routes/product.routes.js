"use strict";

const { Router } = require("express");
const multer = require("multer");
const ProductController = require("../controllers/product.controller");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");

// Multer in-memory storage (suitable for uploading to R2/S3)
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// Public routes
router.get("/", ProductController.listProducts);
router.get("/popular", ProductController.getPopularProducts);
router.get("/:id", ProductController.getProduct);

// Admin-protected routes

// Create product with up to 5 images
// Expect: multipart/form-data, files under "images"
router.post(
  "/",
  requireAuth,
  requireRole(["admin"]),
  upload.array("images", 15),
  ProductController.createProduct
);

// Update product with optional up to 5 new images (replace existing)
router.patch(
  "/:id",
  requireAuth,
  requireRole(["admin"]),
  upload.array("images", 15),
  ProductController.updateProduct
);

// Toggle popular flag
router.patch(
  "/:id/toggle-popular",
  requireAuth,
  requireRole(["admin"]),
  ProductController.togglePopular
);

// Delete product
router.delete(
  "/:id",
  requireAuth,
  requireRole(["admin"]),
  ProductController.deleteProduct
);

// Record a sale
router.post(
  "/:id/sell",
  requireAuth,
  requireRole(["admin"]),
  ProductController.addSale
);

module.exports = router;
