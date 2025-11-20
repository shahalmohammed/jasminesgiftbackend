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

// Helper to upload one field if it exists
async function handleImageUpload(file?: Express.Multer.File) {
  if (!file) return undefined;
  const { url } = await uploadToR2({
    buffer: file.buffer,
    mime: file.mimetype,
    prefix: "products/",
    ext: "." + (file.originalname.split(".").pop() || "bin"),
  });
  return url;
}

export const createProduct = async (req: Request, res: Response) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const files = (req as any).files || {};

  const product = await Product.create({
    ...parsed.data,
    frontImage: await handleImageUpload(files.frontImage?.[0]),
    leftImage: await handleImageUpload(files.leftImage?.[0]),
    rightImage: await handleImageUpload(files.rightImage?.[0]),
    backImage: await handleImageUpload(files.backImage?.[0]),
    overallImage: await handleImageUpload(files.overallImage?.[0]),
  });

  return res.status(201).json({ product });
};

export const listProducts = async (req: Request, res: Response) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success)
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

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

export const getPopularProducts = async (_req: Request, res: Response) => {
  const items = await Product.find({ isActive: true, isPopular: true }).sort({
    createdAt: -1,
  });
  return res.json({ items });
};

export const togglePopular = async (req: Request, res: Response) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });

  p.isPopular = !p.isPopular;
  await p.save();

  res.json({
    product: p,
    message: `Product marked as ${p.isPopular ? "popular" : "not popular"}`,
  });
};

export const getProduct = async (req: Request, res: Response) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });
  res.json({ product: p });
};

export const updateProduct = async (req: Request, res: Response) => {
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });

  const files = (req as any).files || {};

  // upload updated images
  const payload: any = {
    ...parsed.data,
  };

  if (files.frontImage?.[0])
    payload.frontImage = await handleImageUpload(files.frontImage[0]);
  if (files.leftImage?.[0])
    payload.leftImage = await handleImageUpload(files.leftImage[0]);
  if (files.rightImage?.[0])
    payload.rightImage = await handleImageUpload(files.rightImage[0]);
  if (files.backImage?.[0])
    payload.backImage = await handleImageUpload(files.backImage[0]);
  if (files.overallImage?.[0])
    payload.overallImage = await handleImageUpload(files.overallImage[0]);

  Object.assign(p, payload);
  await p.save();

  res.json({ product: p });
};

export const deleteProduct = async (req: Request, res: Response) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });

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
