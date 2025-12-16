"use strict";

const mongoose = require("mongoose");
const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 2000 },

    // If you have users:
    user: { type: Schema.Types.ObjectId, ref: "User" },

    // If you want guest reviews too:
    customerName: { type: String, trim: true, maxlength: 120 },
  },
  { timestamps: true }
);
const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, min: 0 },

    // Up to 15 image URLs
    imageUrls: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 15,
        message: "Maximum 15 images allowed.",
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

const Product = mongoose.model("Product", productSchema);

module.exports = { Product };
