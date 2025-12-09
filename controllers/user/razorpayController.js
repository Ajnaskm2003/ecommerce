const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const WalletTransaction = require('../../models/walletSchema');
const Coupon = require('../../models/coupenSchema');
const Product = require('../../models/productSchema');
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

    if (!userId) {
      return res.status(401).json({ success: false, message: "Login required" });
    }

    let finalAmount = 0;
    let orderToUse = null;
    let cart = null;
    let calculatedTotal = 0;
    let appliedDiscount = 0;

    const toSafeNumber = (val) => {
      const num = parseFloat(val);
      return isNaN(num) ? 0 : num;
    };

    // ─────── RETRY PAYMENT CASE ───────
    if (retryOrderId) {
      orderToUse = await Order.findOne({
        _id: retryOrderId,
        userId,
        isTemp: true,
        paymentMethod: "Online Payment",
        paymentStatus: { $in: ["Pending", "Failed"] }
      });

      if (!orderToUse) {
        return res.status(400).json({ success: false, message: "Invalid or expired retry order" });
      }
      finalAmount = orderToUse.totalAmount;
    } 
    // ─────── NORMAL FLOW ───────
    else {
      const addressDoc = await Address.findOne({ userId, 'address._id': addressId });
      if (!addressDoc) {
        return res.status(400).json({ success: false, message: "Address not found" });
      }

      cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ success: false, message: "Your cart is empty" });
      }

      const unavailableItems = [];
      let hasStockIssue = false;

      // ─────── STOCK VALIDATION (CRITICAL FIX) ───────
      for (const item of cart.items) {
        const product = item.productId;
        if (!product || product.isBlocked || product.status === "Out of Stock") {
          unavailableItems.push(`${item.productName || 'Product'} is no longer available`);
          hasStockIssue = true;
          continue;
        }

        const requestedQty = toSafeNumber(item.quantity);
        const sizeKey = item.size?.toString();

        let availableStock = 0;

        if (sizeKey && product.sizes?.[sizeKey] !== undefined) {
          availableStock = product.sizes[sizeKey];
        } else {
          availableStock = product.quantity || 0;
        }

        if (availableStock < requestedQty) {
          const sizeMsg = sizeKey ? ` (Size ${sizeKey})` : "";
          unavailableItems.push(
            `${product.productName}${sizeMsg} - Only ${availableStock} left (you need ${requestedQty})`
          );
          hasStockIssue = true;
        }
      }

      if (hasStockIssue) {
        return res.status(400).json({
          success: false,
          message: "Some items are out of stock or have insufficient quantity:",
          outOfStockItems: unavailableItems
        });
      }
      // ─────── END OF STOCK CHECK ───────

      // Calculate subtotal (only after stock is confirmed)
      calculatedTotal = cart.items.reduce((sum, item) => {
        const price = toSafeNumber(item.price);
        const qty = toSafeNumber(item.quantity);
        return sum + price * qty;
      }, 0);

      if (calculatedTotal <= 0) {
        return res.status(400).json({ success: false, message: "Invalid cart amount" });
      }

      // Coupon logic (your existing fixed version)
      if (coupon && typeof coupon === "string" && coupon.trim() !== "") {
        const couponCode = coupon.trim().toUpperCase();
        const couponDoc = await Coupon.findOne({
          code: couponCode,
          isActive: true,
          expiryDate: { $gte: new Date() }
        }).lean();

        if (!couponDoc) {
          return res.status(400).json({ success: false, message: "Invalid or expired coupon" });
        }

        const minPurchase = toSafeNumber(couponDoc.minPurchase);
        if (calculatedTotal < minPurchase) {
          return res.status(400).json({
            success: false,
            message: `Minimum purchase ₹${minPurchase} required for this coupon`
          });
        }

        const discountValue = toSafeNumber(couponDoc.discount);
        if (couponDoc.type === "flat") {
          appliedDiscount = discountValue;
        } else if (couponDoc.type === "percentage") {
          appliedDiscount = (calculatedTotal * discountValue) / 100;
          const maxDisc = toSafeNumber(couponDoc.maxDiscount);
          if (maxDisc > 0) appliedDiscount = Math.min(appliedDiscount, maxDisc);
        }
      }

      appliedDiscount = Number(appliedDiscount.toFixed(2));
      finalAmount = Math.max(1, Number((calculatedTotal - appliedDiscount).toFixed(2)));

      // Client-side amount tampering check
      const clientAmount = toSafeNumber(clientTotalAmount);
      if (Math.abs(finalAmount - clientAmount) > 1) {
        console.warn("Possible tampering", { clientAmount, finalAmount, userId });
        return res.status(400).json({ success: false, message: "Amount mismatch. Please try again." });
      }

      // Create temp order only if stock is available
      const customOrderId = `ORD${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${Math.floor(1000 + Math.random() * 9000)}`;

      const orderItems = cart.items.map(item => ({
        product: item.productId._id,
        size: item.size,
        quantity: item.quantity,
        price: toSafeNumber(item.price),
        status: "Pending"
      }));

      const selectedAddress = addressDoc.address.find(a => a._id.toString() === addressId);

      orderToUse = await Order.create({
        orderId: customOrderId,
        userId,
        orderItems,
        totalPrice: Number(calculatedTotal.toFixed(2)),
        discount: appliedDiscount,
        totalAmount: finalAmount,
        paymentMethod: "Online Payment",
        paymentStatus: "Pending",
        address: selectedAddress.toObject(),
        status: "Pending",
        couponApplied: appliedDiscount > 0,
        coupon: coupon || null,
        isTemp: true
      });
    }

    const amountInPaise = Math.round(finalAmount * 100);
    if (amountInPaise < 100) {
      return res.status(400).json({ success: false, message: "Order amount too low" });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_${orderToUse._id}`
    });

    orderToUse.razorpayOrderId = razorpayOrder.id;
    await orderToUse.save();

    return res.json({
      success: true,
      orderId: razorpayOrder.id,
      mongoOrderId: orderToUse._id.toString(),
      displayOrderId: orderToUse.orderId,
      amount: razorpayOrder.amount,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error("Create Order Error:", error);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
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

    
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    order.paymentStatus = "Paid";
    order.status = "Processing";          
    order.invoiceDate = new Date();
    order.paidAt = new Date();
    order.isTemp = false;
    await order.save({ session });

    
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

    
    try {
      if (req.body.mongoOrderId || req.body.orderIds) {
        const id = req.body.mongoOrderId || (Array.isArray(req.body.orderIds) ? req.body.orderIds[0] : req.body.orderIds);
        await Order.findByIdAndUpdate(id, {
          paymentStatus: "Failed",
          status: "Cancelled",  
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