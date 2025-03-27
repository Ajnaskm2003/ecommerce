const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the Wishlist Item Schema
const wishlistItemSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product', // Reference to the Product model
        required: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model
        required: true,
    },
    addedAt: {
        type: Date,
        default: Date.now, // Automatically sets the current date and time when the item is added
    }
});

// Define the Wishlist Schema
const wishlistSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model
        required: true,
    },
    items: [wishlistItemSchema], // Array of wishlist items
    createdAt: {
        type: Date,
        default: Date.now, // Automatically sets the current date and time when the wishlist is created
    }
});

// Create the Wishlist model
const Wishlist = mongoose.model('Wishlist', wishlistSchema);

module.exports = Wishlist;
