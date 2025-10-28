const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');






const categoryInfo = async (req,res) =>{
    console.log("i am get");
    

    try {
        
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page -1)*limit

        const categoryData = await Category.find({})
        .sort({createdAt:-1})
        .skip(skip) 
        .limit(limit);

        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit);
        console.log(categoryData);
        
        res.render('category',{
            cat:categoryData,
            currentPage:page,
            totalPages : totalPages,
            totalCategories : totalCategories

        });

    } catch (error) {
        console.error(error);
        
    }
};


const addCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !description) {
            return res.status(400).json({ error: "Name and description are required" });
        }

    
        const existingCategory = await Category.findOne({ name: { $regex: new RegExp("^" + name + "$", "i") } });

        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists" });
        }

        const newCategory = new Category({
            name,
            description,
        });

        await newCategory.save();
        return res.status(201).json({ message: "Category added successfully" });

    } catch (error) {
        console.error("Error adding category:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};



const getListCategory = async (req,res)=>{
    try {
        
        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:false}});
        res.redirect("/admin/category");

    } catch (error) {
        console.log(error)
    }
}

const getUnlistCategory = async (req,res)=>{
    try {
        
        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:true}});
        res.redirect('/admin/category');

    } catch (error) {
        console.error(error);
        
    }
}

const getEditCategory = async (req,res)=>{
    try {
        
        let id = req.query.id;
        const category = await Category.findOne({_id:id});
        res.render("edit-category",{
            category:category
        });

    } catch (error) {
        console.error(error);
        
    }
};


const editCategory = async (req,res)=>{
    try {
        
        const id = req.params.id;
        const {categoryName,description} = req.body;
        const existingCategory = await Category.findOne({name:categoryName});

        if(existingCategory){
            return res.status(400).json({error:"Catogory exist, please choose another name"})
        }
        const updateCategory = await Category.findByIdAndUpdate(id,{
            name:categoryName,
            description:description,
        },{new:true});

        if(updateCategory){
            res.redirect('/admin/category');
        }else{
            res.status(400).json({error:"Category not found"})
        }

    } catch (error) {
        res.status(500).json({error:"internal server error"});
    }
}



const addCategoryOffer = async (req, res) => {
    try {
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;

        console.log("Received:", req.body);

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        const products = await Product.find({ category: category._id });

        
        const hasHigherProductOffer = products.some(
            (product) => product.productOffer > percentage
        );

        if (hasHigherProductOffer) {
            return res.json({ 
                status: false, 
                message: "One or more products already have a higher product offer" 
            });
        }

        
        await Category.updateOne(
            { _id: categoryId },
            { $set: { categoryOffer: percentage } }
        );

        
        await Product.updateMany(
            { category: category._id },
            { 
                $set: { 
                    productOffer: 0,
                    salesPrice: { 
                        $subtract: [
                            "$regularPrice",
                            { $multiply: ["$regularPrice", percentage / 100] }
                        ]
                    }
                }
            }
        );

        res.json({ status: true, message: "Category offer applied successfully" });

    } catch (error) {
        console.error("Error in addCategoryOffer:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};


const removeCategoryOffer = async(req,res)=>{
    try {
        const categoryId=req.body.categoryId;
        const category=await Category.findById(categoryId) 
        if(!category){
            return res.status(404).json({status:false,message:"Category not found"})
        }

        const percentage=category.categoryOffer;
        const products=await Product.find({category:category._id})

        if(products.length>0){

            for(const product of products){
                product.salePrice+=Math.floor(product.regularPrice * (percentage/100))
                product.productOffer=0;
                await product.save();

            }

            category.categoryOffer=0;
            await category.save()
            res.json({status:true})

        }

    } catch (error) {
        res.status(500).json({status:false,message:"Internal Server Error"})
    }
}



module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
    addCategoryOffer,
    removeCategoryOffer,
}