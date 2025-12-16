"use strict";

const { z } = require("zod");
const { Product } = require("../models/Product");
const { uploadToR2 } = require("../services/r2");

// -----------------------
// Zod Schemas
// -----------------------
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

// Reviews
const AddReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(2000).optional(),
  customerName: z.string().trim().min(1).max(120).optional(),
});

const ReviewsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});

// -----------------------
// Handlers
// -----------------------

// POST /api/products
// expects multipart/form-data with:
//  - text fields: name, description?, price?
//  - files under field name "images"
async function createProduct(req, res) {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  }

  try {
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
      isPopular: parsed.data.isPopular ?? false,
    });

    return res.status(201).json({ product: prod });
  } catch (err) {
    console.error("createProduct error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET /api/products
async function listProducts(req, res) {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  }

  try {
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
  } catch (err) {
    console.error("listProducts error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET /api/products/popular
async function getPopularProducts(_req, res) {
  try {
    const items = await Product.find({ isActive: true, isPopular: true }).sort({
      createdAt: -1,
    });
    return res.json({ items });
  } catch (err) {
    console.error("getPopularProducts error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// PATCH /api/products/:id/toggle-popular
async function togglePopular(req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Not found" });

    product.isPopular = !product.isPopular;
    await product.save();

    return res.json({
      product,
      message: `Product marked as ${product.isPopular ? "popular" : "not popular"}`,
    });
  } catch (err) {
    console.error("togglePopular error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET /api/products/:id
async function getProduct(req, res) {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Not found" });
    return res.json({ product: p });
  } catch (err) {
    console.error("getProduct error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// PATCH /api/products/:id
// expects multipart/form-data with optional files under "images"
async function updateProduct(req, res) {
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  }

  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Not found" });

    // Assign allowed fields first
    Object.assign(p, parsed.data);

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
    }

    await p.save();
    return res.json({ product: p });
  } catch (err) {
    console.error("updateProduct error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// DELETE /api/products/:id
async function deleteProduct(req, res) {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Not found" });

    await p.deleteOne();
    return res.json({ ok: true });
  } catch (err) {
    console.error("deleteProduct error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// POST /api/products/:id/sell?qty=1
async function addSale(req, res) {
  try {
    const qty = Math.max(1, Number(req.query.qty) || 1);

    const p = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { salesCount: qty } },
      { new: true }
    );

    if (!p) return res.status(404).json({ message: "Not found" });

    return res.json({ product: p });
  } catch (err) {
    console.error("addSale error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// -----------------------
// Reviews
// -----------------------

// POST /api/products/:id/reviews
async function addReview(req, res) {
  const parsed = AddReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  }

  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Not found" });

    // IMPORTANT FIX: for old docs or old schema builds
    if (!Array.isArray(p.reviews)) p.reviews = [];

    const userId = req.user?._id; // if you use requireAuth, else undefined

    // Optional: enforce one review per user
    if (userId && p.reviews.some((r) => String(r.user) === String(userId))) {
      return res.status(400).json({ message: "You already reviewed this product" });
    }

    p.reviews.push({
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      customerName: parsed.data.customerName,
      user: userId,
    });

    const count = p.reviews.length;
    const sum = p.reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);

    p.ratingsCount = count;
    p.averageRating = count ? Math.round((sum / count) * 10) / 10 : 0;

    await p.save();

    return res.status(201).json({
      productId: p._id,
      averageRating: p.averageRating,
      ratingsCount: p.ratingsCount,
      review: p.reviews[p.reviews.length - 1],
    });
  } catch (err) {
    console.error("addReview error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET /api/products/:id/reviews?page=1&limit=10
async function listReviews(req, res) {
  const parsed = ReviewsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  }

  try {
    const { page, limit } = parsed.data;

    const p = await Product.findById(req.params.id).select(
      "reviews averageRating ratingsCount"
    );
    if (!p) return res.status(404).json({ message: "Not found" });

    const all = Array.isArray(p.reviews) ? p.reviews : [];
    const total = all.length;

    const sorted = [...all].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const start = (page - 1) * limit;
    const items = sorted.slice(start, start + limit);

    return res.json({
      page,
      limit,
      total,
      averageRating: p.averageRating || 0,
      ratingsCount: p.ratingsCount || 0,
      items,
    });
  } catch (err) {
    console.error("listReviews error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// -----------------------
// Exports
// -----------------------
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
