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

// Changed from upload.single("image") to upload.array("images", 5)
router.post("/", requireAuth, requireRole(["admin"]), upload.array("images", 5), Product.createProduct);
router.patch("/:id", requireAuth, requireRole(["admin"]), upload.array("images", 5), Product.updateProduct);
router.patch("/:id/toggle-popular", requireAuth, requireRole(["admin"]), Product.togglePopular); 
router.delete("/:id", requireAuth, requireRole(["admin"]), Product.deleteProduct);

router.post("/:id/sell", requireAuth, requireRole(["admin"]), Product.addSale);

export default router;