import { Router } from "express";
import multer from "multer";
import * as Product from "../controllers/product.controller";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file (adjust as needed)
    files: 5,
  },
});

// Public routes
router.get("/", Product.listProducts);
router.get("/popular", Product.getPopularProducts);
router.get("/:id", Product.getProduct);

// Admin routes (single endpoint: data + images)
router.post(
  "/",
  requireAuth,
  requireRole(["admin"]),
  upload.array("images", 5), // <-- field name "images" matches Postman
  Product.createProduct
);

router.patch(
  "/:id",
  requireAuth,
  requireRole(["admin"]),
  upload.array("images", 5), // optional new images
  Product.updateProduct
);

router.patch(
  "/:id/toggle-popular",
  requireAuth,
  requireRole(["admin"]),
  Product.togglePopular
);

router.delete("/:id", requireAuth, requireRole(["admin"]), Product.deleteProduct);

router.post("/:id/sell", requireAuth, requireRole(["admin"]), Product.addSale);

export default router;
