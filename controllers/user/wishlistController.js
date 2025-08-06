const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");
const mongoose = require('mongoose');


const getWishlist = async (req, res) => {
    try {
        console.log("Fetching wishlist...");

        
        if (!req.session.user || !req.session.user.id) {
            console.log("User not logged in.");
            return res.redirect('/login'); 
        }

        const userId = req.session.user.id;
        console.log("User ID:", userId);

        
        const wishlist = await Wishlist.findOne({ userId }).populate('items.productId');

        console.log("Wishlist Data:", wishlist);

        
        if (!wishlist || wishlist.items.length === 0) {
            return res.render('wishlist', { wishlist: { items: [] } });
        }

        
        res.render('wishlist', { wishlist });

    } catch (error) {
        console.error("Error fetching wishlist:", error);
        res.status(500).render('error', { message: "Server error while fetching wishlist" });
    }
};




const addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user?.id;

        if (!userId) {
            return res.json({ 
                success: false, 
                message: "Please login to add items to wishlist" 
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.json({ 
                success: false, 
                message: "Product not found" 
            });
        }

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({ 
                userId, 
                items: [{
                    productId,
                    userId // Add userId here for the item
                }] 
            });
        } else {
            const existingItem = wishlist.items.find(item => 
                item.productId.toString() === productId.toString()
            );

            if (existingItem) {
                return res.json({ 
                    success: false, 
                    message: "Product is already in your wishlist" 
                });
            }

            // Add userId when pushing new items
            wishlist.items.push({ 
                productId,
                userId
            });
        }

        await wishlist.save();

        return res.json({
            success: true,
            message: "Product added to wishlist successfully"
        });

    } catch (error) {
        console.error("Error adding to wishlist:", error);
        return res.json({ 
            success: false, 
            message: "Failed to add product to wishlist" 
        });
    }
};



const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const { productId } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to manage wishlist." });
        }

        
        const wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            return res.status(404).json({ success: false, message: "Wishlist not found." });
        }

        
        wishlist.items = wishlist.items.filter(item => item.productId.toString() !== productId);
        await wishlist.save();

        return res.json({ success: true, message: "Product removed from wishlist." });
    } catch (error) {
        console.error("Error removing from wishlist:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};


module.exports = {
    addToWishlist,
    getWishlist,
    removeFromWishlist
};
