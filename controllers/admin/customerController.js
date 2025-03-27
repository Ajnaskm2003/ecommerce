const User = require('../../models/userSchema.js');


const customerInfo = async (req,res)=>{
    try {
        
        
       let search ="" ;
       if(req.query.search){
            search= req.query.search;
       }

       let page = 1;
       if(req.query.page){
            page = req.query.page;
       }

       const limit = 3;
       const userData = await User.find({
            isAdmin:false,
            $or:[

                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}},

            ],
       })
       .limit(limit*1)
       .skip((page-1)*limit)
       .exec();

        const count = await User.find({
            isAdmin:false,
            $or:[

                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}},

            ],
        }).countDocuments();

        const totalPages = Math.ceil(count / limit);

        res.render('customers',{
            data: userData,
            totalPages,
            currentPage: page,
            searchQuery: search

        });




    } catch (error) {
        console.error(error)
    }
};


const customerBlocked = async (req,res) =>{
    try {
        
        let id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect("/admin/customers")

    } catch (error) {
        console.error(error);
        
    }
};


const customerunBlocked = async (req,res)=>{
    try {
        
        let id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/customers");

    } catch (error) {
        console.error(error);
        
    }
}

module.exports= {
    customerInfo,
    customerBlocked,
    customerunBlocked,
}