const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const createOrder = async (req, res) => {
    try {
        const { totalAmount, addressId } = req.body;
        const userId = req.session.user.id;

        7// Validate address
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

        // Get cart items with product details
        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Cart is empty" 
            });
        }

        // Create Razorpay order
        const options = {
            amount: totalAmount * 100,
            currency: "INR",
            receipt: "order_rcptid_" + Math.random().toString(36).substr(2, 9)
        };

        const razorpayOrder = await razorpay.orders.create(options);

        // Create separate orders for each cart item
        const orders = [];

        for (const item of cart.items) {
            // Calculate individual item total
            const itemTotal = item.quantity * item.price;

            // Create new order for each item
            const newOrder = new Order({
                userId,
                orderItems: [{
                    product: item.productId._id,
                    size: item.size,
                    quantity: item.quantity,
                    price: item.price,
                    status: 'Pending'
                }],
                totalPrice: itemTotal,
                totalAmount: itemTotal,
                paymentMethod: "Online Payment",
                razorpayOrderId: razorpayOrder.id,
                paymentStatus: "Pending",
                address: {
                    fullname: selectedAddress.fullname,
                    street: selectedAddress.street,
                    city: selectedAddress.city,
                    state: selectedAddress.state,
                    zipCode: selectedAddress.zipCode,
                    phone: selectedAddress.phone
                },
                status: "Pending"
            });

            const savedOrder = await newOrder.save();
            orders.push(savedOrder);
        }

        // Clear the cart after creating orders
        await Cart.findByIdAndDelete(cart._id);

        res.json({
            success: true,
            orderId: razorpayOrder.id,
            orderIds: orders.map(order => order._id),
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency
        });

    } catch (error) {
        console.error("❌ Error Creating Order:", error);
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
            orderIds  // Array of order IDs
        } = req.body;

        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        if (generatedSignature === razorpay_signature) {
            // Update all orders associated with this payment
            await Promise.all(orderIds.map(orderId => 
                Order.findByIdAndUpdate(
                    orderId,
                    {
                        razorpayPaymentId: razorpay_payment_id,
                        razorpaySignature: razorpay_signature,
                        paymentStatus: "Paid",
                        invoiceDate: new Date()
                    }
                )
            ));

            res.json({ 
                success: true, 
                message: "Payment verified successfully",
                orderIds: orderIds // Return all order IDs
            });
        } else {
            // Mark all orders as failed if verification fails
            await Promise.all(orderIds.map(orderId => 
                Order.findByIdAndUpdate(orderId, {
                    paymentStatus: "Failed"
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

module.exports = {
    createOrder,
    verifyPayment
};