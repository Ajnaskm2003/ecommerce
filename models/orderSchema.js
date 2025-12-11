const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema = new Schema({
    orderId: {
        type: String,
        required: true,
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
        size: { type: String },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        status: {
            type: String,
            enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Returned'],
            default: 'Pending'
        },
        returnRequest: { type: Boolean, default: false },
        returnReason: { type: String, default: null },
        returnRequestDate: { type: Date, default: null },
        returnStatus: {
            type: String,
            enum: [null, 'Pending', 'Accepted', 'Rejected'],
            default: null
        }
    }],
    totalPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    
    paymentMethod: {
        type: String,
        required: true,
        enum: ['Cash on Delivery', 'Online Payment', 'Wallet Payment']
    },
    razorpayOrderId: { type: String, unique: true, sparse: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    razorpaySignature: { type: String, sparse: true },

    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed', 'Refunded', 'COD'],
        default: 'Pending'
    },
    address: {
        fullname: String,
        street: String,
        city: String,
        state: String,
        zipCode: String,
        phone: String
    },
    invoiceDate: { type: Date },
    
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Returned'],
        default: 'Pending'
    },
    
    couponApplied: { type: Boolean, default: false },
    coupon: { type: String, default: null },

    isTemp: { type: Boolean, default: true, index: true },

    createdOn: { type: Date, default: Date.now },

    
    statusHistory: [{
        status: {
            type: String,
            enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Returned'],
            required: true
        },
        date: {
            type: Date,
            default: Date.now,
            required: true
        },
        changedBy: {
            type: String,
            default: 'system'
        },
        previousStatus: { 
            type: String,
            default: null
        }
    }]
}, {
    timestamps: true
});


orderSchema.pre('save', function(next) {
    if (this.isNew) {
        this.statusHistory = [{
            status: this.status,
            date: this.createdOn || new Date(),
            changedBy: 'system',
            previousStatus: null
        }];
    }
    next();
});


orderSchema.virtual('currentStatusDate').get(function() {
    if (!this.statusHistory || this.statusHistory.length === 0) return this.createdOn;
    
    
    const matchingHistory = this.statusHistory.filter(h => h.status === this.status);
    
    if (matchingHistory.length === 0) return this.createdOn;
    
    
    return matchingHistory[matchingHistory.length - 1].date;
});

orderSchema.index({ "orderItems.returnRequest": 1 });
orderSchema.index({ "orderItems.returnRequestDate": -1 });

module.exports = mongoose.model("Order", orderSchema);