const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");


const getCart = async (req, res) => {
    try {
        const userId = req.session.user?.id; 

        if (!userId) {
            return res.redirect('/login');
        }

        
        const cart = await Cart.findOne({ userId }).populate('items.productId');

        res.render('cart', { cart: cart || { items: [] } }); 

    } catch (error) {
        console.error("Error fetching cart:", error);
        res.status(500).send("Server error");
    }
};

const addToCart = async (req, res) => {
    try {
        const { productId, size, quantity = 1 } = req.body;
        const userId = req.session.user?.id;

        if (!userId) {
            return res.json({ 
                success: false, 
                message: "Please login to add items to cart" 
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.json({ 
                success: false, 
                message: "Product not found" 
            });
        }

        if (product.blocked) {
            return res.json({ 
                success: false, 
                message: "This product is currently unavailable" 
            });
        }

        // Check if size exists and has stock
        const stockForSize = product.sizes[size];
        if (stockForSize === undefined) {
            return res.json({ 
                success: false, 
                message: "Selected size not available" 
            });
        }

        if (stockForSize <= 0) {
            return res.json({ 
                success: false, 
                message: "Selected size is out of stock" 
            });
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) cart = new Cart({ userId, items: [] });

        const existingItem = cart.items.find(item => 
            item.productId.equals(productId) && 
            item.size === size
        );

        if (existingItem) {
            if (existingItem.quantity + quantity > stockForSize) {
                return res.json({ 
                    success: false, 
                    message: `Only ${stockForSize} items available in stock` 
                });
            }
            existingItem.quantity += quantity;
        } else {
            cart.items.push({
                productId,
                size,
                quantity,
                price: product.salePrice
            });
        }

        await cart.save();

        // Remove from wishlist if exists
        await Wishlist.updateOne(
            { userId }, 
            { $pull: { items: { productId } } }
        );

        return res.json({
            success: true,
            message: "Product added to cart successfully",
            cart: cart
        });

    } catch (error) {
        console.error("Add to cart error:", error);
        return res.json({ 
            success: false, 
            message: "Failed to add product to cart" 
        });
    }
};








const incrementCartItem = async (req, res) => {
        try {
            console.log('-----------------------------------')
            const { cartItemId } = req.body; 
            const userId = req.session.user.id; 

            console.log(userId)
    
            if (!userId) {
                return res.status(401).json({ message: "User not authenticated" });
            }
    
            let cart = await Cart.findOne({ userId }).populate('items.productId');
            if (!cart) return res.status(404).json({ message: "Cart not found" });
    
            
            const item = cart.items.find(i => i._id.equals(cartItemId));
            if (!item) return res.status(404).json({ message: "Item not found in cart" });
    
            const product = item.productId;
            if (!product) return res.status(404).json({ message: "Product not found" });
    
            
            if (item.quantity + 1 > product.sizes[item.size]) {
                return res.status(400).json({ message: "Stock limit exceeded" });
            }
    
            
            item.quantity += 1;
            cart.totalPrice = cart.items.reduce((acc, curr) => acc + curr.quantity * curr.price, 0);
    
            await cart.save();
            res.json({ message: "Quantity updated", cart });
    
        } catch (error) {
            console.error("Error incrementing cart item:", error);
            res.status(500).json({ message: "Server error" });
        }
    
    
}

const decrementCartItem = async (req, res) => {
    try {
        console.log('-----------------------------------')
        const { cartItemId } = req.body; 
        const userId = req.session.user.id; 

        console.log(userId)

        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        let cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart) return res.status(404).json({ message: "Cart not found" });

        const item = cart.items.find(i => i._id.equals(cartItemId));
        if (!item) return res.status(404).json({ message: "Item not found in cart" });

        const product = item.productId;
        if (!product) return res.status(404).json({ message: "Product not found" });

        
        if (item.quantity <= 1) {
            return res.status(400).json({ message: "Quantity cannot be less than 1" });
        }

        
        item.quantity -= 1;
        cart.totalPrice = cart.items.reduce((acc, curr) => acc + curr.quantity * curr.price, 0);

        await cart.save();
        res.json({ message: "Quantity decremented", cart });

    } catch (error) {
        console.error("Error decrementing cart item:", error);
        res.status(500).json({ message: "Server error" });
    }
}







const decrementOrRemoveCartItem = async (req, res) => {
    try {
        console.log('-----------------------------------')
        const { cartItemId } = req.body; 
        const userId = req.session.user.id; 

        console.log(userId)

        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        let cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart) return res.status(404).json({ message: "Cart not found" });

        
        const itemIndex = cart.items.findIndex(i => i._id.equals(cartItemId));
        if (itemIndex === -1) return res.status(404).json({ message: "Item not found in cart" });

        const item = cart.items[itemIndex];
        const product = item.productId;
        if (!product) return res.status(404).json({ message: "Product not found" });

        
        if (item.quantity > 1) {
            item.quantity -= 1;
        } else {
            
            cart.items.splice(itemIndex, 1);
        }

        
        cart.totalPrice = cart.items.reduce((acc, curr) => acc + curr.quantity * curr.price, 0);

        await cart.save();
        res.json({ message: "Cart updated", cart });

    } catch (error) {
        console.error("Error updating cart item:", error);
        res.status(500).json({ message: "Server error" });
    }
}




module.exports = {
    getCart,
    addToCart,
    incrementCartItem,
    decrementCartItem,
    decrementOrRemoveCartItem,
}