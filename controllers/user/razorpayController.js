const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const createOrder = async (req, res) => {
    try {
        const { totalAmount, addressId } = req.body;
        const userId = req.session.user.id;
        console.log("userId:", userId);

        // ✅ Fetch Cart with Fully Populated Product Data
        const cart = await Cart.findOne({ userId }).populate({
            path: "items.productId",
          //  model: "Product",  Ensure correct model reference
            select: "name price images stock" // Select required fields
        });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        console.log("🛒 Cart Data:", cart);

        // ✅ Razorpay Order Options
        const options = {
            amount: totalAmount * 100, // Convert to paise
            currency: "INR",
            receipt: "order_rcptid_" + Math.random().toString(36).substr(2, 9)
        };

        const razorpayOrder = await razorpay.orders.create(options);

        // ✅ Create Order in Database
        const order = new Order({
            userId,
            orderItems: cart.items.map(item => ({
                product: item.productId._id,
                size: item.size,
                quantity: item.quantity,
                price: item.price,
                status: 'Pending'
            })),
            totalPrice: totalAmount,
            totalAmount,
            paymentMethod: "Online Payment",
            razorpayOrderId: razorpayOrder.id,
            paymentStatus: "Pending",
            address: addressId,
            status: "Pending"
        });

        console.log("📦 New Order:", order);

        await order.save();

        res.json({
            success: true,
            orderId: razorpayOrder.id,
            dbOrderId: order._id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency
        });

    } catch (error) {
        console.error("❌ Error Creating Order:", error);
        res.status(500).json({ success: false, message: "Order creation failed" });
    }
};




const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, dbOrderId } = req.body;

        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        if (generatedSignature === razorpay_signature) {
            // Update the order in your database
            const updatedOrder = await Order.findByIdAndUpdate(
                dbOrderId,
                {
                    razorpayPaymentId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature,
                    paymentStatus: "Paid",
                    invoiceDate: new Date()
                },
                { new: true }
            );

            res.json({ 
                success: true, 
                message: "Payment verified successfully",
                orderId: razorpay_order_id // Your custom order ID
            });
        } else {
            // Mark the order as failed if verification fails
            await Order.findByIdAndUpdate(dbOrderId, {
                paymentStatus: "Failed"
            });
            
            res.status(400).json({ success: false, message: "Payment verification failed" });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

module.exports = {
    createOrder,
    verifyPayment
};