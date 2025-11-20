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

// main create/update still use single "image" as primary image
router.post(
  "/",
  requireAuth,
  requireRole(["admin"]),
  upload.single("image"),
  Product.createProduct
);

router.patch(
  "/:id",
  requireAuth,
  requireRole(["admin"]),
  upload.single("image"),
  Product.updateProduct
);

// NEW: separate endpoint to add additional images (up to 5 total)
router.post(
  "/:id/images",
  requireAuth,
  requireRole(["admin"]),
  upload.single("image"),      // one image per request
  Product.addProductImage
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
