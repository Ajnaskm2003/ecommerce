const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');
const PDFDocument = require('pdfkit');


const getAllProducts = async (req, res) => {
    try {
        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 9;
        const skip  = (page - 1) * limit;

        const minPrice = parseFloat(req.query.gt) || 0;
        const maxPrice = parseFloat(req.query.lt) || 1000000;

        const searchQuery = req.query.search
            ? { productName: { $regex: req.query.search, $options: 'i' } }
            : {};

        const sortOptions = {
            newest:     { createdOn: -1 },
            'price-asc':{ salePrice: 1 },
            'price-desc':{ salePrice: -1 },
            'name-asc': { productName: 1 },
            'name-desc':{ productName: -1 }
        };
        const sortBy      = req.query.sort || 'newest';
        const sortCriteria = sortOptions[sortBy] || sortOptions.newest;

        const listedCategories = await Category.find({ isListed: true }).select('_id');
        const listedCategoryIds = listedCategories.map(c => c._id);

        const baseQuery = {
            isBlocked: false,
            quantity: { $gt: 0 },
            salePrice: { $gte: minPrice, $lte: maxPrice },
            ...searchQuery,
            category: { $in: listedCategoryIds }  
        };

        if (req.query.category) {
            const reqCat = req.query.category;
            if (listedCategoryIds.some(id => id.toString() === reqCat)) {
                baseQuery.category = reqCat;      
            } else {
                delete baseQuery.category;         
            }
        }

        const products = await Product.find(baseQuery)
            .sort(sortCriteria)
            .skip(skip)
            .limit(limit);

        const totalProducts = await Product.countDocuments(baseQuery);
        const totalPages    = Math.ceil(totalProducts / limit);

        const categoriesForView = await Category.find({ isListed: true })
            .select('_id name')
            .lean();

        res.render("Shop", {
            products,
            category: categoriesForView,
            totalProducts,
            currentPage: page,
            totalPages,
            currentMinPrice: minPrice,
            currentMaxPrice: maxPrice,
            currentCategory: req.query.category || null,
            currentSearch: req.query.search || '',
            currentSort: sortBy,
            user: req.session.user || null
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
            return res.redirect('/pageNotFound');
        }

        const product = await Product.findById(productId).populate('category');
        
        if (!product) {
            return res.status(404).send('Product not found');
        }

        
        if (product.isBlocked) {
            return res.status(404).render('pageNotFound', { 
                message: 'This product is currently unavailable', 
                user: req.session.user || null 
            });
            
        }

        const deals = await Product.find({ 
            isBlocked: false, 
            status: 'Available',
            _id: { $ne: productId } 
        })
        .sort({ createdOn: -1 })
        .limit(9)
        .populate('category');

        res.render('ProductDetails', { product, deals, user: req.session.user || null });

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

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${order.orderId}.pdf`
    );
    doc.pipe(res);

    
    doc.fontSize(24).fillColor("#2c3e50").text("INVOICE", { align: "center" });
    doc.moveDown(0.5);

    
    doc.fontSize(10).fillColor("#7f8c8d");
    const rightX = 400;
    doc.text("Your Store Pvt Ltd", rightX, 100);
    doc.text("123 Business Street", rightX, 115);
    doc.text("Kochi, Kerala", rightX, 130);
    doc.text("Phone: +91 9876543210", rightX, 145);
    doc.text("Email: support@yourstore.com", rightX, 160);
    doc.moveDown(3);

    
    doc.fontSize(11).fillColor("#000");
    doc.text(`Order ID: ${order.orderId}`, 50, doc.y);
    doc.text(`Date: ${new Date(order.createdOn).toLocaleDateString()}`, 50, doc.y + 15);
    doc.text(`Payment: ${order.paymentMethod}`, 50, doc.y + 30);
    doc.text(`Status: ${order.status}`, 50, doc.y + 45);
    doc.moveDown(2);


    doc.fontSize(12).text("Bill To:", { underline: true });
    doc.fontSize(11);
    doc.text(order.address?.fullname || "N/A");
    doc.text(order.address?.street || "");
    doc.text(`${order.address?.city || ""}, ${order.address?.state || ""}`);
    doc.text(`Pincode: ${order.address?.zipCode || ""}`);
    doc.text(`Phone: ${order.address?.phone || "N/A"}`);
    doc.moveDown(2);

    
    const tableTop = doc.y + 20;
    const rowHeight = 30;
    const col = {
      item: 50,
      qty: 320,
      price: 380,
      total: 470,
    };

    
    doc.fillColor("#ffffff").fontSize(12);
    doc.rect(col.item, tableTop, 500, 25).fill("#2980b9");
    doc.fillColor("#fff")
      .text("Item", col.item + 8, tableTop + 8)
      .text("Qty", col.qty + 5, tableTop + 8)
      .text("Price", col.price + 5, tableTop + 8)
      .text("Subtotal", col.total + 5, tableTop + 8);

    
    doc.fillColor("#000").fontSize(11);
    let y = tableTop + 30;

    order.orderItems.forEach((item) => {
      const productName = item.product?.productName || "Deleted Product";
      const line1 = `${productName}`;
      const line2 = item.size ? `(Size: ${item.size})` : "";

      doc.text(line1, col.item + 8, y);
      if (line2) doc.text(line2, col.item + 8, y + 12);

      doc.text(item.quantity.toString(), col.qty + 5, y + 6, { width: 50, align: "center" });
      doc.text(`₹${item.price.toFixed(2)}`, col.price + 5, y + 6, { width: 60, align: "right" });
      doc.text(`₹${(item.quantity * item.price).toFixed(2)}`, col.total + 5, y + 6, { width: 60, align: "right" });

      doc.moveTo(col.item, y + rowHeight - 5)
         .lineTo(col.item + 500, y + rowHeight - 5)
         .strokeColor("#eee")
         .stroke();

      y += rowHeight;
    });

    
    const totalsStartY = y + 20;
    const labelX = 380;
    const valueX = 470;

    
    const subtotal = order.orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    doc.fontSize(12).fillColor("#000")
      .text("Subtotal:", labelX, totalsStartY, { width: 100, align: "right" })
      .text(`₹${subtotal.toFixed(2)}`, valueX, totalsStartY, { width: 80, align: "right" });

    let currentY = totalsStartY + 25;

    
    if (order.couponApplied && order.discount > 0) {
      doc.fillColor("#27ae60") 
        .text("Discount:", labelX, currentY, { width: 100, align: "right" })
        .text(`₹${order.discount.toFixed(2)}`, valueX, currentY, { width: 80, align: "right" })
        .fillColor("#000");
      currentY += 30;
    }


    doc.fontSize(14).fillColor("#2980b9").font("Helvetica-Bold")
      .text("Total Amount:", labelX, currentY, { width: 100, align: "right" })
      .text(`₹${order.totalAmount.toFixed(2)}`, valueX, currentY, { width: 80, align: "right" });

    
    doc.moveDown(4);
    doc.fontSize(10).fillColor("#95a5a6")
      .text("Thank you for shopping with us!", { align: "center" });

    doc.end();
  } catch (error) {
    console.error("Invoice download error:", error);
    res.status(500).json({ error: "Failed to generate invoice" });
  }
};






module.exports = {
    getAllProducts,
    getProductDetails,
    downloadInvoice
};