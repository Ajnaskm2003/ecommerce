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
       .sort({createdAt: -1})
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


// Admin block user controller
const customerBlocked = async (req, res) => {
    try {
        const userId = req.params.id || req.query.id;

        await User.findByIdAndUpdate(userId, { isBlocked: true });

        // DESTROY ONLY NORMAL USER SESSIONS — NEVER TOUCH ADMIN
        if (req.sessionStore && typeof req.sessionStore.all === 'function') {
            req.sessionStore.all((err, sessions) => {
                if (err || !sessions) return;

                const sessionList = Array.isArray(sessions) ? sessions : Object.values(sessions);

                sessionList.forEach(session => {
                    // ONLY destroy if session has .user AND matches the blocked user
                    if (session?.user && session.user.id === userId) {
                        req.sessionStore.destroy(session.id || session.sessionId);
                    }
                    // NEVER destroy sessions with .admin
                });
            });
        }

        req.flash('success', 'User blocked successfully');
        return res.redirect('/admin/customers');

    } catch (error) {
        console.error('Block user error:', error);
        req.flash('error', 'Failed to block user');
        return res.redirect('/admin/customers');
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