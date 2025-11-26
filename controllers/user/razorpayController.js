const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const WalletTransaction = require('../../models/walletSchema');
const Coupon = require('../../models/coupenSchema');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});



const createOrder = async (req, res) => {
  try {
    const { addressId, totalAmount: clientTotalAmount, coupon, retryOrderId } = req.body;
    const userId = req.session.user?.id;

    if (!userId) return res.status(401).json({ success: false, message: "Login required" });

    let finalAmount;
    let orderToUse;
    let cart = null;
    let calculatedTotal = 0;
    let appliedDiscount = 0;

    // CASE 1: RETRY PAYMENT (reuse existing temp order)
    if (retryOrderId) {
      orderToUse = await Order.findOne({
        _id: retryOrderId,
        userId,
        isTemp: true,
        paymentMethod: "Online Payment",
        paymentStatus: { $in: ["Pending", "Failed"] }
      });

      if (!orderToUse) {
        return res.status(400).json({ success: false, message: "Order not found or cannot be retried" });
      }

      finalAmount = orderToUse.totalAmount;
    } 
    // CASE 2: NORMAL CHECKOUT
    else {
      // Validate address
      const addressDoc = await Address.findOne({ userId, 'address._id': addressId });
      if (!addressDoc) return res.status(400).json({ success: false, message: "Address not found" });

      // Load cart
      cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart || cart.items.length === 0) return res.status(400).json({ success: false, message: "Cart is empty" });

      // Calculate total
      calculatedTotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      
      if (coupon) {
        const couponDoc = await Coupon.findOne({ code: coupon, isActive: true, expiryDate: { $gte: new Date() } });
        if (couponDoc && calculatedTotal >= (couponDoc.minAmount || 0)) {
          if (couponDoc.type === 'fixed') appliedDiscount = couponDoc.value;
          else if (couponDoc.type === 'percentage') {
            appliedDiscount = (calculatedTotal * couponDoc.value) / 100;
            if (couponDoc.maxDiscount) appliedDiscount = Math.min(appliedDiscount, couponDoc.maxDiscount);
          }
        }
      }

      finalAmount = Math.max(1, calculatedTotal - appliedDiscount);
      finalAmount = Number(finalAmount.toFixed(2));

      if (Math.abs(finalAmount - clientTotalAmount) > 1) {
        return res.status(400).json({ success: false, message: "Amount mismatch" });
      }

      
      const customOrderId = `ORD${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${Math.floor(1000 + Math.random() * 9000)}`;

      const orderItems = cart.items.map(item => ({
        product: item.productId._id,
        size: item.size,
        quantity: item.quantity,
        price: item.price,
        status: 'Pending'
      }));

      const selectedAddress = addressDoc.address.find(a => a._id.toString() === addressId);

      orderToUse = await Order.create({
        orderId: customOrderId,
        userId,
        orderItems,
        totalPrice: calculatedTotal,
        discount: appliedDiscount,
        totalAmount: finalAmount,
        paymentMethod: "Online Payment",
        paymentStatus: "Pending",
        address: {
          fullname: selectedAddress.fullname,
          phone: selectedAddress.phone,
          street: selectedAddress.street,
          city: selectedAddress.city,
          state: selectedAddress.state,
          zipCode: selectedAddress.zipCode,
        },
        status: "Pending",
        couponApplied: !!coupon,
        coupon: coupon || null,
        isTemp: true
      });
    }

    
    const amountInPaise = Math.round(finalAmount * 100);
    if (amountInPaise < 100) return res.status(400).json({ success: false, message: "Minimum ₹1 required" });

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_${orderToUse._id}`
    });

    orderToUse.razorpayOrderId = razorpayOrder.id;
    await orderToUse.save();

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      mongoOrderId: orderToUse._id.toString(),
      displayOrderId: orderToUse.orderId,
      amount: razorpayOrder.amount,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error("Create Order Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


const verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      mongoOrderId,
      orderIds
    } = req.body;

    const orderIdToUse = mongoOrderId || (Array.isArray(orderIds) ? orderIds[0] : orderIds);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderIdToUse) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Invalid payment data" });
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await Order.findByIdAndUpdate(orderIdToUse, { paymentStatus: "Failed", status: "Cancelled" }, { session });
      await session.commitTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    const order = await Order.findById(orderIdToUse).populate('orderItems.product').session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Order not found" });
    }

    // DEDUCT STOCK
    for (const item of order.orderItems) {
      const product = item.product;
      if (!product) continue;

      const sizeKey = item.size?.toString();
      const qty = item.quantity;

      if (sizeKey && product.sizes?.[sizeKey] !== undefined) {
        product.sizes[sizeKey] = Math.max(0, product.sizes[sizeKey] - qty);
      }
      product.quantity = Math.max(0, (product.quantity || 0) - qty);
      if (product.quantity <= 0) product.status = "Out of Stock";

      await product.save({ session });
    }

    // CONFIRM ORDER — ONLY VALID ENUM VALUES
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    order.paymentStatus = "Paid";
    order.status = "Processing";           // VALID ENUM VALUE
    order.invoiceDate = new Date();
    order.paidAt = new Date();
    order.isTemp = false;
    await order.save({ session });

    // Clear cart
    await Cart.deleteOne({ userId: req.session.user.id }).session(session);

    await session.commitTransaction();
    session.endSession();

    req.session.orderPlaced = true;
    delete req.session.cartAccess;

    return res.json({
      success: true,
      message: "Payment successful! Your order is being processed.",
      orderId: order.orderId,
      mongoOrderId: order._id
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Verify Payment Error:", error);

    // Mark failed if possible
    try {
      if (req.body.mongoOrderId || req.body.orderIds) {
        const id = req.body.mongoOrderId || (Array.isArray(req.body.orderIds) ? req.body.orderIds[0] : req.body.orderIds);
        await Order.findByIdAndUpdate(id, {
          paymentStatus: "Failed",
          status: "Cancelled",  // VALID ENUM
          isTemp: false
        });
      }
    } catch (e) { }

    return res.status(500).json({ success: false, message: "Payment failed" });
  }
};


const showRetryPage = async (req, res) => {
  try {
    const orderId = req.query.orderId;

    if (!orderId) {
      return res.redirect('/cart');
    }

    const order = await Order.findOne({
      _id: orderId,
      userId: req.session.user.id,
      isTemp: true,
      paymentStatus: { $in: ['Pending', 'Failed'] }
    }).populate('orderItems.product');

    if (!order) {
      return res.send('<script>alert("Order not found or already processed"); window.location="/orders"</script>');
    }

    res.render('retry-payment', {
      orders: [order],
      orderIds: orderId,
      totalAmount: order.totalAmount,
      razorpayKey: process.env.RAZORPAY_KEY_ID
    });

  } catch (err) {
    console.error(err);
    res.redirect('/cart');
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