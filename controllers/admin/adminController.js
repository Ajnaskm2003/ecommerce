
const Admin = require('../../models/Admin'); 

const loadDashboard = async(req,res)=>{
   
    try {
        console.log(' in thhe load')
        return res.render('dashboard');

    } catch (error) {
        res.status(500);
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
    loadDashboard,
    adminLogout
}



