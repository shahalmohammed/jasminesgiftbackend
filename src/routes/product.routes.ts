import { Router } from "express";
import multer from "multer";
import * as Product from "../controllers/product.controller";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// Configure multer to accept both "images" and "image" field names
const uploadImages = upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'image', maxCount: 5 }
]);

// Public routes
router.get("/", Product.listProducts);
router.get("/popular", Product.getPopularProducts);
router.get("/:id", Product.getProduct);

// Admin routes - accepts both "images" and "image" field names
router.post("/", requireAuth, requireRole(["admin"]), uploadImages, Product.createProduct);
router.patch("/:id", requireAuth, requireRole(["admin"]), uploadImages, Product.updateProduct);
router.patch("/:id/toggle-popular", requireAuth, requireRole(["admin"]), Product.togglePopular);

// Image management routes
router.delete("/:id/images/:imageIndex", requireAuth, requireRole(["admin"]), Product.deleteProductImage);
router.patch("/:id/images/:imageIndex/set-primary", requireAuth, requireRole(["admin"]), Product.setPrimaryImage);

// Product deletion
router.delete("/:id", requireAuth, requireRole(["admin"]), Product.deleteProduct);

// Sales tracking
router.post("/:id/sell", requireAuth, requireRole(["admin"]), Product.addSale);

export default router;