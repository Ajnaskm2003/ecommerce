const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");


const getCart = async (req, res) => {
    try {
        const userId = req.session.user?.id; 

        if (!userId) {
            return res.redirect('/login');
        }

        // Set cache control headers
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

        const cart = await Cart.findOne({ userId }).populate('items.productId');

        // Remove the redirection to orders
        if (!cart || !cart.items.length) {
            return res.render('cart', { 
                cart: { items: [] },
                message: 'Your cart is empty'
            });
        }

        res.render('cart', { 
            cart: cart,
            message: null
        }); 

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
            return res.json({ success: false, message: "Product not found" });
        }

        if (product.blocked) {
            return res.json({ success: false, message: "This product is currently unavailable" });
        }

    
        const stockForSize = product.sizes[size];
        if (stockForSize === undefined) {
            return res.json({ success: false, message: "Selected size not available" });
        }

        if (stockForSize <= 0) {
            return res.json({ success: false, message: "Selected size is out of stock" });
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

        
        await Wishlist.updateOne(
            { userId }, 
            { $pull: { items: { productId } } }
        );

        return res.json({ success: true,message: "Product added to cart successfully",cart: cart });

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
        const userId = req.session.user?.id;
        const { cartItemId } = req.body;

        if (!userId || !cartItemId) {
            return res.json({ 
                success: false, 
                message: "Invalid request" 
            });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.json({ 
                success: false, 
                message: "Cart not found" 
            });
        }

        const cartItem = cart.items.id(cartItemId);
        if (!cartItem) {
            return res.json({ 
                success: false, 
                message: "Item not found in cart" 
            });
        }

        // Check stock before increment
        const product = await Product.findById(cartItem.productId);
        if (!product) {
            return res.json({ 
                success: false, 
                message: "Product not found" 
            });
        }

        const size = product.sizes[cartItem.size];
        if (cartItem.quantity >= size) {
            return res.json({ 
                success: false, 
                message: "Maximum stock limit reached" 
            });
        }

        cartItem.quantity += 1;
        await cart.save();

        res.json({ 
            success: true, 
            message: "Quantity updated" 
        });

    } catch (error) {
        console.error("Increment error:", error);
        res.json({ 
            success: false, 
            message: "Failed to update quantity" 
        });
    }
};

const decrementCartItem = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const { cartItemId } = req.body;

        if (!userId || !cartItemId) {
            return res.json({ 
                success: false, 
                message: "Invalid request" 
            });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.json({ 
                success: false, 
                message: "Cart not found" 
            });
        }

        const cartItem = cart.items.id(cartItemId);
        if (!cartItem) {
            return res.json({ 
                success: false, 
                message: "Item not found in cart" 
            });
        }

        if (cartItem.quantity <= 1) {
            cart.items.pull(cartItemId);
        } else {
            cartItem.quantity -= 1;
        }

        await cart.save();

        res.json({ 
            success: true, 
            message: "Quantity updated" 
        });

    } catch (error) {
        console.error("Decrement error:", error);
        res.json({ 
            success: false, 
            message: "Failed to update quantity" 
        });
    }
};





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