const Order = require('../../models/orderSchema');
const mongoose = require('mongoose');
const User = require('../../models/userSchema');
const WalletTransaction = require('../../models/walletSchema')




const getUserOrders = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        if (!userId) {
            return res.redirect('/signin');
        }

        

        const orders = await Order.find({ userId })
            .populate({
                path: 'orderItems.product',
                select: 'productName productImage price' 
            })
            .sort({ createdOn: -1 });

        const formattedOrders = orders.map(order => {
            return {
                _id: order._id,
                orderId: order.orderId,
                createdOn: order.createdOn,
                totalAmount: order.totalAmount,
                status: order.status,
                paymentStatus: order.paymentStatus,
                items: order.orderItems.map(item => ({
                    name: item.product?.productName || 'Product Unavailable',
                    image: item.product?.productImage?.[0] || '/images/default-product.jpg',
                    quantity: item.quantity,
                    price: item.price,
                    size: item.size,
                    status: item.status
                }))
            };
        });


        res.render('myorders', { 
            orders: formattedOrders,
            error: false,
            user: req.session.user
        });

    } catch (error) {
        console.error("Error fetching user orders:", error);
        res.render('myorders', { 
            orders: [],
            error: true,
            user: req.session.user
        });
    }
};


// routes/order.js or controllers/orderController.js
// controllers/user/orderController.js

const viewOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;

        const order = await Order.findById(orderId)
            .populate({
                path: 'orderItems.product',
                select: 'productName productImage price sizes quantity'
            });

        if (!order) {
            req.flash('error', 'Order not found');
            return res.redirect('/orders');
        }

        if (order.userId.toString() !== req.session.user.id.toString()) {
            req.flash('error', 'Access denied');
            return res.redirect('/orders');
        }

        // Correct flag: true only when Online Payment + not paid + temporary order
        const paymentPending = order.paymentMethod === 'Online Payment' &&
                               order.paymentStatus !== 'Paid' &&
                               order.isTemp === true;

        res.render('orderfulldetails', {
            order,
            paymentPending,        // ← Pass this single flag
            pageTitle: `Order #${order.orderId}`
        });

    } catch (err) {
        console.error('Error loading order details:', err);
        req.flash('error', 'Something went wrong');
        res.redirect('/orders');
    }
};


const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).send('Order not found');

    if (!['Pending', 'Processing'].includes(order.status))
      return res.status(400).send('Cannot cancel order at this stage');

    const refundAmount = order.totalAmount;

    
    if (['Online Payment', 'Wallet Payment'].includes(order.paymentMethod)) {
      const user = await User.findById(order.userId);
      user.wallet = (user.wallet || 0) + refundAmount;
      await user.save();

      await WalletTransaction.create({
        userId: user._id,
        type: 'Credit',
        amount: refundAmount,
        description: `Full refund for cancelled Order #${order.orderId}`,
        orderId: order._id,
      });
    }

    
    order.orderItems.forEach(item => {
      item.status = 'Cancelled';
    });

    order.status = 'Cancelled';
    
    await order.save();

    req.flash?.('success', 'Order fully cancelled and refunded.');
    return res.redirect(`/order-details/${orderId}`);

  } catch (err) {
    console.error('Error cancelling order:', err);
    return res.status(500).send('Server Error');
  }
};



const cancelItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).send('Order not found');


    if (order.userId.toString() !== req.session.user.id.toString())
      return res.status(403).send('Unauthorized');

    if (!['Pending', 'Processing'].includes(order.status))
      return res.status(400).send('Order cannot be cancelled at this stage');

    const item = order.orderItems.id(itemId);
    if (!item) return res.status(404).send('Item not found');

    if (item.status === 'Cancelled')
      return res.status(400).send('Item already cancelled');

    const refundAmount = item.price * item.quantity;

    if (['Online Payment', 'Wallet Payment'].includes(order.paymentMethod)) {
      const user = await User.findById(order.userId);
      user.wallet = (user.wallet || 0) + refundAmount;
      await user.save();

      await WalletTransaction.create({
        userId: user._id,
        type: 'Credit',
        amount: refundAmount,
        description: `Refund for cancelled item in Order #${order.orderId}`,
        orderId: order._id,
      });
    }

    order.totalAmount -= refundAmount;
    item.status = 'Cancelled';

    const allCancelled = order.orderItems.every(i => i.status === 'Cancelled');
    if (allCancelled) {
      order.status = 'Cancelled';
    }

    await order.save();

    req.flash?.('success', `Item cancelled. ₹${refundAmount} refunded.`);
    return res.redirect(`/order-details/${orderId}`);

  } catch (err) {
    console.error('Error cancelling item:', err);
    return res.status(500).send('Server Error');
  }
};



const submitReturnRequest = async (req, res) => {
  try {
    const { orderId, itemId, returnReason } = req.body;
    console.log("Request body:", req.body);

    if (!returnReason || returnReason.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Return reason is required and cannot be empty",
      });
    }

    const order = await Order.findById(orderId).populate("orderItems.product", "productName");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order Not Found",
      });
    }

    if (order.userId.toString() !== req.session.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const orderItem = order.orderItems.find(
      (item) => item._id.toString() === itemId
    );

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: "Order item not found",
      });
    }

    orderItem.returnRequest = true;
    orderItem.returnStatus = "Pending";
    orderItem.returnReason = returnReason.trim();
    orderItem.returnRequestDate = new Date();

    await order.save();

    const io = req.app.get("io");
    const notification = {
      orderId: order.orderId,
      itemId: orderItem._id.toString(),
      productName: orderItem.product?.productName || "Deleted",
      userName: req.session.user.name || "Unknown User",
      userEmail: req.session.user.email || "N/A",
      returnReason: returnReason.trim(),
      returnStatus: "Pending",
      timestamp: new Date().toISOString(),
    };
    console.log("Emitting returnNotification:", notification);
    io.emit("returnNotification", notification);

    res.json({
      success: true,
      message: "Return request submitted successfully",
    });
  } catch (error) {
    console.error("Return request error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};



const returnItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;               
    const { returnReason } = req.body;                    

    if (!returnReason?.trim()) {
      return res.status(400).json({ success: false, message: "Return reason is required" });
    }

    const order = await Order.findById(orderId).populate("orderItems.product", "productName");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  
    if (order.userId.toString() !== req.session.user.id.toString())
      return res.status(403).json({ success: false, message: "Unauthorized" });

    
    if (order.status !== "Delivered")
      return res.status(400).json({ success: false, message: "Only delivered orders can be returned" });

    const item = order.orderItems.id(itemId);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    
    if (item.returnRequest)
      return res.status(400).json({ success: false, message: "Return already requested for this item" });

    
    item.returnRequest = true;
    item.returnStatus   = "Pending";
    item.returnReason   = returnReason.trim();
    item.returnRequestDate = new Date();
    await order.save();

    
    const io = req.app.get("io");
    const notification = {
      orderId: order.orderId,
      itemId: item._id.toString(),
      productName: item.product?.productName || "Deleted",
      userName: req.session.user.name || "Unknown User",
      userEmail: req.session.user.email || "N/A",
      returnReason: returnReason.trim(),
      returnStatus: "Pending",
      timestamp: new Date().toISOString(),
    };
    io.emit("returnNotification", notification);

    res.json({ success: true, message: "Return request submitted successfully" });

  } catch (err) {
    console.error("Error submitting item return:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
    getUserOrders,
    viewOrderDetails,
    cancelOrder,
    cancelItem,
    submitReturnRequest,
    returnItem
}