const Order = require('../../models/orderSchema');

const getUserOrders = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        if (!userId) {
            return res.redirect('/signin');
        }

        // Fetch orders with populated product details
        const orders = await Order.find({ userId })
            .populate({
                path: 'orderItems.product',
                select: 'productName productImage price' 
            })
            .sort({ createdOn: -1 });

        // Format orders for rendering
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

        console.log('Formatted Orders:', formattedOrders); // Debug log

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

const viewOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId).populate('orderItems.product') .exec();

        if (!order) {
            return res.status(404).send('Order not found');
        }

        
        if (order.userId.toString() !== req.session.user.id.toString()) {
            return res.status(403).send('Unauthorized');
        }

        res.render('orderfulldetails', { order });
    } catch (err) {
        console.error('Error loading order details:', err);
        res.status(500).send('Internal Server Error');
    }
};

const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).send('Order not found');
        }

    
        if (['Pending', 'Processing'].includes(order.status)) {
            order.status = 'Cancelled';
            await order.save();
            return res.redirect('/order-details/' + orderId);
        } else {
            return res.status(400).send('Order cannot be cancelled at this stage');
        }
    } catch (err) {
        console.error('Error cancelling order:', err);
        res.status(500).send('Internal Server Error');
    }
};


const submitReturnRequest = async (req, res) => {
    try {
        const { orderId, itemId, returnReason } = req.body;
        console.log(req.body)
        
        
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ 
                success: false,
                message: "Order Not Found" 
            });
        }

        
        if (order.userId.toString() !== req.session.user.id.toString()) {
            return res.status(403).json({ 
                success: false,
                message: "Unauthorized" 
            });
        }

        
        const orderItem = order.orderItems.find(item => item._id.toString() === itemId);
        
        if (!orderItem) {
            return res.status(404).json({ 
                success: false,
                message: "Order item not found" 
            });
        }

       
        orderItem.returnRequest = true;
        orderItem.returnReason = returnReason;
        orderItem.returnStatus = 'Pending';
        orderItem.returnRequestDate = new Date();

        await order.save();

        res.json({ 
            success: true,
            message: "Return request submitted successfully"
        });

    } catch (error) {
        console.error('Return request error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Something went wrong', 
            error: error.message 
        });
    }
};

module.exports = {
    getUserOrders,
    viewOrderDetails,
    cancelOrder,
    submitReturnRequest,
}