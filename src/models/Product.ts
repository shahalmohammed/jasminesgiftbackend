import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  name: string;
  description?: string;
  price?: number;
  imageUrl1?: string;
  imageUrl2?: string;
  imageUrl3?: string;
  imageUrl4?: string;
  imageUrl5?: string;
  salesCount: number;
  isActive: boolean;
  isPopular?: boolean;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    price: { type: Number, min: 0 },
    imageUrl1: { type: String },
    imageUrl2: { type: String },
    imageUrl3: { type: String },
    imageUrl4: { type: String },
    imageUrl5: { type: String },
    salesCount: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text" });

export const Product = mongoose.model<IProduct>("Product", productSchema);
