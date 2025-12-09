const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const Transaction = require('../../models/transactionSchema');
const Wallet = require('../../models/walletSchema');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const getWalletPage = async (req, res) => {
    try {
        console.log("Session data:", req.session);

        const userId = req.session.user?.id;
        console.log("User ID:", userId);

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            console.log("Invalid or missing userId");
            return res.status(401).render('mywallet', {
                transactions: [],
                user: { wallet: 0, name: '', id: '' },
                error: "Please login to view wallet",
                title: 'My Wallet',
                pagination: { currentPage: 1, totalPages: 1, hasNext: false, hasPrev: false }
            });
        }

        const user = await User.findById(userId)
            .select('wallet name _id')
            .lean();

        if (!user) {
            console.log("User not found for ID:", userId);
            return res.status(404).render('mywallet', {
                transactions: [],
                user: { wallet: 0, name: '', id: '' },
                error: 'User not found',
                title: 'My Wallet',
                pagination: { currentPage: 1, totalPages: 1, hasNext: false, hasPrev: false }
            });
        }

        // Pagination setup
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Get total transactions count for pagination
        const totalTransactions = await Wallet.countDocuments({ userId });
        const totalPages = Math.ceil(totalTransactions / limit);

        // Fetch paginated transactions
        const transactions = await Wallet.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        console.log(`Fetched ${transactions.length} transactions (Page ${page}/${totalPages})`);

        const formattedTransactions = transactions.map((tx) => {
            const createdOnDate = new Date(tx.createdAt);
            const formattedDate = createdOnDate.toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });

            const updatedOnDate = new Date(tx.updatedAt);
            const formattedUpdatedDate = updatedOnDate.toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });

            return {
                userId: tx.userId?.toString(),
                type: tx.type.toLowerCase(),
                amount: Number(tx.amount || 0),
                description: tx.description || "Wallet transaction",
                orderId: tx.orderId?.toString(),
                date: formattedDate,
                createdAt: createdOnDate.toISOString(),
                updatedAt: formattedUpdatedDate,
            };
        });

        // Pagination info
        const pagination = {
            currentPage: page,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
            totalTransactions
        };

        res.render('mywallet', {
            transactions: formattedTransactions,
            user: {
                wallet: Number(user.wallet || 0),
                name: user.name || '',
                id: user._id.toString(),
            },
            error: null,
            title: 'My Wallet',
            pagination
        });

    } catch (error) {
        console.error('Wallet page error:', error);
        res.status(500).render('mywallet', {
            transactions: [],
            user: { wallet: 0, name: '', id: '' },
            error: 'Error loading wallet',
            title: 'My Wallet',
            pagination: { currentPage: 1, totalPages: 1, hasNext: false, hasPrev: false }
        });
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
        const userId = req.session.user.id;
        const { addressId, totalAmount, discount, coupon } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.json({ success: false, message: 'Invalid user ID' });
        }

        if (typeof totalAmount !== 'number' || isNaN(totalAmount) || totalAmount <= 0) {
            return res.json({ success: false, message: 'Invalid total amount' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        if (user.wallet < totalAmount) {
            return res.json({ 
                success: false, 
                message: `Insufficient wallet balance. Available: ₹${user.wallet}` 
            });
        }

        const address = await Address.findOne({ userId });
        if (!address || !address.address) {
            return res.json({ success: false, message: '|No addresses found' });
        }

        const selectedAddress = address.address.find(addr => addr._id.toString() === addressId);
        if (!selectedAddress) {
            return res.json({ success: false, message: 'Selected address not found' });
        }

        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.json({ success: false, message: 'Cart is empty' });
        }

        const order = new Order({
            userId,
            orderItems: cart.items.map(item => ({
                product: item.productId._id,
                size: item.size,
                quantity: item.quantity,
                price: item.price,
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
                landmark: selectedAddress.landmark || '',
            },
            status: 'Pending',
            couponApplied: !!coupon,
        });

        await order.save();

        
        user.wallet -= totalAmount;
        const walletTransaction = new Wallet({
            userId: new mongoose.Types.ObjectId(userId),
            type: 'Debit',
            amount: totalAmount,
            description: `Payment for order #${order._id}`,
            orderId: order._id,
            date: new Date(),
        });

        await walletTransaction.save();
        await user.save();

        
        for (const item of order.orderItems) {
            const product = await Product.findById(item.product);
            if (!product) continue;

            const sizeKey = item.size.toString(); 
            const orderedQty = item.quantity;

            
            if (product.sizes && product.sizes[sizeKey] !== undefined) {
                if (product.sizes[sizeKey] < orderedQty) {
                    console.warn(`Low stock warning: Product ${product._id}, size ${sizeKey}`);
                } else {
                    product.sizes[sizeKey] -= orderedQty;
                }
            }

            
            product.quantity -= orderedQty;

            
            if (product.quantity <= 0) {
                product.quantity = 0;
                product.status = 'Out of Stock';
            }

            await product.save();
        }
        

        await Cart.deleteOne({ userId });

        delete req.session.cartAccess;
        req.session.orderPlaced = true;

        return res.json({
            success: true,
            orderId: order._id,
            newBalance: user.wallet.toFixed(2),
            message: 'Order placed successfully',
        });
    } catch (error) {
        console.error('Wallet payment error:', error);
        return res.json({ 
            success: false, 
            message: error.message || 'Failed to place order. Please try again.' 
        });
    }
};



const getWalletHistory = async (req, res) => {
    try {
        console.log("Starting getWalletHistory");
        console.log("Session data:", req.session);
        console.log("Passport user:", req.user);

        const userId = req.session.user?._id || req.session.user?.id;
        const userEmail = req.user?.emails?.[0]?.value;
        console.log("User ID:", userId, "User Email:", userEmail);

        if (!userId && !userEmail) {
            console.log("No user ID or email provided");
            return res.status(401).render("mywallet", {
                transactions: [],
                user: { wallet: 0, name: '' },
                error: "Please login to view wallet history",
            });
        }

        let query = {};
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            query = { _id: userId };
        } else if (userEmail) {
            query = { email: userEmail };
        } else {
            console.log("Invalid userId and no email provided");
            return res.status(401).render("mywallet", {
                transactions: [],
                user: { wallet: 0, name: '' },
                error: "Invalid user credentials",
            });
        }
        console.log("User query:", query);

        const user = await User.findOne(query)
            .select("wallet name email _id")
            .lean();
        console.log("User found:", user);

        if (!user) {
            console.log("User not found for query:", query);
            return res.status(404).render("mywallet", {
                transactions: [],
                user: { wallet: 0, name: '' },
                error: "User account not found",
            });
        }

        const transactions = await Wallet.find({ userId: user._id })
            .sort({ createdAt: -1 })
            .lean();
        console.log("Fetched transactions:", transactions);

        if (transactions.length === 0) {
            console.log("No transactions found for userId:", user._id.toString());
            console.log("Checking wallettransactions collection...");
            const allTransactions = await Wallet.find({}).lean();
            console.log("All transactions in wallettransactions:", allTransactions);
        }

        const formattedTransactions = transactions.map((tx) => {
            const createdOnDate = new Date(tx.createdAt);
            const formattedDate = createdOnDate.toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });

            const updatedOnDate = new Date(tx.updatedAt);
            const formattedUpdatedDate = updatedOnDate.toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });

            return {
                userId: tx.userId?.toString(),
                type: tx.type.toLowerCase(),
                amount: Number(tx.amount || 0),
                description: tx.description || "Wallet transaction",
                orderId: tx.orderId?.toString(),
                date: formattedDate,
                createdAt: createdOnDate.toISOString(),
                updatedAt: formattedUpdatedDate,
            };
        });
        console.log("Formatted transactions:", formattedTransactions);

        res.render("mywallet", {
            transactions: formattedTransactions,
            user: {
                wallet: Number(user.wallet || 0),
                name: user.name || '',
                id: user._id.toString(),
            },
            error: null,
        });
    } catch (error) {
        console.error("getWalletHistory - Error:", error);
        res.status(500).render("mywallet", {
            transactions: [],
            user: { wallet: 0, name: '', id: '' },
            error: "Failed to load wallet history. Please try again.",
        });
    }
};




module.exports = {
    getWalletPage,
    getWalletBalance,
    placeOrderWithWallet,
    getWalletHistory
    
};