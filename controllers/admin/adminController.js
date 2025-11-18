const Order = require('../../models/orderSchema')
const Admin = require('../../models/Admin'); 
const Product = require('../../models/productSchema');
const CATEGORY = require('../../models/categorySchema');

const loadDashboard = async (req, res) => {
    try {
        const orders = await Order.find();

        const totalOrders = orders.length;
        const totalSalesAmount = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
        const pendingOrders = orders.filter(o => o.status === 'Pending').length;
        const shippedOrders = orders.filter(o => o.status === 'Shipped').length;
        const deliveredOrders = orders.filter(o => o.status === 'Delivered').length;
        const returnedOrders = orders.filter(o => 
            o.orderItems.some(item => item.returnStatus === 'Accepted')
        ).length;


        return res.render('dashboard', {
            totalSalesAmount,
            totalOrders,
            pendingOrders,
            shippedOrders,
            deliveredOrders,
            returnedOrders
        });

    } catch (error) {
        console.error("Dashboard error:", error);
        res.status(500).send("Something went wrong");
    }
}




const getSalesTrend = async (req, res) => {
    try {
        const { filter = "yearly" } = req.query;
        const fmt = filter === "monthly" ? "%Y-%m" : "%Y";

        const result = await Order.aggregate([
            { $match: { status: "Delivered" } },
            {
                $group: {
                    _id: { $dateToString: { format: fmt, date: "$createdOn" } },
                    total: { $sum: "$totalAmount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const labels = result.map(r => r._id);
        const values = result.map(r => r.total);

        res.json({ labels, values });
    } catch (e) {
        console.error("SalesTrend error →", e);
        res.status(500).json({ error: "sales" });
    }
};




const getTopProducts = async (req, res) => {
    try {
        const top = await Order.aggregate([
            { $match: { status: "Delivered" } },
            { $unwind: "$orderItems" },
            {
                $group: {
                    _id: "$orderItems.product",
                    qty: { $sum: "$orderItems.quantity" }
                }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "p"
                }
            },
            { $unwind: "$p" },
            {
                $project: {
                    name: "$p.productName",   
                    quantity: "$qty"
                }
            },
            { $sort: { quantity: -1 } },
            { $limit: 10 }
        ]);

        res.json(top);
    } catch (e) {
        console.error("TopProducts error →", e);
        res.status(500).json({ error: "products" });
    }
};




const getTopCategories = async (req, res) => {
    try {
        const top = await Order.aggregate([
            { $match: { status: "Delivered" } },
            { $unwind: "$orderItems" },

            
            {
                $lookup: {
                    from: "products",
                    localField: "orderItems.product",
                    foreignField: "_id",
                    as: "prod"
                }
            },
            { $unwind: "$prod" },

            
            {
                $group: {
                    _id: "$prod.category",
                    revenue: {
                        $sum: { $multiply: ["$orderItems.quantity", "$orderItems.price"] }
                    }
                }
            },

            
            {
                $lookup: {
                    from: "categories",
                    localField: "_id",
                    foreignField: "_id",
                    as: "cat"
                }
            },
            { $unwind: "$cat" },

            {
                $project: {
                    name: "$cat.name",
                    revenue: 1
                }
            },
            { $sort: { revenue: -1 } },
            { $limit: 10 }
        ]);

        res.json(top);
    } catch (e) {
        console.error("TopCategories error →", e);
        res.status(500).json({ error: "categories" });
    }
};




const adminSignIn  = async (req,res)=>{ 
    
    const {email,password} = req.body;
    console.log(req.body)
 
    try { 
       
        
        const admin = await Admin.findOne({email});
    
       
       if (!admin) {
        req.flash("error", "Invalid email or password");
        return res.redirect("/admin/login"); 
        }
    
        if (admin.password !== password) {
        req.flash("error", "Invalid email or password");
        return res.redirect("/admin/login"); 
        }
    



        req.session.admin = true;
        console.log('admin',req.session.admin)
        return res.redirect('/admin/dashboard');


    } catch (error) {
        res.status(500).json({message: error.message});

    }
};

const adminLogout = (req,res)=>{
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: "Failed to log out" });
        }
        res.redirect('/admin/login'); 
    });
};


const loadsignin= async (req,res)=>{
    
    try {
       return res.render('login')
    } catch (error) {
        res.status(500);
        
    }
}




module.exports={
    adminSignIn,
    adminLogout,
    loadsignin,
    loadDashboard,
    getTopCategories,
    getTopProducts,
    getSalesTrend
    

}



