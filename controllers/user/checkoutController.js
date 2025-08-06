const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const PDFDocument = require('pdfkit');




const getCheckoutPage = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect("/signin"); 
        }

        const userId = req.session.user.id;

       
        const cart = await Cart.findOne({ userId }).populate("items.productId");

       
        const userAddressDoc = await Address.findOne({ userId });

        let cartItems = [];
        let totalAmount = 0;
        let userAddresses = userAddressDoc ? userAddressDoc.address : [];

        console.log("userAddress",userAddresses);
        

        console.log("User Addressesssssss:", userAddresses);
        console.log("Cart Data:", cart);


        if (cart && cart.items.length > 0) {
            cartItems = cart.items.map(item => ({
                productId: item.productId._id, 
                productName: item.productId.productName, 
                size: item.size,
                quantity: item.quantity,
                price: item.price,  
                image: item.productId.productImage.length > 0 ? item.productId.productImage[0] : "/default-image.jpg", 
                totalPrice: item.quantity * item.price,
                
            }));
            
            totalAmount = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
        }

        console.log("carttttttttttttt",cartItems);
        

        res.render("checkout", {
            cartItems,
            userAddresses,
            totalAmount,
            
        });
    } catch (error) {
        console.error("Error in getCheckoutPage:", error);
        res.status(500).send("Server error");
    }
};





const placeOrder = async (req, res) => {
    try {
        const { addressId, payment } = req.body;
        const userId = req.session.user.id;

        if (!addressId || !payment) return res.status(400).json({ success: false, message: "Select an address and payment method" });

        const cartItems = await Cart.find({ userId });

        const order = new Order({
            userId,
            items: cartItems.map(item => ({
                productId: item.productId,
                size: item.size,
                quantity: item.quantity,
                price: item.productId.price
            })),
            totalAmount: cartItems.reduce((sum, item) => sum + item.productId.price * item.quantity, 0) + 5,
            shippingAddress: addressId,
            paymentMethod: payment,
            status: "Pending"
        });

        await order.save();
        await Cart.deleteMany({ userId });

        res.json({ success: true, message: "Order placed successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};




const addAddress = async (req, res) => {
    try {
        const userId = req.session.user.id;

        console.log(userId);
        

        const { fullname, phone, street, city, landmark, state, zipCode } = req.body;

        const errors = {};
        if (!fullname || fullname.trim() === '') errors.fullname = "Full name is required.";
        if (!phone || phone.trim() === '') errors.phone = "Phone number is required.";
        if (!street || street.trim() === '') errors.street = "Street is required.";
        if (!city || city.trim() === '') errors.city = "City is required.";
        if (!landmark || landmark.trim() === '') errors.landmark = "Landmark is required.";
        if (!state || state.trim() === '') errors.state = "State is required.";
        if (!zipCode || zipCode.trim() === '') errors.zipCode = "Zip Code is required.";

       
        if (Object.keys(errors).length > 0) {
            return res.json({ success: false, errors });
        }

        const newAddressObj = {
            fullname,
            phone,
            street,
            city,
            landmark,
            state,
            zipCode,
        };

        let userAddress = await Address.findOne({ userId });

        console.log("userAddress",userAddress);
        

        if (userAddress) {
            await Address.updateOne(
                { userId },
                { $push: { address: { $each: [newAddressObj], $position: 0 } } }
            );
        } else {
            await Address.create({
                userId,
                address: [newAddressObj],
            });
        }

        
        userAddress = await Address.findOne({ userId });
        const updatedAddresses = userAddress.address;

        console.log("haiiiiiiiiiiiiiiiiii",updatedAddresses);
        

        return res.json({ success: true, addresses: updatedAddresses });

    } catch (error) {
        console.error("Error adding address:", error);
        return res.json({ success: false, message: "Internal server error" });
    }
};


const placedOrder = async (req, res) => {
    try {
        const { addressId, paymentMethod, coupon, totalAmount, discount } = req.body;
        const userId = req.session.user.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        // If wallet payment, check user and wallet balance
        if (paymentMethod === 'Wallet Payment') {
            const user = await User.findById(userId);
            if (!user) {
                return res.status(400).json({ 
                    success: false, 
                    message: "User not found" 
                });
            }

            if (typeof user.wallet !== 'number' || isNaN(user.wallet)) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Invalid wallet balance" 
                });
            }

            if (user.wallet < totalAmount) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Insufficient wallet balance. Your balance: ₹${user.wallet}, Order total: ₹${totalAmount}` 
                });
            }

            // Deduct from wallet
            user.wallet -= totalAmount;
            await user.save();
        }

        
        const addressDoc = await Address.findOne({ userId: userId, "address._id": addressId });
        if (!addressDoc) {
            return res.status(400).json({ success: false, message: "Address not found" });
        }

        const selectedAddress = addressDoc.address.find(addr => addr._id.toString() === addressId);
        if (!selectedAddress) {
            return res.status(400).json({ success: false, message: "Address not found inside array" });
        }

        const cart = await Cart.findOne({ userId: userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        const placedOrders = [];
        const cartTotal = cart.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        const discountPerRupee = discount ? discount / cartTotal : 0;

        for (let item of cart.items) {
            const product = item.productId;
            const selectedSize = item.size;
            const orderedQty = item.quantity;

            if (product.sizes[selectedSize] < orderedQty) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough stock for size ${selectedSize} of product ${product.productName}`
                });
            }

            product.sizes[selectedSize] -= orderedQty;
            product.quantity -= orderedQty;
            await product.save();

            const itemTotal = item.quantity * item.price;
            const itemDiscount = Math.round(itemTotal * discountPerRupee * 100) / 100;
            const finalAmount = itemTotal - itemDiscount;

            const newOrder = new Order({
                userId,
                orderItems: [{
                    product: item.productId._id,
                    size: item.size,
                    quantity: item.quantity,
                    price: item.price
                }],
                totalPrice: itemTotal,           
                discount: itemDiscount,          
                totalAmount: finalAmount,        
                paymentMethod,
                
                ...(paymentMethod === 'Wallet Payment' && { 
                    walletTransactionId: uuidv4() 
                }),
                address: {
                    fullname: selectedAddress.fullname,
                    street: selectedAddress.street,
                    city: selectedAddress.city,
                    state: selectedAddress.state,
                    zipCode: selectedAddress.zipCode,
                    phone: selectedAddress.phone
                },
                status: "Pending",
                couponApplied: !!coupon
            });

            await newOrder.save();
            placedOrders.push(newOrder);
        }

        cart.items = [];
        await cart.save();
        req.session.orderPlaced = true;
        delete req.session.cartAccess;

        res.json({ 
            success: true, 
            orders: placedOrders.map(order => order._id),
            message: "Orders placed successfully",
            
            ...(paymentMethod === 'Wallet Payment' && {
                walletBalance: (await Wallet.findOne({ userId })).balance
            })
        });

    } catch (error) {
        console.error("Order placement error:", error);
        res.status(500).json({ success: false, message: "Order placement failed" });
    }
};





const viewOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        console.log('Looking for order:', orderId);

        // Change the query to look for _id instead of orderId
        const order = await Order.findById(orderId)
            .populate({
                path: 'orderItems.product',
                select: 'productName productImage price'
            })
            .populate('userId', 'name email');

        if (!order) {
            console.log('Order not found for ID:', orderId);
            return res.render('orderdetails', { 
                order: null,
                error: 'Order not found'
            });
        }

        const formattedOrder = {
            orderId: order._id,
            status: order.status,
            createdOn: order.createdOn,
            address: order.address,
            paymentMethod: order.paymentMethod,
            totalAmount: order.totalAmount,
            orderItems: order.orderItems.map(item => ({
                product: {
                    name: item.product?.productName || 'Product Unavailable',
                    image: item.product?.productImage?.[0] || '/default-product.jpg'
                },
                size: item.size,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.quantity * item.price
            }))
        };

        console.log('Formatted Order:', formattedOrder);

        res.render('orderdetails', {
            order: formattedOrder,
            error: null
        });

    } catch (error) {
        console.error('Error in viewOrder:', error);
        res.render('orderdetails', {
            order: null,
            error: 'Error loading order details'
        });
    }
};

const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params; // Extract orderId from params

    // Validate orderId
    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    // Log the requested orderId for debugging
    console.log("Requested orderId:", orderId);

    // Query the order
    const order = await Order.findOne({ orderId })
      .populate('orderItems.product')
      .populate('userId');

    // Check if order exists
    if (!order) {
      console.log("Order not found for orderId:", orderId);
      // Log all orderIds for debugging
      const orders = await Order.find({}, { orderId: 1, createdOn: 1 }).sort({ createdOn: -1 }).limit(10);
      const orderIds = orders.map(o => ({
        orderId: o.orderId,
        createdOn: o.createdOn.toISOString()
      }));
      console.log("Recent orderIds in database:", orderIds);
      // Include recent orderIds in response only in development mode
      const response = { error: "Order not found" };
      if (process.env.NODE_ENV === 'development') {
        response.recentOrderIds = orderIds;
      }
      return res.status(404).json(response);
    }

    // Initialize PDF document
    const doc = new PDFDocument();

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add invoice content
    doc.fontSize(20).text('Invoice', { align: 'center' }).moveDown();

    doc.fontSize(12).text(`Order ID: ${order.orderId}`);
    doc.text(`Order Date: ${new Date(order.createdOn).toLocaleDateString()}`);
    doc.text(`Customer: ${order.address?.fullname || 'N/A'}`);
    doc.text(`Address: ${order.address?.street || ''}, ${order.address?.city || ''}, ${order.address?.state || ''} - ${order.address?.zipCode || ''}`);
    doc.text(`Phone: ${order.address?.phone || 'N/A'}`);
    doc.text(`Payment Method: ${order.paymentMethod || 'N/A'}`);
    doc.text(`Order Status: ${order.status || 'N/A'}`).moveDown();

    doc.fontSize(14).text('Products', { underline: true }).moveDown();

    // Iterate over order items
    order.orderItems.forEach((item, index) => {
      const productName = item.product?.name || item.product?.productName || 'Unknown Product';
      doc.fontSize(12).text(`${index + 1}. ${productName} (Size: ${item.size || 'N/A'})`);
      doc.text(`   Quantity: ${item.quantity || 0}`);
      doc.text(`   Price: ₹${item.price?.toFixed(2) || '0.00'}`);
      doc.text(`   Subtotal: ₹${(item.quantity * (item.price || 0)).toFixed(2)}`).moveDown();
    });

    doc.fontSize(14).text(`Total Amount: ₹${order.totalAmount?.toFixed(2) || '0.00'}`, { align: 'right' });

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error("Invoice download error:", error);
    res.status(500).json({ error: "Failed to download invoice", details: error.message });
  }
};


module.exports = {
    placeOrder,
    getCheckoutPage,
    addAddress,
    placedOrder,
    viewOrder,
    
}