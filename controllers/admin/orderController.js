const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require('../../models/productSchema');
let returnRequests = [];

const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate({
                path: 'orderItems.product',
                select: 'productName productImage'
            })
            .populate('userId', 'name email')
            .sort({ createdOn: -1 });

        
        const formattedOrders = orders.map(order => {
            return {
                _id: order._id,
                orderId: order.orderId,
                status: order.status,
                createdOn: order.createdOn,
                totalAmount: order.totalAmount,
                orderItems: order.orderItems.map(item => ({
                    product: {
                        name: item.product ? item.product.productName : 'Product Unavailable',
                        image: item.product && item.product.productImage.length > 0 
                            ? item.product.productImage[0] 
                            : 'default.jpg'
                    },
                    quantity: item.quantity,
                    price: item.price
                }))
            };
        });

        res.render('orders', { 
            orders: formattedOrders,
            title: 'All Orders'
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Server Error');
    }
};


const getOrderDetails = async(req,res)=>{
    try {
        
        const orderId = req.params.orderId;
        const order = await Order.findOne({ orderId })
        .populate('userId','name email')
        .populate('orderItems.product','productName productImage');

        if(!order){
            return res.status(404).send('Order Not Found ');
        }


        res.render('orderDetailsAdmin',
            {order}
        )

    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).send('Server Error');
    }
}

const updateOrderStatus = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { status } = req.body;

        // Define valid statuses and their hierarchy
        const statusHierarchy = {
            Pending: 1,
            Processing: 2,
            Shipped: 3,
            Delivered: 4,
            Cancelled: 5,
            'Return Request': 6,
            Returned: 7
        };

        const validStatuses = Object.keys(statusHierarchy);

        // Validate the new status
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Find the order
        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Get the current and new status hierarchy values
        const currentStatusValue = statusHierarchy[order.status];
        const newStatusValue = statusHierarchy[status];

        // Prevent rollback for Processing, Shipped, or Delivered
        if (
            ['Processing', 'Shipped', 'Delivered'].includes(order.status) &&
            newStatusValue < currentStatusValue
        ) {
            return res.status(400).json({
                error: `Cannot change status from ${order.status} to ${status}. Rollback is not allowed.`
            });
        }

        // Update the order status
        order.status = status;
        await order.save();

        res.json({
            success: true,
            message: 'Order status updated successfully',
            status: order.status
        });

    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
};


const getReturnOrders = async (req, res) => {
  try {
    const returnOrders = await Order.find({
      "orderItems.returnRequest": true
    })
      .populate("orderItems.product", "productName")
      .populate("userId", "name email")
      .select("orderId orderItems userId")
      .sort({ "orderItems.returnRequestDate": -1 }); 
    console.log('Return Orders:', JSON.stringify(returnOrders, null, 2));

    res.render("returnorders", {
      returnOrders: returnOrders.map(order => ({
        ...order.toObject(),
        orderItems: order.orderItems
          .filter(item => item.returnRequest)
          .sort((a, b) => new Date(b.returnRequestDate) - new Date(a.returnRequestDate)) 
      }))
    });
  } catch (error) {
    console.error("Error fetching return orders:", error);
    res.status(500).send("Server Error");
  }
};




const acceptReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const order = await Order.findById(orderId).populate("orderItems.product", "productName");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const item = order.orderItems.find(item => item._id.toString() === itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Order item not found" });
    }

    item.returnStatus = 'Accepted';
    item.status = 'Returned';

    const allReturnedOrCancelled = order.orderItems.every(
      (i) => i.status === 'Returned' || i.status === 'Cancelled'
    );

    if (allReturnedOrCancelled) {
      order.status = 'Returned';
    }

    const user = await User.findById(order.userId);
    if (user) {
      user.wallet = (user.wallet || 0) + item.price * item.quantity;
      await user.save();
    } else {
      console.error("User not found for ID:", order.userId);
    }

    const product = await Product.findById(item.product);
    if (product) {
      product.sizes[item.size] = (product.sizes[item.size] || 0) + item.quantity;
      await product.save();
    } else {
      console.error("Product not found for ID:", item.product);
    }

    await order.save();

    const io = req.app.get("io");
    io.emit("returnStatusUpdate", {
      orderId: order.orderId,
      itemId: item._id.toString(),
      returnStatus: "Accepted",
      productName: item.product?.productName || "Deleted",
      returnReason: item.returnReason,
      userName: user?.name || "Unknown User",
      userEmail: user?.email || "N/A",
    });

    res.json({ success: true, message: "Return accepted and order updated successfully" });
  } catch (error) {
    console.error("Error accepting return:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};





const rejectReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const order = await Order.findById(orderId).populate("orderItems.product", "productName");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const item = order.orderItems.find(item => item._id.toString() === itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Order item not found" });
    }

    item.returnStatus = 'Rejected';
    await order.save();

    const io = req.app.get("io");
    io.emit("returnStatusUpdate", {
      orderId: order.orderId,
      itemId: item._id.toString(),
      returnStatus: "Rejected",
      productName: item.product?.productName || "Deleted",
      returnReason: item.returnReason,
      userName: order.userId.name || "Unknown User",
      userEmail: order.userId.email || "N/A",
    });

    res.json({ success: true, message: "Return rejected successfully" });
  } catch (error) {
    console.error("Error rejecting return:", error);
    res.status(500).json({ success: false, message: "Server error while rejecting return" });
  }
};




module.exports = {
    getAllOrders,
    getOrderDetails,
    updateOrderStatus,
    getReturnOrders,
    acceptReturn,
    rejectReturn,

}
