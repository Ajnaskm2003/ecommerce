const mongoose = require("mongoose");
const { Schema } = mongoose;

const walletSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["Credit", "Debit"], 
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    description: {
      type: String, 
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order", 
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WalletTransaction", walletSchema);
