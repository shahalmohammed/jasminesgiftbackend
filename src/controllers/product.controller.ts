// src/controllers/product.controller.ts
import { Request, Response } from "express";
import { z } from "zod";
import { Product } from "../models/Product";
import { uploadToR2 } from "../services/r2";

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
  isActive: z.coerce.boolean().optional(),
  isPopular: z.coerce.boolean().optional(),
});

const QuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// For multer.fields([{ name: "images" }, { name: "image" }])
type MulterFiles = {
  images?: Express.Multer.File[];
  image?: Express.Multer.File[];
};

// Create product – up to 5 images
export const createProduct = async (req: Request, res: Response) => {
  try {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ errors: parsed.error.flatten().fieldErrors });
    }

    let imageUrl: string | undefined;
    let images: string[] = [];

    const filesField = (req as any).files as MulterFiles | undefined;
    const files = filesField?.images;
    const singleFile = filesField?.image?.[0];

    if (files && files.length > 0) {
      const limited = files.slice(0, 5);
      const uploads = await Promise.all(
        limited.map((file) =>
          uploadToR2({
            buffer: file.buffer,
            mime: file.mimetype,
            prefix: "products/",
            ext: "." + (file.originalname.split(".").pop() || "bin"),
          })
        )
      );

      images = uploads.map((u) => u.url);
      imageUrl = images[0];
    } else if (singleFile) {
      // fallback single "image" field
      const file = singleFile;
      const { url } = await uploadToR2({
        buffer: file.buffer,
        mime: file.mimetype,
        prefix: "products/",
        ext: "." + (file.originalname.split(".").pop() || "bin"),
      });
      imageUrl = url;
      images = [url];
    }

    const prod = await Product.create({
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price,
      imageUrl,
      images,
      // allow creating as popular if provided
      isPopular: parsed.data.isPopular ?? false,
    });

    return res.status(201).json({ product: prod });
  } catch (err: any) {
    console.error("createProduct error:", err);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: err?.message });
  }
};

export const listProducts = async (req: Request, res: Response) => {
  try {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ errors: parsed.error.flatten().fieldErrors });
    }

    const { search, page, limit } = parsed.data;
    const filter: any = {};

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [{ name: regex }, { description: regex }];
    }

    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    return res.json({
      page,
      limit,
      total,
      items,
    });
  } catch (err: any) {
    console.error("listProducts error:", err);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: err?.message });
  }
};

export const getPopularProducts = async (_req: Request, res: Response) => {
  try {
    const items = await Product.find({ isActive: true, isPopular: true }).sort(
      { createdAt: -1 }
    );
    return res.json({ items });
  } catch (err: any) {
    console.error("getPopularProducts error:", err);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: err?.message });
  }
};

export const togglePopular = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Not found" });

    product.isPopular = !product.isPopular;
    await product.save();

    res.json({
      product,
      message: `Product marked as ${
        product.isPopular ? "popular" : "not popular"
      }`,
    });
  } catch (err: any) {
    console.error("togglePopular error:", err);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: err?.message });
  }
};

export const getProduct = async (req: Request, res: Response) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json({ product: p });
  } catch (err: any) {
    console.error("getProduct error:", err);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: err?.message });
  }
};

// Update product – up to 5 images
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ errors: parsed.error.flatten().fieldErrors });
    }

    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Not found" });

    const filesField = (req as any).files as MulterFiles | undefined;
    const files = filesField?.images;
    const singleFile = filesField?.image?.[0];

    if (files && files.length > 0) {
      const limited = files.slice(0, 5);
      const uploads = await Promise.all(
        limited.map((file) =>
          uploadToR2({
            buffer: file.buffer,
            mime: file.mimetype,
            prefix: "products/",
            ext: "." + (file.originalname.split(".").pop() || "bin"),
          })
        )
      );

      const urls = uploads.map((u) => u.url);
      p.imageUrl = urls[0];
      (p as any).images = urls;
    } else if (singleFile) {
      const file = singleFile;
      const { url } = await uploadToR2({
        buffer: file.buffer,
        mime: file.mimetype,
        prefix: "products/",
        ext: "." + (file.originalname.split(".").pop() || "bin"),
      });
      p.imageUrl = url;
      (p as any).images = [url];
    }
    // if no files: keep existing images

    Object.assign(p, parsed.data);
    await p.save();
    res.json({ product: p });
  } catch (err: any) {
    console.error("updateProduct error:", err);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: err?.message });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Not found" });

    await p.deleteOne();
    res.json({ ok: true });
  } catch (err: any) {
    console.error("deleteProduct error:", err);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: err?.message });
  }
};

export const addSale = async (req: Request, res: Response) => {
  try {
    const raw = Number(req.query.qty);
    const qty =
      Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1; // always at least 1, never NaN

    const p = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { salesCount: qty } },
      { new: true }
    );
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json({ product: p });
  } catch (err: any) {
    console.error("addSale error:", err);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: err?.message });
  }
};
