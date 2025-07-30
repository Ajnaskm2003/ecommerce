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
        required: true,
        validate: {
            validator: async function(value) {
                const Category = mongoose.model('Category');
                const category = await Category.findById(value);
                return category !== null;
            },
            message: 'Category does not exist'
        }
    },
    regularPrice: {
        type: Number,
        required: true
    },
    offerPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
        validate: {
            validator: function(value) {
                return value >= 0 && value <= 100;
            },
            message: 'Offer percentage must be between 0 and 100'
        }
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

// Add pre-find middleware to always populate category
productSchema.pre('find', function(next) {
    this.populate('category');
    next();
});

// Add error handling for null category references
productSchema.post('save', async function(doc, next) {
    try {
        if (doc.category) {
            const Category = mongoose.model('Category');
            const category = await Category.findById(doc.category);
            if (!category) {
                doc.category = null;
                await doc.save();
            }
        }
        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('Product', productSchema);
