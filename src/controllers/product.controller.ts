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
  isActive: z.boolean().optional(),
  isPopular: z.coerce.boolean().optional(),
});

const QuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

const MAX_IMAGES = 5;

export const createProduct = async (req: Request, res: Response) => {
  // expects multipart/form-data with: fields (name, description?, price?) and file "image" (optional)
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  }

  let imageUrls: string[] = [];

  const file = (req as any).file as Express.Multer.File | undefined;
  if (file) {
    const { url } = await uploadToR2({
      buffer: file.buffer,
      mime: file.mimetype,
      prefix: "products/",
      ext: "." + (file.originalname.split(".").pop() || "bin"),
    });
    imageUrls.push(url); // primary image (slot 1)
  }

  const prod = await Product.create({
    name: parsed.data.name,
    description: parsed.data.description,
    price: parsed.data.price,
    imageUrls,
  });

  return res.status(201).json({ product: prod });
};

export const listProducts = async (req: Request, res: Response) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
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
};

export const getPopularProducts = async (_req: Request, res: Response) => {
  const items = await Product.find({ isActive: true, isPopular: true }).sort({
    createdAt: -1,
  });
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
      message: `Product marked as ${
        product.isPopular ? "popular" : "not popular"
      }`,
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
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  }

  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });

  // merge scalar fields
  Object.assign(p, parsed.data);

  // optional new primary image (replace slot 0)
  const file = (req as any).file as Express.Multer.File | undefined;
  if (file) {
    const { url } = await uploadToR2({
      buffer: file.buffer,
      mime: file.mimetype,
      prefix: "products/",
      ext: "." + (file.originalname.split(".").pop() || "bin"),
    });

    let imageUrls = Array.isArray(p.imageUrls) ? [...p.imageUrls] : [];
    if (imageUrls.length === 0) {
      imageUrls.push(url);
    } else {
      imageUrls[0] = url; // replace first image
    }
    p.imageUrls = imageUrls.slice(0, MAX_IMAGES);
  }

  await p.save();
  res.json({ product: p });
};

export const deleteProduct = async (req: Request, res: Response) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });

  // If you later store R2 keys, delete them here via deleteFromR2(...)
  await p.deleteOne();
  res.json({ ok: true });
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

// NEW: add one image (image2, image3, etc.) via separate endpoint
export const addProductImage = async (req: Request, res: Response) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });

  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) {
    return res.status(400).json({ message: "Image file is required" });
  }

  let imageUrls = Array.isArray(p.imageUrls) ? [...p.imageUrls] : [];

  if (imageUrls.length >= MAX_IMAGES) {
    return res.status(400).json({
      message: `You can upload a maximum of ${MAX_IMAGES} images per product`,
    });
  }

  const { url } = await uploadToR2({
    buffer: file.buffer,
    mime: file.mimetype,
    prefix: "products/",
    ext: "." + (file.originalname.split(".").pop() || "bin"),
  });

  imageUrls.push(url);
  p.imageUrls = imageUrls.slice(0, MAX_IMAGES);
  await p.save();

  res.status(201).json({
    product: p,
    addedImageUrl: url,
    imageCount: p.imageUrls.length,
  });
};
