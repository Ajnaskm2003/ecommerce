const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const fs = require('fs');
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

const getProdutPage = async (req,res) =>{
    try {
        const products = await Product.find().populate('category');
        console.log("Category received from request:", req.body.category);

        res.render('product',{
            products,
            msg: req.flash('success')
        })
    } catch (error) {
        console.error(error);
        
    }
}

const getProducts = async (req, res) => {
    try {
        // Populate the category field when fetching products
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
        const { productName, description, brand, category, regularPrice, salePrice, quantity, sizes } = req.body;



        console.log("size",sizes)

        
        if (!productName || !description || !brand || !category || !regularPrice || !salePrice || !quantity ) {
            req.flash('error', 'Missing required fields');
            return res.redirect('/admin/addProducts');
        }

        let totalSizeStock = Object.values(sizes).reduce((a, b) => parseInt(a) + parseInt(b), 0);

        if (totalSizeStock > quantity) {
          return res.send("Size stock cannot exceed total stock.");
        }


        
        if (!req.files || req.files.length === 0) {
            req.flash('error', 'At least one image is required');
            return res.redirect('/admin/addProducts');
        }

        let formattedSizes = {};
        for (let key in sizes) {
            if (sizes[key].trim() !== "") {
                formattedSizes[key] = parseInt(sizes[key], 10); 
            }
        }

        
        const categoryDoc = await Category.findOne({ name: category.trim() });
        if (!categoryDoc) {
            req.flash('error', 'Invalid category name');
            return res.redirect('/admin/addProducts');
        }

        console.log('1');
        
        
        const images = [];
        for (let file of req.files) {
            try {
                const filename = Date.now() + '-' + file.originalname;
                const resizedImagePath = path.join('public', 'uploads', 'images', filename);

                const dir = path.dirname(resizedImagePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                await sharp(file.path)
                    .resize(440, 440)
                    .toFile(resizedImagePath);

                images.push(`/uploads/images/${filename}`);
            } catch (err) {
                console.error('Error processing image:', err);
                req.flash('error', 'Image processing failed');
                return res.redirect('/admin/addProducts');
            }
        }


        console.log("product adding")

        
        const newProduct = new Product({
            productName,
            description,
            brand,
            category: categoryDoc._id,
            regularPrice: parseFloat(regularPrice),
            salePrice: parseFloat(salePrice),
            quantity: parseInt(quantity),
            sizes:formattedSizes,
            productImage: images,
            status: 'Available'
        });

        console.log('product saving');
        
        await newProduct.save();
        console.log('Product saved successfully:', newProduct);

        
        setTimeout(() => {
            for (let file of req.files) {
                try {
                    fs.unlink(file.path, (err) => {
                        if (err) console.error(`Failed to delete temp file ${file.path}:`, err);
                    });
                } catch (error) {
                    console.error(`Error deleting temp file ${file.path}:`, error);
                }
            }
        }, 5000);

        
        req.flash('success', 'Product added successfully');
        return res.redirect('/admin/products');
    } catch (error) {
        console.error("Error saving product:", error);
        req.flash('error', 'Failed to save product');
        return res.redirect('/admin/addProducts');
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
        
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        // Validate sizes stock
        const sizes = data.sizes || {};
        let formattedSizes = {};
        let totalSizeStock = 0;

        for (let key in sizes) {
            if (sizes[key].trim() !== "") {
                const sizeQty = parseInt(sizes[key], 10);
                if (isNaN(sizeQty) || sizeQty < 0) {
                    return res.json({ error: 'Invalid size stock values' });
                }
                formattedSizes[key] = sizeQty;
                totalSizeStock += sizeQty;
            }
        }

        if (totalSizeStock > parseInt(data.quantity)) {
            return res.json({ error: 'Size stock cannot exceed total stock' });
        }

        // Process new images if any
        const newImages = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const filename = Date.now() + '-' + file.originalname;
                    const resizedImagePath = path.join('public', 'uploads', 'images', filename);
                    
                    const dir = path.dirname(resizedImagePath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    await sharp(file.path)
                        .resize(440, 440)
                        .toFile(resizedImagePath);
                    
                    newImages.push(`/uploads/images/${filename}`);
                    fs.unlinkSync(file.path);
                } catch (err) {
                    console.error('Error processing new image:', err);
                }
            }
        }

        // Validate images (new + existing)
        const updatedImages = [...product.productImage, ...newImages];
        if (updatedImages.length === 0) {
            return res.json({ error: 'At least one image is required' });
        }

        // Validate category
        const categoryDoc = await Category.findOne({ name: data.category });
        if (!categoryDoc) {
            return res.json({ error: 'Invalid category' });
        }

        // Perform update
        await Product.findByIdAndUpdate(
            id,
            {
                productName: data.productName,
                description: data.description,
                brand: data.brand,
                category: categoryDoc._id,
                regularPrice: parseFloat(data.regularPrice),
                salePrice: parseFloat(data.salePrice),
                quantity: parseInt(data.quantity),
                color: data.color,
                sizes: formattedSizes,
                productImage: updatedImages
            },
            { new: true }
        );

        return res.json({ success: true, message: 'Product updated successfully' });

    } catch (error) {
        console.error("Error updating product:", error);
        return res.status(500).json({ 
            error: error.message || 'Failed to update product' 
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
        await Product.updateOne({ _id: id }, { $set: { isBlocked: true } }); // Fixed typo
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
  getProdutPage ,
  getProducts,
  addProducts,
  getEditProduct,
  editProduct,
  deleteSingleImage,
  blockProduct,
  unblockProduct,

}