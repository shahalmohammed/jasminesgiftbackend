import { Request, Response } from "express";
import { z } from "zod";
import path from "path";
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
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

// POST /api/products  (multipart/form-data with "images")
export const createProduct = async (req: Request, res: Response) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  }

  const files = req.files as Express.Multer.File[] | undefined;

  const imageUrls: Record<string, string> = {};

  if (files && files.length > 0) {
    const uploads = await Promise.all(
      files.slice(0, 5).map((file) =>
        uploadToR2({
          buffer: file.buffer,
          mime: file.mimetype,
          prefix: "products/",
          ext: path.extname(file.originalname) || undefined,
        })
      )
    );

    uploads.forEach((u, index) => {
      imageUrls[`imageUrl${index + 1}`] = u.url;
    });
  }

  const prod = await Product.create({
    name: parsed.data.name,
    description: parsed.data.description,
    price: parsed.data.price,
    isPopular: parsed.data.isPopular ?? false,
    ...imageUrls,
  });

  return res.status(201).json({ product: prod });
};

// GET /api/products
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

  return res.json({ page, limit, total, items });
};

// GET /api/products/popular
export const getPopularProducts = async (_req: Request, res: Response) => {
  const items = await Product.find({ isActive: true, isPopular: true }).sort({
    createdAt: -1,
  });
  return res.json({ items });
};

// GET /api/products/:id
export const getProduct = async (req: Request, res: Response) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });
  res.json({ product: p });
};

// PATCH /api/products/:id  (optional images)
export const updateProduct = async (req: Request, res: Response) => {
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  }

  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });

  const files = req.files as Express.Multer.File[] | undefined;

  // If new images are uploaded, overwrite imageUrl1..imageUrlN with new URLs
  if (files && files.length > 0) {
    const uploads = await Promise.all(
      files.slice(0, 5).map((file) =>
        uploadToR2({
          buffer: file.buffer,
          mime: file.mimetype,
          prefix: "products/",
          ext: path.extname(file.originalname) || undefined,
        })
      )
    );

    uploads.forEach((u, index) => {
      (p as any)[`imageUrl${index + 1}`] = u.url;
    });
  }

  if (parsed.data.name !== undefined) p.name = parsed.data.name;
  if (parsed.data.description !== undefined) p.description = parsed.data.description;
  if (parsed.data.price !== undefined) p.price = parsed.data.price;
  if (parsed.data.isActive !== undefined) p.isActive = parsed.data.isActive;
  if (parsed.data.isPopular !== undefined) p.isPopular = parsed.data.isPopular;

  await p.save();
  res.json({ product: p });
};

// PATCH /api/products/:id/toggle-popular
export const togglePopular = async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Not found" });

  product.isPopular = !product.isPopular;
  await product.save();

  res.json({
    product,
    message: `Product marked as ${product.isPopular ? "popular" : "not popular"}`,
  });
};

// DELETE /api/products/:id
export const deleteProduct = async (req: Request, res: Response) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });

  await p.deleteOne();
  res.json({ ok: true });
};

// POST /api/products/:id/sell?qty=2
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
