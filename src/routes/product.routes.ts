// src/routes/products.ts
import { Router } from "express";
import multer from "multer";
import * as Product from "../controllers/product.controller";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Debug middleware - add this temporarily
const debugRequest = (req: any, res: any, next: any) => {
  console.log('=== REQUEST DEBUG ===');
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Body keys:', Object.keys(req.body));
  console.log('Body:', req.body);
  next();
};

// Multer error handler
const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer Error:', err.code, err.field);
    return res.status(400).json({ 
      error: 'File upload error', 
      code: err.code,
      field: err.field,
      message: err.message 
    });
  }
  next(err);
};

const uploadAny = (req: any, res: any, next: any) => {
  upload.any()(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return handleMulterError(err, req, res, next);
    }
    console.log('Files received:', req.files);
    next();
  });
};

// Public routes
router.get("/", Product.listProducts);
router.get("/popular", Product.getPopularProducts);
router.get("/:id", Product.getProduct);

// Admin routes
router.post(
  "/",
  requireAuth,
  requireRole(["admin"]),
  debugRequest,  // Add debug
  uploadAny,
  Product.createProduct
);

router.patch(
  "/:id",
  requireAuth,
  requireRole(["admin"]),
  debugRequest,  // Add debug
  uploadAny,
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