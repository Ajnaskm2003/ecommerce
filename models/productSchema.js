const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    brand: {
        type: String,
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    regularPrice: {
        type: Number,
        required: true
    },
    salePrice: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    productImage: {
        type: Array,
        required: true
    },
    status: {
        type: String,
        default: 'Available'
    },
    createdOn: {
        type: Date,
        default: Date.now
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    sizes: {
        6: { type: Number, default: 0 },
        7: { type: Number, default: 0 },
        8: { type: Number, default: 0 },
        9: { type: Number, default: 0 }
    }
});

module.exports = mongoose.model('Product', productSchema);
