"use strict";

const { z } = require("zod");
const { Product } = require("../models/Product");
const { uploadToR2 } = require("../services/r2");

// Zod validation
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


// -------------------------------------------------------
// CREATE PRODUCT (supports up to 5 images)
// -------------------------------------------------------
exports.createProduct = async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  let imageUrls = [];

  if (req.files && req.files.length > 0) {
    for (const file of req.files.slice(0, 5)) {
      const { url } = await uploadToR2({
        buffer: file.buffer,
        mime: file.mimetype,
        prefix: "products/",
        ext: "." + (file.originalname.split(".").pop() || "bin"),
      });

      imageUrls.push(url);
    }
  }

  const prod = await Product.create({
    name: parsed.data.name,
    description: parsed.data.description,
    price: parsed.data.price,
    imageUrl1: imageUrls[0],
    imageUrl2: imageUrls[1],
    imageUrl3: imageUrls[2],
    imageUrl4: imageUrls[3],
    imageUrl5: imageUrls[4],
  });

  return res.status(201).json({ product: prod });
};


// -------------------------------------------------------
// LIST PRODUCTS WITH SEARCH + PAGINATION
// -------------------------------------------------------
exports.listProducts = async (req, res) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success)
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const { search, page, limit } = parsed.data;

  const filter = {};

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


// -------------------------------------------------------
// GET POPULAR PRODUCTS
// -------------------------------------------------------
exports.getPopularProducts = async (_req, res) => {
  const items = await Product.find({ isActive: true, isPopular: true })
    .sort({ createdAt: -1 });

  return res.json({ items });
};


// -------------------------------------------------------
// TOGGLE POPULAR
// -------------------------------------------------------
exports.togglePopular = async (req, res) => {
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


// -------------------------------------------------------
// GET SINGLE PRODUCT
// -------------------------------------------------------
exports.getProduct = async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });

  res.json({ product: p });
};


// -------------------------------------------------------
// UPDATE PRODUCT (replaces only uploaded images)
// -------------------------------------------------------
exports.updateProduct = async (req, res) => {
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });

  if (req.files && req.files.length > 0) {
    let index = 1;

    for (const file of req.files.slice(0, 5)) {
      const { url } = await uploadToR2({
        buffer: file.buffer,
        mime: file.mimetype,
        prefix: "products/",
        ext: "." + (file.originalname.split(".").pop() || "bin"),
      });

      p[`imageUrl${index}`] = url;
      index++;
    }
  }

  Object.assign(p, parsed.data);
  await p.save();

  res.json({ product: p });
};


// -------------------------------------------------------
// DELETE PRODUCT
// -------------------------------------------------------
exports.deleteProduct = async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });

  await p.deleteOne();
  res.json({ ok: true });
};


// -------------------------------------------------------
// ADD SALE (increments sale count)
// -------------------------------------------------------
exports.addSale = async (req, res) => {
  const qty = Math.max(1, Number(req.query.qty) || 1);

  const p = await Product.findByIdAndUpdate(
    req.params.id,
    { $inc: { salesCount: qty } },
    { new: true }
  );

  if (!p) return res.status(404).json({ message: "Not found" });

  res.json({ product: p });
};
