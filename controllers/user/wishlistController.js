const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");
const mongoose = require('mongoose');


const getWishlist = async (req, res) => {
    try {
        console.log("Fetching wishlist...");

        const userId = req.session.user.id;
        console.log("User ID:", userId);

        if (!userId) return res.status(401).json({ message: "User not authenticated" });

        // Find the user's wishlist and populate the product details inside `items`
        const wishlist = await Wishlist.findOne({ userId }).populate('items.productId');

        console.log("Wishlist Data:", wishlist);

        if (!wishlist || wishlist.items.length === 0) {
            return res.status(404).json({ message: "Wishlist is empty" });
        }

        // Render the wishlist page with the retrieved data
        res.render('wishlist', { wishlist });

    } catch (error) {
        console.error("Error fetching wishlist:", error);
        res.status(500).json({ message: "Server error", error });
    }
};




const addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user.id;

        console.log("User ID:", userId);

        if (!userId) return res.status(401).json({ message: "User not authenticated" });

        // Check if the product exists
        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ message: "Product not found" });

        // Find or create the wishlist for the user
        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({ userId, items: [] });
        }

        // Check if the product is already in the wishlist
        const existingItem = wishlist.items.find(item => item.productId.equals(productId));

        if (existingItem) {
            return res.status(400).json({ message: "Product is already in the wishlist" });
        }

        // Add the product to the wishlist
        wishlist.items.push({ productId, userId });
        await wishlist.save();

        console.log('Wishlist updated:', wishlist);
        res.json({ message: "Product added to wishlist", wishlist });

    } catch (error) {
        console.error("Error adding to wishlist:", error);
        res.status(500).json({ message: "Server error", error });
    }
};


module.exports = {
    addToWishlist,
    getWishlist,
};
