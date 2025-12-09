const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const WalletTransaction = require('../../models/walletSchema');
const Coupon = require('../../models/coupenSchema');
const mongoose = require('mongoose');
const Product = require('../../models/productSchema');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();



const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});



const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { addressId, totalAmount: clientTotalAmount, coupon, retryOrderId } = req.body;
    const userId = req.session.user?.id;

    if (!userId) {
      await session.abortTransaction();
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

    // RETRY CASE — just reuse existing temp order
    if (retryOrderId) {
      orderToUse = await Order.findOne({
        _id: retryOrderId,
        userId,
        isTemp: true,
        paymentMethod: "Online Payment",
        paymentStatus: { $in: ["Pending", "Failed"] }
      }).session(session);

      if (!orderToUse) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Invalid retry order" });
      }
      finalAmount = orderToUse.totalAmount;
    } 
    // NORMAL FLOW — create new temp order
    else {
      const addressDoc = await Address.findOne({ userId, 'address._id': addressId }).session(session);
      if (!addressDoc) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Address not found" });
      }

      cart = await Cart.findOne({ userId }).populate('items.productId').session(session);
      if (!cart || cart.items.length === 0) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Your cart is empty" });
      }

      // Calculate subtotal
      calculatedTotal = cart.items.reduce((sum, item) => sum + toSafeNumber(item.price) * toSafeNumber(item.quantity), 0);

      // COUPON VALIDATION (you already fixed this — keep it)
      if (coupon && typeof coupon === "string" && coupon.trim() !== "") {
        const couponCode = coupon.trim().toUpperCase();
        const couponDoc = await Coupon.findOne({
          code: couponCode,
          isActive: true,
          expiryDate: { $gte: new Date() }
        }).session(session);

        if (!couponDoc) {
          await session.abortTransaction();
          return res.status(400).json({ success: false, message: "Invalid or expired coupon" });
        }

        if (calculatedTotal < couponDoc.minPurchase) {
          await session.abortTransaction();
          return res.status(400).json({ success: false, message: `Minimum purchase ₹${couponDoc.minPurchase} required` });
        }

        const discountValue = toSafeNumber(couponDoc.discount);
        if (couponDoc.type === "flat") {
          appliedDiscount = discountValue;
        } else {
          appliedDiscount = (calculatedTotal * discountValue) / 100;
          if (couponDoc.maxDiscount) appliedDiscount = Math.min(appliedDiscount, couponDoc.maxDiscount);
        }
      }

      finalAmount = Math.max(1, calculatedTotal - appliedDiscount);

      // CLIENT-SERVER AMOUNT CHECK
      if (Math.abs(finalAmount - toSafeNumber(clientTotalAmount)) > 1) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Amount mismatch. Please refresh and try again." });
      }

      // CRITICAL: CHECK STOCK BEFORE CREATING RAZORPAY ORDER
      for (let item of cart.items) {
        const product = item.productId;
        const size = item.size;
        const qty = item.quantity;

        const hasStock = await Product.findOne({
          _id: product._id,
          [`sizes.${size}`]: { $gte: qty },
          quantity: { $gte: qty },
          isBlocked: false
        }).session(session);

        if (!hasStock) {
          await session.abortTransaction();
          return res.json({
            success: false,
            message: `Not enough stock for ${product.productName} (Size: ${size})`
          });
        }
      }

      // All good → create temp order
      const customOrderId = `ORD${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${Math.floor(1000 + Math.random() * 9000)}`;

      const orderItems = cart.items.map(item => ({
        product: item.productId._id,
        size: item.size,
        quantity: item.quantity,
        price: toSafeNumber(item.price),
        status: "Pending"
      }));

      const selectedAddress = addressDoc.address.find(a => a._id.toString() === addressId);

      orderToUse = await Order.create([{
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
        couponApplied: appliedDiscount > 0,
        coupon: coupon || null,
        isTemp: true
      }], { session })[0];
    }

    // Create Razorpay order
    const amountInPaise = Math.round(finalAmount * 100);
    if (amountInPaise < 100) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Order amount too low" });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_${orderToUse._id}`
    });

    orderToUse.razorpayOrderId = razorpayOrder.id;
    await orderToUse.save({ session });

    await session.commitTransaction();

    return res.json({
      success: true,
      orderId: razorpayOrder.id,
      mongoOrderId: orderToUse._id.toString(),
      displayOrderId: orderToUse.orderId,
      amount: razorpayOrder.amount,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Create Order Error:", error);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  } finally {
    session.endSession();
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