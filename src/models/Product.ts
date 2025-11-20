import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  name: string;
  description?: string;
  price?: number;

  // 5 individual image fields
  frontImage?: string;
  leftImage?: string;
  rightImage?: string;
  backImage?: string;
  overallImage?: string;

  salesCount: number;
  isActive: boolean;
  isPopular?: boolean;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    price: { type: Number, min: 0 },

    frontImage: { type: String },
    leftImage: { type: String },
    rightImage: { type: String },
    backImage: { type: String },
    overallImage: { type: String },

    salesCount: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Search index
productSchema.index({ name: "text", description: "text" });

export const Product = mongoose.model<IProduct>("Product", productSchema);
