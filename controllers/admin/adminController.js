const Order = require('../../models/orderSchema')
const Admin = require('../../models/Admin'); 

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

        console.log('Rendering dashboard with data:', {
            totalSalesAmount,
            totalOrders,
            pendingOrders,
            shippedOrders,
            deliveredOrders,
            returnedOrders
        });

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


 const adminSignIn  = async (req,res)=>{ 
    
    const {email,password} = req.body;
    console.log(req.body)
 
    try { 
       
        
        const admin = await Admin.findOne({email});
       console.log("admin",admin);
       
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
            console.error("Error destroying session:", err);
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
    loadDashboard
}



