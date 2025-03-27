const checkSession = (req, res, next) => {
    if (req.session.admin) {
        console.log("Admin session exists, proceeding...");
        next();
    } else {
        console.log('3');
        return res.redirect('/admin/login');
    }
};

const isLogin = (req, res, next) => {
    if (req.session.admin) {
        return res.redirect('/admin/dashboard'); 
    }
    next();
};

module.exports = { checkSession, isLogin };
