import { Router } from "express";
import multer from "multer";
import * as Product from "../controllers/product.controller"; 
import { auth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.get("/", Product.listProducts);                  
router.get("/popular", Product.getPopularProducts);             
router.get("/:id", Product.getProduct);                 

router.post("/", auth, requireRole(["admin"]), upload.single("image"), Product.createProduct);
router.patch("/:id", auth, requireRole(["admin"]), upload.single("image"), Product.updateProduct);
router.patch("/:id/toggle-popular", auth, requireRole(["admin"]), Product.togglePopular); 
router.delete("/:id", auth, requireRole(["admin"]), Product.deleteProduct);

router.post("/:id/sell", auth, requireRole(["admin"]), Product.addSale);

export default router;
