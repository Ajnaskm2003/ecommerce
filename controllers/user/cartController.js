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
        const { productId, size } = req.body; 
        const userId = req.session.user?.id;  

        if (!userId) return res.status(401).json({ message: "User not authenticated" });

        
        const product = await Product.findById(productId);
        if (!product || product.blocked || product.sizes[size] <= 0) {
            return res.status(400).json({ message: "Product not available" });
        }

        
        const selectedSize = size.toString(); 

        
        let cart = await Cart.findOne({ userId });
        if (!cart) cart = new Cart({ userId, items: [] });

        
        const existingItem = cart.items.find(item => 
            item.productId.equals(productId) && item.size === selectedSize
        );

        
        if (existingItem) {
            
            if (existingItem.quantity + 1 > product.sizes[selectedSize]) {
                return res.status(400).json({ message: "Stock limit exceeded" });
            }
            existingItem.quantity += 1; 
        } else {
            
            cart.items.push({ productId, size: selectedSize, quantity: 1, price: product.salePrice });
        }

        
        await cart.save();

        
        await Wishlist.updateOne({ userId }, { $pull: { items: { productId } } });

        
        res.json({ message: "Product added to cart", cart });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error });
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