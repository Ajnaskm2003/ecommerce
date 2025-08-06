const checkSession = (req, res, next) => {
    // Set cache control headers
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    if (req.session.user) {
        next();
    } else {
        res.redirect('/signin');
    }
};

const isLogin = (req, res, next) => {
    if (req.session.user) {
        res.redirect('/');
    } else {
        next();
    }
};


const checkCartAccess = async (req, res, next) => {
    if (req.session.orderPlaced) {
        delete req.session.orderPlaced;
        return res.redirect('/orders');
    }
    next();
};

const checkOrderPlaced = async (req, res, next) => {
    if (req.session.orderPlaced) {
        // Clear the orderPlaced flag and cart access
        delete req.session.orderPlaced;
        delete req.session.cartAccess;
        return res.redirect('/');
    }
    next();
};

const redirectIfLoggedIn = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    next();
};


module.exports = {
    checkSession,
    isLogin,
    checkCartAccess,
    checkOrderPlaced,
    redirectIfLoggedIn
    
};