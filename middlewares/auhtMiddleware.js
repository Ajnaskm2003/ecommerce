// middlewares/auhtMiddleware.js
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

// middlewares/auhtMiddleware.js

// middlewares/auhtMiddleware.js
const checkBlockStatus = async (req, res, next) => {
    // 1. IMMEDIATELY SKIP ALL ADMIN REQUESTS
    if (req.session?.admin) {
        console.log("Admin request - skipping block check");
        return next(); // ← ADMIN NEVER TOUCHED
    }

    // 2. Only check normal users
    if (!req.session?.user) {
        return next();
    }

    try {
        const userId = req.session.user.id || req.session.user._id;
        const user = await User.findById(userId).select('isBlocked').lean();

        if (user?.isBlocked) {
            req.flash('error', 'Your account has been blocked by the admin. Please contact support.');

            req.session.destroy(() => {
                res.clearCookie('connect.sid');
            });

            if (req.xhr || req.headers.accept?.includes('json')) {
                return res.status(401).json({ blocked: true });
            }
            return res.redirect('/signin');
        }
    } catch (err) {
        console.log('checkBlockStatus error:', err);
    }

    next();
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
  redirectIfLoggedIn,
  checkBlockStatus
};