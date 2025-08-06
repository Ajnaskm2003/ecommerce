const mongoose = require('mongoose');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const Transaction = require('../../models/transactionSchema');
const { v4: uuidv4 } = require('uuid');

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
    try {
        console.log("=== Wallet Payment Started ===");
        const userId = req.session.user.id;
        const { addressId, totalAmount, discount, coupon } = req.body;

        console.log('Request data:', { userId, addressId, totalAmount });

        // Get user and validate
        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        // Check wallet balance
        if (user.wallet < totalAmount) {
            return res.json({ 
                success: false, 
                message: `Insufficient wallet balance. Available: ₹${user.wallet}` 
            });
        }

        // Get address - Fixed address query
        const address = await Address.findOne({ userId });
        console.log('Found address document:', address);

        if (!address || !address.address) {
            return res.json({ success: false, message: 'No addresses found' });
        }

        // Find the specific address in the array
        const selectedAddress = address.address.find(addr => addr._id.toString() === addressId);
        console.log('Selected address:', selectedAddress);

        if (!selectedAddress) {
            return res.json({ success: false, message: 'Selected address not found' });
        }

        // Get cart and validate
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        console.log('Cart found:', cart ? 'Yes' : 'No');

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.json({ success: false, message: 'Cart is empty' });
        }

        // Create order
        const order = new Order({
            userId,
            orderItems: cart.items.map(item => ({
                product: item.productId._id,
                size: item.size,
                quantity: item.quantity,
                price: item.price
            })),
            totalPrice: totalAmount,
            discount: discount || 0,
            totalAmount,
            paymentMethod: 'Wallet Payment',
            paymentStatus: 'Paid',
            address: {
                fullname: selectedAddress.fullname,
                street: selectedAddress.street,
                city: selectedAddress.city,
                state: selectedAddress.state,
                zipCode: selectedAddress.zipCode,
                phone: selectedAddress.phone,
                landmark: selectedAddress.landmark
            },
            status: 'Pending',
            couponApplied: !!coupon
        });

        await order.save();
        console.log('Order created:', order._id);

        // Update wallet balance
        user.wallet -= totalAmount;
        await user.save();
        console.log('Wallet updated. New balance:', user.wallet);

        // Clear cart
        await Cart.findByIdAndDelete(cart._id);
        console.log('Cart cleared');

        return res.json({
            success: true,
            orderId: order._id,
            newBalance: user.wallet.toFixed(2),
            message: 'Order placed successfully'
        });

    } catch (error) {
        console.error('Wallet payment error:', error);
        return res.json({ 
            success: false, 
            message: error.message || 'Failed to place order. Please try again.' 
        });
    }
};


module.exports = {
    getWalletPage,
    getWalletBalance,
    placeOrderWithWallet,
    
};