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
        const { totalAmount, addressId } = req.body;
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

        const options = {
            amount: totalAmount * 100,
            currency: "INR",
            receipt: "order_rcptid_" + Math.random().toString(36).substr(2, 9),
        };

        const razorpayOrder = await razorpay.orders.create(options);
        const orders = [];

        for (const item of cart.items) {
            const itemTotal = item.quantity * item.price;

            const newOrder = new Order({
                userId,
                orderItems: [{
                    product: item.productId._id,
                    size: item.size,
                    quantity: item.quantity,
                    price: item.price,
                    status: 'Pending',
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
                    phone: selectedAddress.phone,
                },
                status: "Pending",
            });

            const savedOrder = await newOrder.save();
            orders.push(savedOrder);

            
            const walletTransaction = new WalletTransaction({
                userId,
                type: "Debit",
                amount: itemTotal,
                description: `Payment for order ${savedOrder._id} via Razorpay`,
                orderId: savedOrder._id,
                date: new Date(),
            });

            await walletTransaction.save();
        }

        await Cart.deleteOne({ userId });

        delete req.session.cartAccess;
        req.session.orderPlaced = true;

        res.json({
            success: true,
            orderId: razorpayOrder.id,
            orderIds: orders.map(order => order._id),
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

module.exports = {
    createOrder,
    verifyPayment
};