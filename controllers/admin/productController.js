const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const sharp = require('sharp');



const getProductAddPage = async (req,res)=>{
    try {
        console.log("i am here");
        
        
        const category = await Category.find({isListed:true});
        res.render('product-add',{
            cat:category,
        });

    } catch (error) {
        console.error(error);
        
    }

}

const getProductPage = async (req, res) => {
    try {
        
        const page = parseInt(req.query.page) || 1;
        const limit = 10;                                   
        const skip = (page - 1) * limit;

        const search = req.query.search?.trim() || '';
        const query = search
            ? {
                  $or: [
                      { productName: { $regex: search, $options: 'i' } },
                      { brand:       { $regex: search, $options: 'i' } }
                  ]
              }
            : {};

        const total = await Product.countDocuments(query);
        const products = await Product.find(query)
            .populate('category')
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);

        
        res.render('product', {
            products,
            msg: req.flash('success'),
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                hasPrev: page > 1,
                hasNext: page < Math.ceil(total / limit),
                search                              
            }
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).render('product', {
            products: [],
            msg: 'Error loading products',
            pagination: { current: 1, pages: 0, hasPrev: false, hasNext: false }
        });
    }
};


const getProducts = async (req, res) => {
    try {
        const products = await Product.find()
            .populate('category')
            .sort({ createdOn: -1 });

        res.render('admin/product', {
            products,
            msg: req.query.msg || ''
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).render('admin/product', {
            products: [],
            msg: 'Error loading products'
        });
    }
};

const addProducts = async (req, res) => {
    try {
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');

        const { productName, description, category, regularPrice, salePrice, quantity, sizes } = req.body;

        
        console.log('Received product data:', { productName, description, category, regularPrice, salePrice, quantity });

        
        if (!productName || !description || !category || !regularPrice || !salePrice || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        
        if (typeof productName !== 'string' || productName.trim().length < 3 || productName.trim().length > 15) {
            return res.status(400).json({
                success: false,
                message: 'Product name must be 3-15 characters long.'
            });
        }
        if (!/^[a-zA-Z0-9\s\-_.,()]+$/.test(productName.trim())) {
            return res.status(400).json({
                success: false,
                message: 'Product name can only contain letters, numbers, spaces and basic punctuation (-_.,()).'
            });
        }


        if (typeof description !== 'string' || description.trim().length < 10 || description.trim().length > 2000) {
            return res.status(400).json({
                success: false,
                message: 'Description must be between 10 and 2000 characters.'
            });
        }

        
        if (typeof category !== 'string' || category.trim().length < 2 || category.trim().length > 50) {
            return res.status(400).json({
                success: false,
                message: 'Category name must be 2-50 characters.'
            });
        }

        
        const regPrice = parseFloat(regularPrice);
        const salPrice = parseFloat(salePrice);

        if (isNaN(regPrice) || regPrice <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Regular price must be a positive number.'
            });
        }
        if (isNaN(salPrice) || salPrice <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Sale price must be a positive number.'
            });
        }
        if (salPrice >= regPrice) {
            return res.status(400).json({
                success: false,
                message: 'Sale price must be less than regular price.'
            });
        }

    
        const qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty <= 0 || qty > 10000) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be a positive integer (max 10 000).'
            });
        }

        
        if (sizes && typeof sizes === 'object' && sizes !== null) {
            for (const [size, q] of Object.entries(sizes)) {
                if (typeof size !== 'string' || size.trim().length < 1 || size.trim().length > 10) {
                    return res.status(400).json({
                        success: false,
                        message: `Size label "${size}" must be 1-10 characters.`
                    });
                }
                const sq = parseInt(q, 10);
                if (isNaN(sq) || sq < 0) {
                    return res.status(400).json({
                        success: false,
                        message: `Quantity for size "${size}" must be a non-negative integer.`
                    });
                }
            }
        }

        

        
        const categoryDoc = await Category.findOne({ name: category });
        if (!categoryDoc) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category'
            });
        }

       
        const images = [];
        const uploadDir = path.join(__dirname, '../../public/uploads/products');

        
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one product image is required'
            });
        }

        
        for (const file of req.files) {
            try {
                const filename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '')}`;
                const processedPath = path.join(uploadDir, filename);

                
                await sharp(file.path)
                    .resize(800, 800, {
                        fit: 'contain',
                        background: { r: 255, g: 255, b: 255, alpha: 1 }
                    })
                    .jpeg({ quality: 90 })
                    .toFile(processedPath);

                images.push(`/uploads/products/${filename}`);
            } catch (err) {
                console.error('Image processing error:', err);
                continue;
            }
        }

        
        if (images.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Failed to process any images'
            });
        }

        
        const formattedSizes = {};
        if (typeof sizes === 'object' && sizes !== null) {
            Object.entries(sizes).forEach(([size, quantity]) => {
                if (quantity && !isNaN(quantity)) {
                    formattedSizes[size] = parseInt(quantity);
                }
            });
        }

        
        const newProduct = new Product({
            productName,
            description,
            category: categoryDoc._id,
            regularPrice: parseFloat(regularPrice),
            salePrice: parseFloat(salePrice),
            quantity: parseInt(quantity),
            sizes: formattedSizes,
            productImage: images,
            status: 'Available'
        });

        await newProduct.save();
        console.log('Product saved successfully:', newProduct._id);

        
        return res.status(200).json({
            success: true,
            message: 'Product added successfully',
            productId: newProduct._id
        });

    } catch (error) {
        console.error("Error saving product:", error);
        return res.status(500).json({
            success: false,
            message: 'Failed to save product',
            error: error.message
        });
    }
};



const getEditProduct =  async (req, res) => {

    try {
        
        const productId = req.params.id;
        const product = await Product.findById(productId).populate("category");
        const category = await Category.find({});
        const existCategory = await Category.find({_id:product.category});
        console.log("category gettttedd",existCategory);
        
     

        if (!product) {
            return res.status(404).render("admin/404", { message: "Product not found" });
        }

        res.render("editProduct",{
            product,
            category,
            cat:existCategory
        })

    }
     catch (error) {
        console.error("Error editing product getting ", error);
        req.flash("error", "An error occurred while updating the product status.");
        return res.redirect("/admin/products");
        
    }

}




const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;
        
        console.log('Request body:', data);

        const product = await Product.findById(id).populate('category');
        if (!product) {
            return res.status(404).json({ 
                success: false,
                message: "Product not found",
                type: "error"
            });
        }

        const regularPrice = parseFloat(data.regularPrice);
        if (isNaN(regularPrice) || regularPrice <= 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid regular price',
                type: 'error'
            });
        }

        const offerPercentage = parseFloat(data.offerPercentage) || 0;
        if (isNaN(offerPercentage) || offerPercentage < 0 || offerPercentage > 100) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid offer percentage. Must be between 0 and 100',
                type: 'error'
            });
        }

        const discountAmount = regularPrice * (offerPercentage / 100);
        const salePrice = regularPrice - discountAmount;
        const finalSalePrice = Math.round(salePrice * 100) / 100;

        const sizes = data.sizes || {};
        let formattedSizes = {};
        let totalSizeStock = 0;

        for (let key in sizes) {
            if (sizes[key].trim() !== "") {
                const sizeQty = parseInt(sizes[key], 10);
                if (isNaN(sizeQty) || sizeQty < 0) {
                    return res.status(400).json({ 
                        success: false,
                        message: 'Invalid size stock values',
                        type: 'error'
                    });
                }
                formattedSizes[key] = sizeQty;
                totalSizeStock += sizeQty;
            }
        }

        if (totalSizeStock > parseInt(data.quantity)) {
            return res.status(400).json({ 
                success: false,
                message: 'Size stock cannot exceed total stock',
                type: 'error'
            });
        }

    
        const newImages = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                let tempFilePath = file.path;
                try {
                    const filename = Date.now() + '-' + file.originalname;
                    const resizedImagePath = path.join('public', 'Uploads', 'images', filename);
                    
                    const dir = path.dirname(resizedImagePath);
                    if (!fs.existsSync(dir)) {
                        await fsp.mkdir(dir, { recursive: true });
                    }

                    await sharp(tempFilePath)
                        .resize(440, 440, { fit: 'cover' })
                        .toFile(resizedImagePath);
                    
                    newImages.push(`/uploads/images/${filename}`);

                    await fsp.unlink(tempFilePath).catch(err => {
                        console.warn(`Cleanup: Failed to delete temp file ${tempFilePath}`, err.message);
                    });

                } catch (err) {
                    console.error('Error processing new image:', err);
                    return res.status(500).json({ 
                        success: false,
                        message: 'Error processing images',
                        type: 'error'
                    });
                }
            }
        }
        

        const updatedImages = [...product.productImage, ...newImages];
        if (updatedImages.length === 0) {
            return res.status(400).json({ 
                success: false,
                message: 'At least one image is required',
                type: 'error'
            });
        }

        console.log('Category ID from form:', data.category);
        const categoryDoc = await Category.findById(data.category);
        if (!categoryDoc) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid category ID',
                type: 'error'
            });
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            {
                productName: data.productName,
                description: data.description,
                brand: data.brand || product.brand, 
                category: categoryDoc._id,
                regularPrice: regularPrice,
                offerPercentage: offerPercentage,
                salePrice: finalSalePrice,
                quantity: parseInt(data.quantity),
                sizes: formattedSizes,
                productImage: updatedImages,
                updatedAt: new Date()
            },
            { new: true }
        );

        return res.json({ 
            success: true, 
            message: 'Product updated successfully',
            product: updatedProduct
        });

    } catch (error) {
        console.error("Error updating product:", error);
        return res.status(500).json({ 
            success: false,
            message: error.message || 'Failed to update product'
        });
    }
};


const deleteSingleImage = async (req, res) => {
    try {
        const { imageNameToServer, productIdToServer } = req.body;
        
    
        const product = await Product.findById(productIdToServer);
        if (!product) {
            return res.status(404).json({ 
                status: false, 
                message: "Product not found" 
            });
        }

    
        const updatedProduct = await Product.findByIdAndUpdate(
            productIdToServer,
            { $pull: { productImage: imageNameToServer } },
            { new: true }
        );

        
        const filename = imageNameToServer.split('/').pop();
        

        const imagePath = path.join(process.cwd(), 'public', imageNameToServer);
        
    
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`Successfully deleted image: ${filename}`);
        } else {
            console.log(`File not found: ${imagePath}`);
        }

        return res.json({ 
            status: true, 
            message: 'Image deleted successfully',
            remainingImages: updatedProduct.productImage 
        });

    } catch (error) {
        console.error('Error deleting image:', error);
        return res.status(500).json({ 
            status: false, 
            message: 'Failed to delete image',
            error: error.message 
        });
    }
};

const blockProduct = async (req, res) => {
    try {
        let id = req.query.id;
        await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect('/admin/products');
    } catch (error) {
        console.error(error, "Error in blocking product");
        res.redirect('/page-404');
    }
};



const unblockProduct = async (req, res) => {
    try {
        let id = req.query.id;
        await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect('/admin/products');
    } catch (error) {
        console.error(error, "Error in unblocking product");
        res.redirect('/page-404');
    }
};









module.exports = {
  getProductAddPage ,
  getProductPage ,
  getProducts,
  addProducts,
  getEditProduct,
  editProduct,
  deleteSingleImage,
  blockProduct,
  unblockProduct,

}