"use strict";
const mongoose = require("mongoose");
const { Schema } = mongoose;

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    price: { type: Number, min: 0 },

    // Up to 5 images (stored separately)
    imageUrl1: String,
    imageUrl2: String,
    imageUrl3: String,
    imageUrl4: String,
    imageUrl5: String,

    salesCount: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Search index
productSchema.index({ name: "text", description: "text" });

module.exports.Product = mongoose.model("Product", productSchema);
