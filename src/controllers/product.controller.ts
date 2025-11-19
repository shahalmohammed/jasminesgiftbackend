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

// Create product – up to 5 images (from any file field)
export const createProduct = async (req: Request, res: Response) => {
  try {
    console.log('createProduct called');
    console.log('Body:', req.body);
    console.log('Files:', (req as any).files);

    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('Validation error:', parsed.error.flatten().fieldErrors);
      return res
        .status(400)
        .json({ errors: parsed.error.flatten().fieldErrors });
    }

    let imageUrl: string | undefined;
    let images: string[] = [];

    const files = (req as any).files as Express.Multer.File[] | undefined;

    if (files && files.length > 0) {
      console.log(`Processing ${files.length} file(s)`);
      
      // Filter only image files
      const imageFiles = files.filter(f => {
        const isImage = f.mimetype.startsWith('image/');
        if (!isImage) {
          console.warn(`Skipping non-image file: ${f.originalname} (${f.mimetype})`);
        }
        return isImage;
      });

      if (imageFiles.length === 0) {
        console.warn('No valid image files found');
      } else {
        // Limit to 5 images
        const limited = imageFiles.slice(0, 5);
        console.log(`Uploading ${limited.length} image(s) to R2`);

        try {
          const uploads = await Promise.all(
            limited.map((file, index) => {
              console.log(`  Uploading file ${index + 1}: ${file.originalname}`);
              return uploadToR2({
                buffer: file.buffer,
                mime: file.mimetype,
                prefix: "products/",
                ext: "." + (file.originalname.split(".").pop() || "bin"),
              });
            })
          );

          images = uploads.map((u) => u.url);
          imageUrl = images[0];
          console.log('Upload successful:', images);
        } catch (uploadErr: any) {
          console.error('R2 upload error:', uploadErr);
          return res.status(500).json({ 
            message: "Failed to upload images", 
            error: uploadErr?.message 
          });
        }
      }
    } else {
      console.log('No files received');
    }

    const prod = await Product.create({
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price,
      imageUrl,
      images,
      isPopular: parsed.data.isPopular ?? false,
    });

    console.log('Product created:', prod._id);
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

// Update product – up to 5 images (from any file field)
export const updateProduct = async (req: Request, res: Response) => {
  try {
    console.log('updateProduct called for ID:', req.params.id);
    console.log('Body:', req.body);
    console.log('Files:', (req as any).files);

    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('Validation error:', parsed.error.flatten().fieldErrors);
      return res
        .status(400)
        .json({ errors: parsed.error.flatten().fieldErrors });
    }

    const p = await Product.findById(req.params.id);
    if (!p) {
      console.log('Product not found:', req.params.id);
      return res.status(404).json({ message: "Not found" });
    }

    const files = (req as any).files as Express.Multer.File[] | undefined;

    if (files && files.length > 0) {
      console.log(`Processing ${files.length} file(s) for update`);
      
      // Filter only image files
      const imageFiles = files.filter(f => {
        const isImage = f.mimetype.startsWith('image/');
        if (!isImage) {
          console.warn(`Skipping non-image file: ${f.originalname} (${f.mimetype})`);
        }
        return isImage;
      });

      if (imageFiles.length > 0) {
        // Limit to 5 images
        const limited = imageFiles.slice(0, 5);
        console.log(`Uploading ${limited.length} image(s) to R2`);

        try {
          const uploads = await Promise.all(
            limited.map((file, index) => {
              console.log(`  Uploading file ${index + 1}: ${file.originalname}`);
              return uploadToR2({
                buffer: file.buffer,
                mime: file.mimetype,
                prefix: "products/",
                ext: "." + (file.originalname.split(".").pop() || "bin"),
              });
            })
          );

          const urls = uploads.map((u) => u.url);
          p.imageUrl = urls[0];
          (p as any).images = urls;
          console.log('Upload successful:', urls);
        } catch (uploadErr: any) {
          console.error('R2 upload error:', uploadErr);
          return res.status(500).json({ 
            message: "Failed to upload images", 
            error: uploadErr?.message 
          });
        }
      } else {
        console.log('No valid image files found, keeping existing images');
      }
    } else {
      console.log('No files received, keeping existing images');
    }

    // Update other fields
    Object.assign(p, parsed.data);
    await p.save();
    
    console.log('Product updated:', p._id);
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
    const qty = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;

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