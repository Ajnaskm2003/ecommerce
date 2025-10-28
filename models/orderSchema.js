const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const orderSchema = new Schema({
    orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        size: {  
            type: String 
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned'],
            default: 'Pending'
        },
        returnRequest: {
            type: Boolean,
            default: false
        },
        returnReason: {
            type: String,
            default: ''
        },
        returnStatus: {
            type: String,
            enum: ['Pending', 'Accepted', 'Rejected', ''],
            default: ''
        },
        returnRequestDate: {
            type: Date
        }
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['Cash on Delivery', 'Online Payment', 'Wallet Payment'] 
    },
    walletTransactionId: {
        type: String,
        unique: true,
        sparse: true
    },
    razorpayOrderId: {
        type: String,
        unique: true,
        sparse: true 
    },
    razorpayPaymentId: {
        type: String,
        unique: true,
        sparse: true
    },
    razorpaySignature: {
        type: String,
        sparse: true
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed', 'Refunded', 'COD'],
        default: 'Pending'
    },
    totalAmount: {
        type: Number,
        required: true
    },
    address: {
        fullname: String,
        street: String,
        city: String,
        state: String,
        zipCode: String,
        phone: String 
    },
    invoiceDate: {
        type: Date
    },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned'],
        default: 'Pending'
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    couponApplied: {
        type: Boolean,
        default: false
    }
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;