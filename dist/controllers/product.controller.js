"use strict";

const { z } = require("zod");
const { Product } = require("../models/Product");
const { uploadToR2 } = require("../services/r2");

// Common Zod fields
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

// POST /api/products
// expects multipart/form-data with:
//  - text fields: name, description?, price?
//  - up to 5 files under field name "images"
async function createProduct(req, res) {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ errors: parsed.error.flatten().fieldErrors });
  }

  // Handle up to 5 uploaded images (Multer: upload.array("images", 5))
  const imageUrls = [];

  if (Array.isArray(req.files) && req.files.length > 0) {
    for (const file of req.files) {
      const { buffer, mimetype, originalname } = file;
      const ext = "." + (originalname.split(".").pop() || "bin");

      const { url } = await uploadToR2({
        buffer,
        mime: mimetype,
        prefix: "products/",
        ext,
      });

      imageUrls.push(url);
    }
  }

  const prod = await Product.create({
    name: parsed.data.name,
    description: parsed.data.description,
    price: parsed.data.price,
    imageUrls,
    // isPopular is typically controlled via togglePopular, but you can include it:
    isPopular: parsed.data.isPopular ?? false,
  });

  return res.status(201).json({ product: prod });
}

// GET /api/products
async function listProducts(req, res) {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ errors: parsed.error.flatten().fieldErrors });
  }

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

  return res.json({
    page,
    limit,
    total,
    items,
  });
}

// GET /api/products/popular
async function getPopularProducts(_req, res) {
  const items = await Product.find({ isActive: true, isPopular: true }).sort({
    createdAt: -1,
  });
  return res.json({ items });
}

// PATCH /api/products/:id/toggle-popular
async function togglePopular(req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Not found" });

    product.isPopular = !product.isPopular;
    await product.save();

    res.json({
      product,
      message: `Product marked as ${product.isPopular ? "popular" : "not popular"
        }`,
    });
  } catch (err) {
    console.error("Toggle popular error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// GET /api/products/:id
async function getProduct(req, res) {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });
  res.json({ product: p });
}

// PATCH /api/products/:id
// expects multipart/form-data with optional up to 5 new images under "images"
async function updateProduct(req, res) {
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ errors: parsed.error.flatten().fieldErrors });
  }

  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });

  // If new images are uploaded, replace existing imageUrls array
  if (Array.isArray(req.files) && req.files.length > 0) {
    const newImageUrls = [];

    for (const file of req.files) {
      const { buffer, mimetype, originalname } = file;
      const ext = "." + (originalname.split(".").pop() || "bin");

      const { url } = await uploadToR2({
        buffer,
        mime: mimetype,
        prefix: "products/",
        ext,
      });

      newImageUrls.push(url);
    }

    p.imageUrls = newImageUrls;
    // If you were saving keys, you could delete old ones here.
  }

  Object.assign(p, parsed.data);

  await p.save();
  res.json({ product: p });
}

// DELETE /api/products/:id
async function deleteProduct(req, res) {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });

  // If you were storing R2 keys alongside URLs, delete them here.
  await p.deleteOne();

  res.json({ ok: true });
}

// POST /api/products/:id/sell?qty=1
async function addSale(req, res) {
  const qty = Math.max(1, Number(req.query.qty) || 1);

  const p = await Product.findByIdAndUpdate(
    req.params.id,
    { $inc: { salesCount: qty } },
    { new: true }
  );

  if (!p) return res.status(404).json({ message: "Not found" });

  res.json({ product: p });
}

const AddReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(2000).optional(),
  customerName: z.string().trim().min(1).max(120).optional(),
});

async function addReview(req, res) {
  const parsed = AddReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  }

  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });

  // Optional: only allow reviews on active products
  if (!p.isActive) return res.status(400).json({ message: "Product inactive" });

  // If you requireAuth and have req.user:
  const userId = req.user?._id;

  // Optional: one review per user
  if (userId && p.reviews.some((r) => String(r.user) === String(userId))) {
    return res.status(400).json({ message: "You already reviewed this product" });
  }

  p.reviews.push({
    rating: parsed.data.rating,
    comment: parsed.data.comment,
    customerName: parsed.data.customerName,
    user: userId,
  });

  // Recompute summary (simple + safe)
  const count = p.reviews.length;
  const sum = p.reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
  p.ratingsCount = count;
  p.averageRating = count ? Math.round((sum / count) * 10) / 10 : 0; // 1 decimal

  await p.save();
  return res.status(201).json({
    productId: p._id,
    averageRating: p.averageRating,
    ratingsCount: p.ratingsCount,
    review: p.reviews[p.reviews.length - 1],
  });
}

// GET /api/products/:id/reviews
const ReviewQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});

async function listReviews(req, res) {
  const parsed = ReviewQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  }

  const { page, limit } = parsed.data;

  const p = await Product.findById(req.params.id).select("reviews averageRating ratingsCount");
  if (!p) return res.status(404).json({ message: "Not found" });

  const total = p.reviews.length;

  // newest first
  const sorted = [...p.reviews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const items = sorted.slice((page - 1) * limit, (page - 1) * limit + limit);

  return res.json({
    page,
    limit,
    total,
    averageRating: p.averageRating,
    ratingsCount: p.ratingsCount,
    items,
  });
}

module.exports = {
  createProduct,
  listProducts,
  getPopularProducts,
  togglePopular,
  getProduct,
  updateProduct,
  deleteProduct,
  addSale,
  addReview,
  listReviews,
};
