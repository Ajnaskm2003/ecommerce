const Category = require('../../models/categorySchema');






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



module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
    
}