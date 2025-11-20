"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addProductImage = exports.addSale = exports.deleteProduct = exports.updateProduct = exports.getProduct = exports.togglePopular = exports.getPopularProducts = exports.listProducts = exports.createProduct = void 0;

const zod_1 = require("zod");
const Product_1 = require("../models/Product");
const r2_1 = require("../services/r2");

const PriceField = zod_1.z.coerce.number().min(0).optional();

const CreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    price: PriceField,
    isPopular: zod_1.z.coerce.boolean().optional(),
});

const UpdateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional(),
    price: PriceField,
    isActive: zod_1.z.boolean().optional(),
    isPopular: zod_1.z.coerce.boolean().optional(),
});

const QuerySchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    page: zod_1.z.coerce.number().min(1).default(1),
    limit: zod_1.z.coerce.number().min(1).max(100).default(10),
});

const MAX_IMAGES = 5;

const createProduct = async (req, res) => {
    // expects multipart/form-data with: fields (name, description?, price?) and file "image"
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

    // Optional primary image upload
    let imageUrls = [];

    if (req.file) {
        const file = req.file;
        const { url } = await (0, r2_1.uploadToR2)({
            buffer: file.buffer,
            mime: file.mimetype,
            prefix: "products/",
            ext: "." + (file.originalname.split(".").pop() || "bin")
        });
        imageUrls.push(url); // first/primary image
    }

    const prod = await Product_1.Product.create({
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price,
        imageUrls,
    });

    return res.status(201).json({ product: prod });
};
exports.createProduct = createProduct;

const listProducts = async (req, res) => {
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
        Product_1.Product.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        Product_1.Product.countDocuments(filter),
    ]);

    return res.json({
        page,
        limit,
        total,
        items,
    });
};
exports.listProducts = listProducts;

const getPopularProducts = async (_req, res) => {
    const items = await Product_1.Product.find({ isActive: true, isPopular: true })
        .sort({ createdAt: -1 });
    return res.json({ items });
};
exports.getPopularProducts = getPopularProducts;

const togglePopular = async (req, res) => {
    try {
        const product = await Product_1.Product.findById(req.params.id);
        if (!product)
            return res.status(404).json({ message: "Not found" });
        product.isPopular = !product.isPopular;
        await product.save();
        res.json({
            product,
            message: `Product marked as ${product.isPopular ? "popular" : "not popular"}`,
        });
    }
    catch (err) {
        console.error("Toggle popular error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
exports.togglePopular = togglePopular;

const getProduct = async (req, res) => {
    const p = await Product_1.Product.findById(req.params.id);
    if (!p)
        return res.status(404).json({ message: "Not found" });
    res.json({ product: p });
};
exports.getProduct = getProduct;

const updateProduct = async (req, res) => {
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

    const p = await Product_1.Product.findById(req.params.id);
    if (!p)
        return res.status(404).json({ message: "Not found" });

    // merge scalar fields
    Object.assign(p, parsed.data);

    // If new primary image uploaded, replace imageUrls[0]
    if (req.file) {
        const file = req.file;
        const { url } = await (0, r2_1.uploadToR2)({
            buffer: file.buffer,
            mime: file.mimetype,
            prefix: "products/",
            ext: "." + (file.originalname.split(".").pop() || "bin")
        });

        let imageUrls = Array.isArray(p.imageUrls) ? p.imageUrls.slice() : [];
        if (imageUrls.length === 0) {
            imageUrls.push(url);
        }
        else {
            imageUrls[0] = url;
        }
        if (imageUrls.length > MAX_IMAGES) {
            imageUrls = imageUrls.slice(0, MAX_IMAGES);
        }
        p.imageUrls = imageUrls;
    }

    await p.save();
    res.json({ product: p });
};
exports.updateProduct = updateProduct;

const deleteProduct = async (req, res) => {
    const p = await Product_1.Product.findById(req.params.id);
    if (!p)
        return res.status(404).json({ message: "Not found" });

    // If you later store R2 keys, delete them here with deleteFromR2(...)
    await p.deleteOne();
    res.json({ ok: true });
};
exports.deleteProduct = deleteProduct;

// Simple “record a sale” endpoint to increment salesCount (for top-5)
const addSale = async (req, res) => {
    const qty = Math.max(1, Number(req.query.qty) || 1);
    const p = await Product_1.Product.findByIdAndUpdate(req.params.id, { $inc: { salesCount: qty } }, { new: true });
    if (!p)
        return res.status(404).json({ message: "Not found" });
    res.json({ product: p });
};
exports.addSale = addSale;

// NEW: add one extra image to a product (up to MAX_IMAGES)
const addProductImage = async (req, res) => {
    const p = await Product_1.Product.findById(req.params.id);
    if (!p)
        return res.status(404).json({ message: "Not found" });

    const file = req.file;
    if (!file) {
        return res.status(400).json({ message: "Image file is required" });
    }

    let imageUrls = Array.isArray(p.imageUrls) ? p.imageUrls.slice() : [];

    if (imageUrls.length >= MAX_IMAGES) {
        return res.status(400).json({
            message: `You can upload a maximum of ${MAX_IMAGES} images per product`,
        });
    }

    const { url } = await (0, r2_1.uploadToR2)({
        buffer: file.buffer,
        mime: file.mimetype,
        prefix: "products/",
        ext: "." + (file.originalname.split(".").pop() || "bin")
    });

    imageUrls.push(url);
    if (imageUrls.length > MAX_IMAGES) {
        imageUrls = imageUrls.slice(0, MAX_IMAGES);
    }

    p.imageUrls = imageUrls;
    await p.save();

    res.status(201).json({
        product: p,
        addedImageUrl: url,
        imageCount: p.imageUrls.length,
    });
};
exports.addProductImage = addProductImage;
