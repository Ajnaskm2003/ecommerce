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


const editCoupon = async (req,res) => {
    try {
        const {id} = req.params;
        const {code,discount,type,minPurchase,maxDiscount,usageLimit,expiryDate} = req.body;

        const updated = await Coupon.findByIdAndUpdate(
            id,
            {
                code,
                discount,
                type,
                minPurchase,
                maxDiscount,
                usageLimit,
                expiryDate
            },
            {new : true}
        );

        if(!updated){
            return res.json({ success : false, message: "Coupon not Found"});
        }

        res.json({success: true , message : "Coupon updated Successfully"});



    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Error updating coupon" });
    }
}


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
    deleteCoupon,
    editCoupon
}