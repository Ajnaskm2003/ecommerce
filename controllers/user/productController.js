const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');
const PDFDocument = require('pdfkit');


const getAllProducts = async (req, res) => {
    try {
        
        

        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9;
        const skip = (page - 1) * limit;

        
        const minPrice = parseFloat(req.query.gt) || 0;
        const maxPrice = parseFloat(req.query.lt) || 1000000;

        
        const categoryFilter = req.query.category ? { category: req.query.category } : {};

        
        const searchQuery = req.query.search ? 
            { productName: { $regex: req.query.search, $options: 'i' } } : 
            {};

    
        const sortOptions = {
            'newest': { createdOn: -1 },
            'price-asc': { salePrice: 1 },
            'price-desc': { salePrice: -1 },
            'name-asc': { productName: 1 },
            'name-desc': { productName: -1 }
        };
        const sortBy = req.query.sort || 'newest';
        const sortCriteria = sortOptions[sortBy] || sortOptions['newest'];

        
        const categories = await Category.find({isListed: true});
        const categoryIds = categories.map((category)=>category._id.toString());

        
        const query = {
            isBlocked: false,
            quantity: { $gt: 0 },
            salePrice: { $gte: minPrice, $lte: maxPrice },
            ...categoryFilter,
            ...searchQuery
        };

    
        const products = await Product.find(query)
            .sort(sortCriteria)
            .skip(skip)
            .limit(limit);

        
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        
        const categoriesWithIds = categories.map(category => ({
            _id: category._id,
            name: category.name
        }));
        console.log('render');
        
        res.render("Shop", { 
            products: products,
            category: categoriesWithIds,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: totalPages,
            currentMinPrice: minPrice,
            currentMaxPrice: maxPrice,
            currentCategory: req.query.category || null,
            currentSearch: req.query.search || '',
            currentSort: sortBy
        });
        
    } catch (error) {
        console.error("Error fetching products:", error);
        req.flash("error", "Something went wrong!");
        res.redirect("/page-404"); 
    }
};


const getProductDetails = async (req, res) => {
    try {
        const productId = req.query.id; 

        
        if (!productId) {
            return res.status(400).send('Product ID is required');
        }

        
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.redirect('/pageNotFound')
        }

        
        const product = await Product.findById(productId).populate('category');

        
        if (!product) {
            return res.status(404).send('Product not found');
        }

        res.render('ProductDetails', { product });

    } catch (error) {
        
        console.error('Error fetching product details:', error);
        res.status(500).send('Server error occurred while fetching product details');
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
      .populate('orderItems.product')
      .populate('userId');

    // Check if order exists
    if (!order) {
      console.log("Order not found for orderId:", orderId);
      // Log recent orderIds for debugging
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

    // Set response headers for PDF download
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
    getAllProducts,
    getProductDetails,
    downloadInvoice
};