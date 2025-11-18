const mongoose = require('mongoose');
const Cart = require('../models/cartSchema'); 
const User = require('../models/userSchema');

const checkSession = (req, res, next) => {
    
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
    if (!req.session.user) {
        return res.redirect('/signin');
    }

    const userId = req.session.user.id;
    const cart = await Cart.findOne({ userId });

    if (req.session.orderPlaced || !cart || !cart.items.length) {
        delete req.session.orderPlaced;
        delete req.session.cartAccess;
        return res.redirect('/orders');
    }

    next();
};

const checkOrderPlaced = async (req, res, next) => {
    if (req.session.orderPlaced) {
        delete req.session.orderPlaced;
        delete req.session.cartAccess;
        return res.redirect('/orders');
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