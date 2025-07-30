const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema')
const Transaction = require('../../models/transactionSchema');
const{v4: uuidv4} = require('uuid');

const getWalletPage = async (req, res) => {
    try {
        const userId = req.session.user.id;

        
        const user = await User.findById(userId)
            .select('wallet')  
            .lean();

        if (!user) {
            return res.status(404).send('User not found');
        }

        
        user.wallet = user.wallet || 0;

        
        const transactions = await Transaction.find({ userId })
            .sort({ createdAt: -1 })
            .lean();

        res.render('mywallet', {  
            user,
            transactions,
            title: 'My Wallet'
        });

    } catch (error) {
        console.error('Wallet page error:', error);
        res.status(500).send('Error loading wallet');
    }
};


const getWalletBalance = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        // Ensure wallet exists and is a number
        const balance = typeof user.wallet === 'number' ? user.wallet : 0;

        res.json({ 
            success: true, 
            balance: parseFloat(balance).toFixed(2) 
        });
    } catch (error) {
        console.error('Error getting wallet balance:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch wallet balance' 
        });
    }
};







const placeOrderWithWallet = async (req, res) => {
    const session = await mongoose.startSession();
    console.log("walletttttttttttt");
    
    try {
        await session.withTransaction(async () => {
            const { addressId, totalAmount, discount = 0, coupon } = req.body;
            const userId = req.session.user._id;

            
            const user = await User.findById(userId).session(session);
            if (!user) {
                throw new Error("User not found");
            }

            if (user.wallet < totalAmount) {
                throw new Error("Insufficient wallet balance");
            }

            
            const addressDoc = await Address.findOne({ userId, "address._id": addressId }).session(session);
            if (!addressDoc) {
                throw new Error("Address not found");
            }

            const selectedAddress = addressDoc.address.find(addr => addr._id.toString() === addressId);
            if (!selectedAddress) {
                throw new Error("Selected address not found");
            }

            
            const cart = await Cart.findOne({ userId }).populate('items.productId').session(session);
            if (!cart || cart.items.length === 0) {
                throw new Error("Cart is empty");
            }

            
            for (const item of cart.items) {
                const product = await Product.findById(item.productId._id).session(session);
                if (!product || product.sizes[item.size] < item.quantity) {
                    throw new Error(`Stock issue with ${item.productId.productName} (Size: ${item.size})`);
                }
            }

            
            const orderItems = cart.items.map(item => ({
                product: item.productId._id,
                size: item.size,
                quantity: item.quantity,
                price: item.price,
                status: 'Pending'
            }));

        
            const newOrder = new Order({
                userId,
                orderItems,
                totalPrice: totalAmount + discount,
                discount,
                totalAmount,
                paymentMethod: 'Wallet Payment',
                address: {
                    fullname: selectedAddress.fullname,
                    street: selectedAddress.street,
                    city: selectedAddress.city,
                    state: selectedAddress.state,
                    zipCode: selectedAddress.zipCode,
                    phone: selectedAddress.phone
                },
                status: 'Pending',
                couponApplied: !!coupon,
                walletTransactionId: uuidv4()
            });

        
            user.wallet -= totalAmount;

            
            for (const item of cart.items) {
                const product = await Product.findById(item.productId._id).session(session);
                product.sizes[item.size] -= item.quantity;
                product.quantity -= item.quantity;
                await product.save({ session });
            }

            await newOrder.save({ session });
            await user.save({ session });
            await Cart.deleteOne({ userId }).session(session);

            res.status(200).json({
                success: true,
                message: 'Order placed successfully using wallet',
                orderId: newOrder._id,
                newBalance: user.wallet.toFixed(2)
            });

        });

    } catch (error) {
        console.error("Error placing order with wallet:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Order placement failed"
        });
    } finally {
        session.endSession();
    }
};







module.exports = {
    getWalletPage,
    getWalletBalance,
    placeOrderWithWallet
};