const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose')


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








module.exports = {
    getAllProducts,
    getProductDetails,
};