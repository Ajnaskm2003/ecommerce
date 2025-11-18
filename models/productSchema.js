const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productName: { type: String, required: true },
    description: { type: String, required: true },
    brand: { type: String },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    regularPrice: { type: Number, required: true },
    offerPercentage: { type: Number, default: 0, min: 0, max: 100 }, 
    salePrice: { type: Number, required: true }, 
    quantity: { type: Number, required: true },
    productImage: { type: [String], required: true },
    status: { type: String, default: 'Available' },
    createdOn: { type: Date, default: Date.now },
    isBlocked: { type: Boolean, default: false },
    sizes: {
        6: { type: Number, default: 0 },
        7: { type: Number, default: 0 },
        8: { type: Number, default: 0 },
        9: { type: Number, default: 0 }
    }
});

productSchema.pre(/^find/, function(next) {
    this.populate('category');
    next();
});

productSchema.virtual('finalPrice').get(function () {
    if (!this.category) return this.salePrice;

    const productOffer = this.offerPercentage || 0;
    const categoryOffer = this.category.categoryOffer || 0;
    const bestOffer = Math.max(productOffer, categoryOffer);

    const discount = this.regularPrice * (bestOffer / 100);
    return Math.round((this.regularPrice - discount) * 100) / 100;
});

productSchema.pre('save', async function (next) {
    try {
        let categoryOffer = 0;
        if (this.isModified('category') || !this.populated('category')) {
            const Category = mongoose.model('Category');
            const cat = await Category.findById(this.category);
            categoryOffer = cat?.categoryOffer || 0;
        } else {
            categoryOffer = this.category.categoryOffer || 0;
        }

        const productOffer = this.offerPercentage || 0;
        const bestOffer = Math.max(productOffer, categoryOffer);

        const discount = this.regularPrice * (bestOffer / 100);
        this.salePrice = Math.round((this.regularPrice - discount) * 100) / 100;

        next();
    } catch (err) {
        next(err);
    }
});

module.exports = mongoose.model('Product', productSchema);