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

// Admin routes - use upload.array("images", 5) for multiple images
router.post("/", requireAuth, requireRole(["admin"]), upload.array("images", 5), Product.createProduct);
router.patch("/:id", requireAuth, requireRole(["admin"]), upload.array("images", 5), Product.updateProduct);
router.patch("/:id/toggle-popular", requireAuth, requireRole(["admin"]), Product.togglePopular);

// Image management routes
router.delete("/:id/images/:imageIndex", requireAuth, requireRole(["admin"]), Product.deleteProductImage);
router.patch("/:id/images/:imageIndex/set-primary", requireAuth, requireRole(["admin"]), Product.setPrimaryImage);

// Product deletion
router.delete("/:id", requireAuth, requireRole(["admin"]), Product.deleteProduct);

// Sales tracking
router.post("/:id/sell", requireAuth, requireRole(["admin"]), Product.addSale);

export default router;