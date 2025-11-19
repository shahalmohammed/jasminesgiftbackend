// src/models/Product.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;    // primary image (first of images)
  images: string[];     // up to 5 image URLs
  salesCount: number;
  isActive: boolean;
  isPopular?: boolean;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    price: { type: Number, min: 0 },

    imageUrl: { type: String },

    images: {
      type: [String],
      default: [],
      validate: {
        validator: (arr: string[]) => arr.length <= 5,
        message: "A product can have at most 5 images.",
      },
    },

    salesCount: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Search index (partial)
productSchema.index({ name: "text", description: "text" });

export const Product = mongoose.model<IProduct>("Product", productSchema);
