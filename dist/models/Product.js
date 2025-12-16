"use strict";

const mongoose = require("mongoose");
const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 2000 },

    // optional (if logged in)
    user: { type: Schema.Types.ObjectId, ref: "User" },

    // optional (if guest)
    customerName: { type: String, trim: true, maxlength: 120 },
  },
  { timestamps: true }
);

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, min: 0 },

    imageUrls: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 15,
        message: "Maximum 15 images allowed.",
      },
    },

    // review summary
    averageRating: { type: Number, default: 0, min: 0, max: 5, index: true },
    ratingsCount: { type: Number, default: 0, min: 0, index: true },

    // embedded reviews
    reviews: { type: [reviewSchema], default: [] },

    salesCount: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text" });

const Product = mongoose.model("Product", productSchema);
module.exports = { Product };
