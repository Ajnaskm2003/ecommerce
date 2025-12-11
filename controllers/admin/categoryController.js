const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');






const categoryInfo = async (req, res) => {
    console.log("i am get");

    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';


        const searchQuery = search 
            ? { name: { $regex: search, $options: 'i' } } 
            : {};

        const categoryData = await Category.find(searchQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalCategories / limit);

        res.render('category', {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
            search: search 
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};


const addCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !description) {
            return res.status(400).json({ 
                status: false, 
                message: "Category name and description are required." 
            });
        };

        const trimmedName = name.trim();
        const trimmedDescription = description.trim();

        if (trimmedName.length < 3 || trimmedName.length > 30) {
            return res.status(400).json({ 
                status: false, 
                message: "Category name must be between 3 and 30 characters long." 
            });
        }

        if (trimmedDescription.length < 10 || trimmedDescription.length > 200) {
            return res.status(400).json({ 
                status: false, 
                message: "Description must be between 10 and 200 characters long." 
            });
        }

        const validName = /^[A-Za-z0-9\s]+$/;
        if (!validName.test(trimmedName)) {
            return res.status(400).json({ 
                status: false, 
                message: "Category name can only contain letters, numbers, and spaces." 
            });
        }

        const existingCategory = await Category.findOne({ 
            name: { $regex: new RegExp("^" + trimmedName + "$", "i") } 
        });

        if (existingCategory) {
            return res.status(400).json({ 
                status: false, 
                message: "Category already exists." 
            });
        }

        const newCategory = new Category({
            name: trimmedName,
            description: trimmedDescription,
        });

        await newCategory.save();
        return res.status(201).json({ 
            status: true, 
            message: "Category added successfully." 
        });

    } catch (error) {
        console.error("Error adding category:", error);
        return res.status(500).json({ 
            status: false, 
            message: "Internal server error." 
        });
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

const getEditCategory = async (req, res) => {
  try {
    const id = req.query.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.redirect('/admin/category?error=Invalid+ID');
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.redirect('/admin/category?error=Category+not+found');
    }

    res.render("edit-category", { category });

  } catch (error) {
    console.error("getEditCategory error:", error);
    res.redirect('/admin/category?error=Server+error');
  }
};


const updateCategory = async (req, res) => {
  try {
    const { id, name, description } = req.body;


    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    if (!description || description.trim().length === 0) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const trimmedName = name.trim();
    const trimmedDesc = description.trim();

    
    const existingCategory = await Category.findOne({
      name: { $regex: `^${trimmedName}$`, $options: 'i' },  
      _id: { $ne: id }
    });

    if (existingCategory) {
      return res.status(400).json({
        error: 'Category name already exists. Please choose another.'
      });
    }


    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { name: trimmedName, description: trimmedDesc },
      { new: true, runValidators: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }

    
    res.redirect('/admin/category?success=Category+updated+successfully');

  } catch (error) {
    console.error('updateCategory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


const addCategoryOffer = async (req, res) => {
    try {
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;

        if (isNaN(percentage) || percentage < 0 || percentage > 90) {
            return res.status(400).json({ 
                status: false, 
                message: "Offer must be between 0 and 90%" 
            });
        }

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ 
                status: false, 
                message: "Category not found" 
            });
        }

        
        await Category.updateOne(
            { _id: categoryId },
            { $set: { categoryOffer: percentage } }
        );

        
        await Product.updateMany(
            { category: categoryId },
            [
                {
                    $set: {
                        salePrice: {
                            $round: [
                                {
                                    $subtract: [
                                        "$regularPrice",
                                        {
                                            $multiply: [
                                                "$regularPrice",
                                                {
                                                    $divide: [
                                                        {
                                                            $max: [
                                                                { $ifNull: ["$offerPercentage", 0] },
                                                                percentage
                                                            ]
                                                        },
                                                        100
                                                    ]
                                                }
                                            ]
                                        }
                                    ]
                                },
                                2
                            ]
                        },
                        appliedOffer: {  
                            $max: [
                                { $ifNull: ["$offerPercentage", 0] },
                                percentage
                            ]
                        }
                    }
                }
            ]
        );

        res.json({ 
            status: true,
            message: `${percentage}% category offer applied! Highest offer will be used on each product.`
        });

    } catch (error) {
        console.error("Error applying category offer:", error);
        res.status(500).json({ 
            status: false, 
            message: "Server error" 
        });
    }
};



const removeCategoryOffer = async (req, res) => {
    try {
        const { categoryId } = req.body;

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

    
        await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: 0 } });

        
        await Product.updateMany(
            { category: categoryId },
            [
                {
                    $set: {
                        salePrice: {
                            $round: [
                                {
                                    $subtract: [
                                        "$regularPrice",
                                        {
                                            $multiply: [
                                                "$regularPrice",
                                                { $divide: ["$offerPercentage", 100] }
                                            ]
                                        }
                                    ]
                                },
                                2
                            ]
                        }
                    }
                }
            ]
        );

        res.json({ status: true, message: "Category offer removed" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: "Server error" });
    }
};



module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    updateCategory,
    addCategoryOffer,
    removeCategoryOffer,
}