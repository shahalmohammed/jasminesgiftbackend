import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  salesCount: number;         // used for “top 5”
  isActive: boolean;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    price: { type: Number, min: 0 },
    imageUrl: { type: String },
    salesCount: { type: Number, default: 0, index: true },
    isPopular: { type: Boolean, default: false, index: true }, // 👈 NEW FIELD
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);


// Search index (partial)
productSchema.index({ name: "text", description: "text" });

export const Product = mongoose.model<IProduct>("Product", productSchema);
