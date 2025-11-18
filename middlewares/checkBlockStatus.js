const User = require('../models/userSchema');
const mongoose = require('mongoose');

const checkBlockStatus = async (req, res, next) => {
    if (req.session.user) {
        try {
            const user = await User.findById(req.session.user._id).select('isBlocked');

            if (user && user.isBlocked) {
                
                req.session.destroy((err) => {
                    if (err) console.log('Session destroy error:', err);
                });
                return res.render('login', {
                    message: 'Your account has been blocked by admin.'
                });
            }
        } catch (err) {
            console.error('Error checking block status:', err);
            return res.status(500).send('Server error');
        }
    }
    next();
};