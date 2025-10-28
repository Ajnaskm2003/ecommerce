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

    const order = await Order.findOne({ orderId })
      .populate("orderItems.product", "productName") 
      .populate("userId");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const doc = new PDFDocument({ margin: 40 });

    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${order.orderId}.pdf`
    );

    doc.pipe(res);

    
    doc.fontSize(22).fillColor("#333").text("INVOICE", { align: "center" });
    doc.moveDown(1);

    
    doc.fontSize(10).fillColor("#555").text("Your Store Pvt Ltd", { align: "right" });
    doc.text("123 Business Street, Kochi, Kerala", { align: "right" });
    doc.text("Phone: +91 9876543210", { align: "right" });
    doc.text("Email: support@yourstore.com", { align: "right" });
    doc.moveDown(2);

    
    doc.fontSize(12).fillColor("#000").text(`Order ID: ${order.orderId}`);
    doc.text(`Order Date: ${new Date(order.createdOn).toLocaleDateString()}`);
    doc.text(`Payment Method: ${order.paymentMethod}`);
    doc.text(`Order Status: ${order.status}`).moveDown(1);

    
    doc.fontSize(12).text("Bill To:", { underline: true });
    doc.text(order.address?.fullname || "N/A");
    doc.text(order.address?.street || "");
    doc.text(`${order.address?.city || ""}, ${order.address?.state || ""}`);
    doc.text(`Pincode: ${order.address?.zipCode || ""}`);
    doc.text(`Phone: ${order.address?.phone || "N/A"}`);
    doc.moveDown(2);

    
    const tableTop = doc.y;
    const itemX = 50;
    const qtyX = 300;
    const priceX = 370;
    const totalX = 460;

    doc.fontSize(12).fillColor("#fff");
    doc.rect(itemX, tableTop, 500, 20).fill("#007BFF").stroke();
    doc.fillColor("#fff").text("Product", itemX + 5, tableTop + 5);
    doc.text("Qty", qtyX, tableTop + 5);
    doc.text("Price", priceX, tableTop + 5);
    doc.text("Subtotal", totalX, tableTop + 5);

    doc.moveDown(1.5);

    
    doc.fillColor("#000");

    
    order.orderItems.forEach((item, i) => {
      const y = tableTop + 25 + i * 25;
      const productName = item.product?.productName || "Deleted"; 

      doc.text(`${productName} (Size: ${item.size || "N/A"})`, itemX + 5, y);
      doc.text(item.quantity.toString(), qtyX, y);
      doc.text(`₹${item.price.toFixed(2)}`, priceX, y);
      doc.text(`₹${(item.quantity * item.price).toFixed(2)}`, totalX, y);

      // Row Line
      doc.moveTo(itemX, y + 18).lineTo(itemX + 500, y + 18).strokeColor("#ddd").stroke();
    });

   
    const totalY = tableTop + 25 + order.orderItems.length * 25 + 20;

    doc.fontSize(12).fillColor("#000").text("Total Amount:", totalX - 80, totalY, {
      align: "right",
    });
    doc.fontSize(14).fillColor("#007BFF").text(`₹${order.totalAmount.toFixed(2)}`, totalX, totalY);

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