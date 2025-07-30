// models/Wallet.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const walletSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    transactions: [{
        amount: {
            type: Number,
            required: true
        },
        type: {
            type: String,
            enum: ['Credit', 'Debit'],
            required: true
        },
        description: {
            type: String,
            required: true
        },
        orderId: {
            type: Schema.Types.ObjectId,
            ref: 'Order'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
});

module.exports = mongoose.model('Wallet', walletSchema);