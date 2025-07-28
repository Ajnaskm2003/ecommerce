const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true }, 
    discount: { type: Number, required: true }, 
    type: { type: String, enum: ["percentage", "flat"], required: true }, 
    minPurchase: { type: Number, default: 0 }, 
    maxDiscount: { type: Number, default: 0 }, 
    expiryDate: { type: Date, required: true }, 
    usageLimit: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 }
});

module.exports = mongoose.model("Coupon", couponSchema);
