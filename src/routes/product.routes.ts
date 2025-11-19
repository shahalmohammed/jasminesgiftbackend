// src/routes/products.ts
import { Router } from "express";
import multer from "multer";
import * as Product from "../controllers/product.controller";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  }
});

// Custom middleware to handle upload with better error handling
const handleUpload = (req: any, res: any, next: any) => {
  const uploadMiddleware = upload.any();
  
  uploadMiddleware(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err);
      return res.status(400).json({ 
        error: 'File upload error',
        details: err.message,
        code: err.code 
      });
    } else if (err) {
      console.error('Unknown upload error:', err);
      return res.status(500).json({ 
        error: 'Upload failed',
        details: err.message 
      });
    }
    
    // Log what we received
    console.log('Files received:', req.files?.length || 0);
    if (req.files) {
      req.files.forEach((f: any) => console.log('  -', f.fieldname, f.originalname));
    }
    
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
  handleUpload,
  Product.createProduct
);

router.patch(
  "/:id",
  requireAuth,
  requireRole(["admin"]),
  handleUpload,
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