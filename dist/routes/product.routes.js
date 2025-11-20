"use strict";
const { Router } = require("express");
const multer = require("multer");
const Product = require("../controllers/product.controller");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.get("/", Product.listProducts);
router.get("/popular", Product.getPopularProducts);
router.get("/:id", Product.getProduct);

router.post(
  "/",
  requireAuth,
  requireRole(["admin"]),
  upload.array("images", 5),       // <--- multiple images
  Product.createProduct
);

router.patch(
  "/:id",
  requireAuth,
  requireRole(["admin"]),
  upload.array("images", 5),       // <--- multiple images
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

module.exports = router;
