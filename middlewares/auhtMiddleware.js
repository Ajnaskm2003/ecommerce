const checkSession = (req,res,next) =>{
    // console.log("user")
    if(req.session.user){
     return   next();
    }
    else{
        return res.redirect('/signin')
    }
}

const isLogin = (req,res,next) =>{
    if(req.session.user){
        return res.redirect('/')
    }
    else{
        return next()
    }
}



module.exports={
    checkSession,isLogin
}