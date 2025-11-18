const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const PDFDocument = require("pdfkit");
const mongoose = require("mongoose");
const Coupon = require('../../models/coupenSchema');
const { v4: uuidv4 } = require('uuid');

const getCheckoutPage = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect("/signin");
    }

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");

    const userId = req.session.user.id;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || !cart.items.length) {
      return res.redirect("/cart");
    }

    const userAddressDoc = await Address.findOne({ userId });

    let cartItems = [];
    let totalAmount = 0;
    let userAddresses = userAddressDoc ? userAddressDoc.address : [];

    if (cart && cart.items.length > 0) {
      cartItems = cart.items.map((item) => ({
        productId: item.productId._id,
        productName: item.productId.productName,
        size: item.size,
        quantity: item.quantity,
        price: item.price,
        image:
          item.productId.productImage.length > 0
            ? item.productId.productImage[0]
            : "/default-image.jpg",
        totalPrice: item.quantity * item.price,
      }));

      totalAmount = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
    }

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

    if (!addressId || !payment) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Select an address and payment method",
        });
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || !cart.items.length) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const order = new Order({
      userId,
      items: cart.items.map((item) => ({
        productId: item.productId._id,
        size: item.size,
        quantity: item.quantity,
        price: item.price,
      })),
      totalAmount:
        cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0) +
        5,
      shippingAddress: addressId,
      paymentMethod: payment,
      status: "Pending",
    });

    await order.save();
    await Cart.deleteOne({ userId });

    delete req.session.cartAccess;
    req.session.orderPlaced = true;

    res.json({ success: true, message: "Order placed successfully" });
  } catch (error) {
    console.error("Error in placeOrder:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const addAddress = async (req, res) => {
  try {
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to add address",
      });
    }

    const {
      fullname,
      phone,
      street,
      city,
      landmark = "",
      state,
      zipCode,
    } = req.body;

    if (!fullname || !phone || !street || !city || !state || !zipCode) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields",
      });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit phone number",
      });
    }

    if (!/^\d{6}$/.test(zipCode)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 6-digit zip code",
      });
    }

    let addressDoc = await Address.findOne({ userId });

    if (addressDoc) {
      addressDoc.address.push({
        fullname,
        phone,
        street,
        city,
        landmark,
        state,
        zipCode: Number(zipCode),
      });
    } else {
      addressDoc = new Address({
        userId,
        address: [
          {
            fullname,
            phone,
            street,
            city,
            landmark,
            state,
            zipCode: Number(zipCode),
          },
        ],
      });
    }

    await addressDoc.save();

    return res.status(200).json({
      success: true,
      message: "Address added successfully",
    });
  } catch (error) {
    console.error("Error adding address:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add address",
      error: error.message,
    });
  }
};



const placedOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod, coupon, totalAmount, discount } = req.body;
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    
    if (paymentMethod === "Wallet Payment") {
      const user = await User.findById(userId);
      if (!user || user.wallet < totalAmount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient wallet balance. Available: ₹${user?.wallet || 0}`,
        });
      }
      user.wallet -= totalAmount;
      await user.save();
    }

    
    const addressDoc = await Address.findOne({ userId, "address._id": addressId });
    if (!addressDoc) {
      return res.status(400).json({ success: false, message: "Address not found" });
    }

    const selectedAddress = addressDoc.address.find(addr => addr._id.toString() === addressId);
    if (!selectedAddress) {
      return res.status(400).json({ success: false, message: "Selected address not found" });
    }

    
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const validSizes = ["6", "7", "8", "9"];
    const orderItems = [];
    let cartSubtotal = 0;

  
    for (let item of cart.items) {
      const product = item.productId;
      const selectedSize = item.size;
      const orderedQty = item.quantity;

      
      if (!validSizes.includes(selectedSize)) {
        return res.status(400).json({
          success: false,
          message: `Invalid size ${selectedSize} for ${product.productName}`,
        });
      }

      
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: product._id,
          [`sizes.${selectedSize}`]: { $gte: orderedQty },
          quantity: { $gte: orderedQty },
          isBlocked: false
        },
        {
          $inc: {
            [`sizes.${selectedSize}`]: -orderedQty,
            quantity: -orderedQty
          }
        },
        { new: true }
      );

      
      if (!updatedProduct) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock for size ${selectedSize} of ${product.productName}. Please refresh your cart.`,
        });
      }

      
      const totalSizeStock = Object.values(updatedProduct.sizes).reduce(
        (sum, qty) => sum + (qty || 0), 0
      );

      if (updatedProduct.quantity !== totalSizeStock) {
        updatedProduct.quantity = totalSizeStock;
        await updatedProduct.save();
      }

      
      orderItems.push({
        product: product._id,
        size: selectedSize,
        quantity: orderedQty,
        price: item.price,
      });

      cartSubtotal += orderedQty * item.price;
    }

    
    const discountAmount = discount || 0;
    const finalTotal = cartSubtotal - discountAmount;

    
    const newOrder = new Order({
      userId,
      orderItems,
      totalPrice: cartSubtotal,
      discount: discountAmount,
      totalAmount: finalTotal,
      paymentMethod,
      ...(paymentMethod === "Wallet Payment" && { walletTransactionId: uuidv4() }),
      address: {
        fullname: selectedAddress.fullname,
        phone: selectedAddress.phone,
        street: selectedAddress.street,
        city: selectedAddress.city,
        landmark: selectedAddress.landmark || "",
        state: selectedAddress.state,
        zipCode: selectedAddress.zipCode,
      },
      status: "Pending",
      couponApplied: !!coupon,
      coupon: coupon || null,
    });

    await newOrder.save();

    
    cart.items = [];
    await cart.save();

    
    req.session.orderPlaced = true;
    delete req.session.cartAccess;

  
    const response = {
      success: true,
      orderId: newOrder._id,
      message: "Order placed successfully",
    };

    if (paymentMethod === "Wallet Payment") {
      const updatedUser = await User.findById(userId);
      response.walletBalance = updatedUser.wallet;
    }

    res.json(response);

  } catch (error) {
    console.error("Order placement error:", error);
    res.status(500).json({
      success: false,
      message: "Order placement failed",
      error: error.message,
    });
  }
};




const viewOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    console.log("Looking for order:", orderId);

    const order = await Order.findById(orderId)
      .populate({
        path: "orderItems.product",
        select: "productName productImage price",
      })
      .populate("userId", "name email");

    if (!order) {
      console.log("Order not found for ID:", orderId);
      return res.render("orderdetails", {
        order: null,
        error: "Order not found",
      });
    }

    const formattedOrder = {
      orderId: order._id,
      status: order.status,
      createdOn: order.createdOn,
      address: order.address,
      paymentMethod: order.paymentMethod,
      totalAmount: order.totalAmount,
      orderItems: order.orderItems.map((item) => ({
        product: {
          name: item.product?.productName || "Product Unavailable",
          image: item.product?.productImage?.[0] || "/default-product.jpg",
        },
        size: item.size,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.quantity * item.price,
      })),
    };

    console.log("Formatted Order:", formattedOrder);

    res.render("orderdetails", {
      order: formattedOrder,
      error: null,
    });
  } catch (error) {
    console.error("Error in viewOrder:", error);
    res.render("orderdetails", {
      order: null,
      error: "Error loading order details",
    });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    console.log("Requested orderId:", orderId);

    const order = await Order.findOne({ orderId })
      .populate("orderItems.product")
      .populate("userId");

    if (!order) {
      console.log("Order not found for orderId:", orderId);

      const orders = await Order.find({}, { orderId: 1, createdOn: 1 })
        .sort({ createdOn: -1 })
        .limit(10);
      const orderIds = orders.map((o) => ({
        orderId: o.orderId,
        createdOn: o.createdOn.toISOString(),
      }));
      console.log("Recent orderIds in database:", orderIds);

      const response = { error: "Order not found" };
      if (process.env.NODE_ENV === "development") {
        response.recentOrderIds = orderIds;
      }
      return res.status(404).json(response);
    }

    const doc = new PDFDocument();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${order.orderId}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(20).text("Invoice", { align: "center" }).moveDown();

    doc.fontSize(12).text(`Order ID: ${order.orderId}`);
    doc.text(`Order Date: ${new Date(order.createdOn).toLocaleDateString()}`);
    doc.text(`Customer: ${order.address?.fullname || "N/A"}`);
    doc.text(
      `Address: ${order.address?.street || ""}, ${order.address?.city || ""}, ${
        order.address?.state || ""
      } - ${order.address?.zipCode || ""}`
    );
    doc.text(`Phone: ${order.address?.phone || "N/A"}`);
    doc.text(`Payment Method: ${order.paymentMethod || "N/A"}`);
    doc.text(`Order Status: ${order.status || "N/A"}`).moveDown();

    doc.fontSize(14).text("Products", { underline: true }).moveDown();

    order.orderItems.forEach((item, index) => {
      const productName =
        item.product?.name || item.product?.productName || "Unknown Product";
      doc
        .fontSize(12)
        .text(`${index + 1}. ${productName} (Size: ${item.size || "N/A"})`);
      doc.text(`   Quantity: ${item.quantity || 0}`);
      doc.text(`   Price: ₹${item.price?.toFixed(2) || "0.00"}`);
      doc
        .text(`   Subtotal: ₹${(item.quantity * (item.price || 0)).toFixed(2)}`)
        .moveDown();
    });

    doc
      .fontSize(14)
      .text(`Total Amount: ₹${order.totalAmount?.toFixed(2) || "0.00"}`, {
        align: "right",
      });

    doc.end();
  } catch (error) {
    console.error("Invoice download error:", error);
    res
      .status(500)
      .json({ error: "Failed to download invoice", details: error.message });
  }
};

const getAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user?.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    const addressDoc = await Address.findOne({
      userId,
      "address._id": id,
    });

    if (!addressDoc) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const address = addressDoc.address.find(
      (addr) => addr._id.toString() === id
    );

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    return res.json({
      success: true,
      address: address,
    });
  } catch (error) {
    console.error("Error fetching address:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch address details",
    });
  }
};

const editAddress = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const addressId = req.params.id; 

    const { fullname, phone, street, city, landmark, state, zipCode } = req.body;

    if (!addressId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const addressDoc = await Address.findOne({
      userId,
      "address._id": addressId,
    });

    if (!addressDoc) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const addressIndex = addressDoc.address.findIndex(
      (addr) => addr._id.toString() === addressId
    );

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Address not found in the list",
      });
    }

    addressDoc.address[addressIndex] = {
      ...addressDoc.address[addressIndex].toObject(),
      fullname,
      phone,
      street,
      city,
      landmark,
      state,
      zipCode: Number(zipCode),
    };

    await addressDoc.save();

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
    });
  } catch (error) {
    console.error("Error updating address:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update address",
      error: error.message,
    });
  }
};

const getWalletBalance = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      balance: user.wallet || 0,
    });
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch wallet balance",
    });
  }
};



const getActiveCoupons = async (req, res)=>{
  try {
    
    const currentDate = new Date();

    const coupons = await Coupon.find({
      expiryDate: { $gte: currentDate },
    }).select("code discount type minPurchase maxDiscount");

    res.json({
      success: true,
      coupons
    })

  } catch (error) {
    console.error("error fetching coupons" , error);
    res.status(500).json({
      success:false,
      message:"fialed to load coupons"
    })
  }
};

module.exports = {
  placeOrder,
  getCheckoutPage,
  addAddress,
  placedOrder,
  viewOrder,
  getAddress,
  editAddress,
  getWalletBalance,
  getActiveCoupons
};
