import { Router } from "express";
import multer from "multer";
import * as Product from "../controllers/product.controller";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";

const upload = multer({ storage: multer.memoryStorage() });

const uploadProductImages = upload.fields([
  { name: "frontImage", maxCount: 1 },
  { name: "leftImage", maxCount: 1 },
  { name: "rightImage", maxCount: 1 },
  { name: "backImage", maxCount: 1 },
  { name: "overallImage", maxCount: 1 },
]);

const router = Router();

router.get("/", Product.listProducts);
router.get("/popular", Product.getPopularProducts);
router.get("/:id", Product.getProduct);

router.post(
  "/",
  requireAuth,
  requireRole(["admin"]),
  uploadProductImages,
  Product.createProduct
);

router.patch(
  "/:id",
  requireAuth,
  requireRole(["admin"]),
  uploadProductImages,
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
