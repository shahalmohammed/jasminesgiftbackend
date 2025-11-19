import { Request, Response } from "express";
import { z } from "zod";
import { Product } from "../models/Product";
import { uploadToR2, deleteFromR2 } from "../services/r2";

const PriceField = z.coerce.number().min(0).optional();

const CreateSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    price: PriceField,
    isPopular: z.coerce.boolean().optional(),
});

const UpdateSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    price: PriceField,
    isActive: z.boolean().optional(),
    isPopular: z.coerce.boolean().optional(),
});

const QuerySchema = z.object({
    search: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
});

export const createProduct = async (req: Request, res: Response) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

    // Handle multiple images (up to 5)
    const files = (req as any).files as Express.Multer.File[];
    const images: Array<{ url: string; r2Key: string; isPrimary: boolean }> = [];

    if (files && files.length > 0) {
        if (files.length > 5) {
            return res.status(400).json({ message: "Maximum 5 images allowed" });
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const { key, url } = await uploadToR2({
                buffer: file.buffer,
                mime: file.mimetype,
                prefix: "products/",
                ext: "." + (file.originalname.split(".").pop() || "bin")
            });
            images.push({
                url,
                r2Key: key,
                isPrimary: i === 0 // First image is primary
            });
        }
    }

    const prod = await Product.create({
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price,
        isPopular: parsed.data.isPopular,
        images,
    });

    return res.status(201).json({ product: prod });
};

export const listProducts = async (req: Request, res: Response) => {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

    const { search, page, limit } = parsed.data;
    const filter: any = {};

    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        filter.$or = [{ name: regex }, { description: regex }];
    }

    const [items, total] = await Promise.all([
        Product.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        Product.countDocuments(filter),
    ]);

    return res.json({
        page,
        limit,
        total,
        items,
    });
};

export const getPopularProducts = async (_req: Request, res: Response) => {
    const items = await Product.find({ isActive: true, isPopular: true })
        .sort({ createdAt: -1 });
    return res.json({ items });
};

export const togglePopular = async (req: Request, res: Response) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: "Not found" });

        product.isPopular = !product.isPopular;
        await product.save();

        res.json({
            product,
            message: `Product marked as ${product.isPopular ? "popular" : "not popular"}`,
        });
    } catch (err) {
        console.error("Toggle popular error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const getProduct = async (req: Request, res: Response) => {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json({ product: p });
};

export const updateProduct = async (req: Request, res: Response) => {
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Not found" });

    // Handle new images
    const files = (req as any).files as Express.Multer.File[];
    if (files && files.length > 0) {
        const totalImages = (p.images?.length || 0) + files.length;
        if (totalImages > 5) {
            return res.status(400).json({ 
                message: `Cannot add ${files.length} images. Product already has ${p.images?.length || 0} images. Maximum is 5.` 
            });
        }

        for (const file of files) {
            const { key, url } = await uploadToR2({
                buffer: file.buffer,
                mime: file.mimetype,
                prefix: "products/",
                ext: "." + (file.originalname.split(".").pop() || "bin")
            });
            p.images.push({
                url,
                r2Key: key,
                isPrimary: p.images.length === 0 // First image becomes primary
            });
        }
    }

    Object.assign(p, parsed.data);
    await p.save();
    res.json({ product: p });
};

export const deleteProduct = async (req: Request, res: Response) => {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Not found" });

    // Delete all images from R2
    if (p.images && p.images.length > 0) {
        for (const img of p.images) {
            try {
                await deleteFromR2(img.r2Key);
            } catch (err) {
                console.error(`Failed to delete image ${img.r2Key}:`, err);
            }
        }
    }

    await p.deleteOne();
    res.json({ ok: true });
};

export const deleteProductImage = async (req: Request, res: Response) => {
    const { id, imageIndex } = req.params;
    const index = parseInt(imageIndex);

    const p = await Product.findById(id);
    if (!p) return res.status(404).json({ message: "Product not found" });

    if (index < 0 || index >= p.images.length) {
        return res.status(400).json({ message: "Invalid image index" });
    }

    const image = p.images[index];
    const wasPrimary = image.isPrimary;

    // Delete from R2
    try {
        await deleteFromR2(image.r2Key);
    } catch (err) {
        console.error(`Failed to delete image from R2:`, err);
    }

    // Remove from array
    p.images.splice(index, 1);

    // If deleted image was primary, make first remaining image primary
    if (wasPrimary && p.images.length > 0) {
        p.images[0].isPrimary = true;
    }

    await p.save();
    res.json({ product: p, message: "Image deleted successfully" });
};

export const setPrimaryImage = async (req: Request, res: Response) => {
    const { id, imageIndex } = req.params;
    const index = parseInt(imageIndex);

    const p = await Product.findById(id);
    if (!p) return res.status(404).json({ message: "Product not found" });

    if (index < 0 || index >= p.images.length) {
        return res.status(400).json({ message: "Invalid image index" });
    }

    // Set all to false, then set the selected one to true
    p.images.forEach((img, i) => {
        img.isPrimary = i === index;
    });

    await p.save();
    res.json({ product: p, message: "Primary image updated" });
};

export const addSale = async (req: Request, res: Response) => {
    const qty = Math.max(1, Number(req.query.qty) || 1);
    const p = await Product.findByIdAndUpdate(
        req.params.id,
        { $inc: { salesCount: qty } },
        { new: true }
    );
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json({ product: p });
};