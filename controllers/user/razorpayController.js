const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const WalletTransaction = require('../../models/walletSchema');
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


const createOrder = async (req, res) => {
    try {
        const { totalAmount, addressId, coupon } = req.body; 
        const userId = req.session.user.id;

        
        const addressDoc = await Address.findOne({ 
            userId: userId,
            'address._id': addressId 
        });

        if (!addressDoc) {
            return res.status(400).json({ 
                success: false, 
                message: "Address not found" 
            });
        }

        const selectedAddress = addressDoc.address.find(
            addr => addr._id.toString() === addressId
        );

        if (!selectedAddress) {
            return res.status(400).json({ 
                success: false, 
                message: "Selected address not found" 
            });
        }

        
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Cart is totally empty" 
            });
        }


        let appliedDiscount = 0;

        if (coupon) {
            const couponDoc = await Coupon.findOne({
                code: coupon,
                isActive: true,
                expiryDate: { $gte: new Date() }
            });

            if (!couponDoc) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid or expired coupon"
                });
            }


            if (couponDoc.minAmount && totalAmount < couponDoc.minAmount) {
                return res.status(400).json({
                    success: false,
                    message: `Minimum order amount is ₹${couponDoc.minAmount}`
                });
            }

            
            if (couponDoc.type === 'fixed') {
                appliedDiscount = couponDoc.value;
            } else if (couponDoc.type === 'percentage') {
                appliedDiscount = (totalAmount * couponDoc.value) / 100;
                if (couponDoc.maxDiscount && appliedDiscount > couponDoc.maxDiscount) {
                    appliedDiscount = couponDoc.maxDiscount;
                }
            }
        }

        const finalAmount = totalAmount - appliedDiscount;

        const options = {
            amount: finalAmount * 100, 
            currency: "INR",
            receipt: "order_rcptid_" + Math.random().toString(36).substr(2, 9),
        };

        const razorpayOrder = await razorpay.orders.create(options);

        const orderItems = cart.items.map(item => ({
            product: item.productId._id,
            size: item.size,
            quantity: item.quantity,
            price: item.price,
            status: 'Pending',
        }));

        const newOrder = new Order({
            userId,
            orderItems, 
            totalPrice: totalAmount,                   
            discount: appliedDiscount,              
            totalAmount: finalAmount,                 
            paymentMethod: "Online Payment",
            razorpayOrderId: razorpayOrder.id,
            paymentStatus: "Pending",
            address: {
                fullname: selectedAddress.fullname,
                street: selectedAddress.street,
                city: selectedAddress.city,
                state: selectedAddress.state,
                zipCode: selectedAddress.zipCode,
                phone: selectedAddress.phone,
            },
            status: "Pending",
            couponApplied: !!coupon,                  
            coupon: coupon || null,                    
        });

        const savedOrder = await newOrder.save();

        
        await Cart.deleteOne({ userId });
        delete req.session.cartAccess;
        req.session.orderPlaced = true;

        
        res.json({
            success: true,
            orderId: razorpayOrder.id,
            orderIds: [savedOrder._id], 
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
        });
    } catch (error) {
        console.error("Error Creating Order:", error);
        res.status(500).json({ 
            success: false, 
            message: "Order creation failed" 
        });
    }
};



const verifyPayment = async (req, res) => {
    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature,
            orderIds 
        } = req.body;

        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        if (generatedSignature === razorpay_signature) {
        
            await Promise.all(orderIds.map(orderId => 
                Order.findByIdAndUpdate(
                    orderId,
                    {
                        razorpayPaymentId: razorpay_payment_id,
                        razorpaySignature: razorpay_signature,
                        paymentStatus: "Paid",
                        invoiceDate: new Date(),
                    }
                )
            ));

    
            for (const orderId of orderIds) {
                const order = await Order.findById(orderId)
                    .populate({
                        path: 'orderItems.product',
                        model: 'Product'
                    });

                if (!order) continue;

                for (const item of order.orderItems) {
                    const product = item.product;
                    if (!product) continue;

                    const sizeKey = item.size.toString(); 
                    const orderedQty = item.quantity;

                    
                    if (product.sizes && product.sizes[sizeKey] !== undefined) {
                        if (product.sizes[sizeKey] < orderedQty) {
                            
                            console.warn(`Insufficient stock for product ${product._id}, size ${sizeKey}`);
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
            }

            
            delete req.session.cartAccess;
            req.session.orderPlaced = true;

            res.json({ 
                success: true, 
                message: "Payment verified successfully",
                orderIds: orderIds 
            });
        } else {
            
            await Promise.all(orderIds.map(orderId => 
                Order.findByIdAndUpdate(orderId, {
                    paymentStatus: "Failed",
                })
            ));
            
            res.status(400).json({ 
                success: false, 
                message: "Payment verification failed" 
            });
        }
    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Internal Server Error" 
        });
    }
};

const showRetryPage = async (req, res) => {
    try {
        const userId = req.session.user.id;

        
        const orders = await Order.find({
            userId,
            paymentMethod: 'Online Payment',
            paymentStatus: 'Failed'
        }).populate('orderItems.product');

        if (!orders || orders.length === 0) {
            return res.redirect('/cart');   
        }

        const totalAmount = orders.reduce((sum, o) => sum + o.totalAmount, 0);
        const orderIds = orders.map(o => o._id.toString());

        res.render('retry-payment', {
            orders,
            totalAmount,
            orderIds: orderIds.join(','),          
            razorpayKey: process.env.RAZORPAY_KEY_ID
        });
    } catch (err) {
        console.error('Retry page error:', err);
        res.status(500).send('Server error');
    }
};


const initiateRetry = async (req, res) => {
    try {
        const { orderIds } = req.body;
        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid order ids' });
        }

        const orders = await Order.find({
            _id: { $in: orderIds },
            paymentStatus: 'Failed',
            paymentMethod: 'Online Payment'
        });

        if (orders.length === 0) {
            return res.status(400).json({ success: false, message: 'No failed orders found' });
        }

        const totalAmount = orders.reduce((sum, o) => sum + o.totalAmount, 0);

        const razorpayOrder = await razorpay.orders.create({
            amount: totalAmount * 100,               
            currency: 'INR',
            receipt: `retry_${Date.now()}`
        });

        
        await Order.updateMany(
            { _id: { $in: orderIds } },
            { razorpayOrderId: razorpayOrder.id }
        );

        res.json({
            success: true,
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency
        });
    } catch (err) {
        console.error('Retry initiate error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


const markFailed = async (req, res) => {
    try {
        const { orderIds } = req.body;
        await Order.updateMany(
            { _id: { $in: orderIds } },
            { paymentStatus: 'Failed' }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Mark failed error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    createOrder,
    verifyPayment,
    markFailed,
    initiateRetry,
    showRetryPage

};