const Coupon = require('../../models/coupenSchema')
const Order = require('../../models/orderSchema');


const getCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find();
        console.log('elloooooo');
        
        res.render('coupon', { coupons });
    } catch (error) {
        console.error('errrrrrrrrrr',error);
        res.redirect('/admin/dashboard');
    }
};

// Add a new coupon
const addCoupon = async (req, res) => {
    try {

        console.log('reached here');
        
        const { code, discount, type, minPurchase, maxDiscount, expiryDate, usageLimit } = req.body;

        const existingCoupon = await Coupon.findOne({ code });
        if (existingCoupon) {
            return res.status(400).send('Coupon code already exists.');
        }

        const newCoupon = new Coupon({
            code,
            discount,
            type,
            minPurchase,
            maxDiscount,
            expiryDate,
            usageLimit
        });

        await newCoupon.save();
        res.redirect('/admin/coupons');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
};

// Delete a coupon
const deleteCoupon = async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.redirect('/admin/coupons');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting coupon');
    }
};

module.exports = {
    getCoupons,
    addCoupon,
    deleteCoupon
}