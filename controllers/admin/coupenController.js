const Coupon = require('../../models/coupenSchema')
const Order = require('../../models/orderSchema');


const getCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find();
    
        
        res.render('coupon', { coupons });
    } catch (error) {
        console.error('errrrrrrrrrr',error);
        res.redirect('/admin/dashboard');
    }
};


const addCoupon = async (req, res) => {
    try {
        const {
            code,
            discount,
            type,
            minPurchase = 0,
            maxDiscount,
            expiryDate,
            usageLimit
        } = req.body;

    
        if (!code || !discount || !type || !expiryDate || usageLimit === undefined || !maxDiscount) {
            return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
        }

        
        if (type !== 'percentage') {
            return res.status(400).json({ success: false, message: 'Only percentage-based coupons are allowed.' });
        }

        
        const codeRegex = /^[A-Z0-9]+$/;
        if (!codeRegex.test(code)) {
            return res.status(400).json({ success: false, message: 'Coupon code must contain only uppercase letters and numbers.' });
        }

        const parsedDiscount = parseFloat(discount);
        const parsedMinPurchase = parseFloat(minPurchase) || 0;
        const parsedMaxDiscount = parseFloat(maxDiscount);
        const parsedUsageLimit = parseInt(usageLimit, 10);

        
        if (isNaN(parsedDiscount) || parsedDiscount < 1 || parsedDiscount > 90) {
            return res.status(400).json({ success: false, message: 'Discount must be between 1% and 90%.' });
        }

        if (parsedMinPurchase < 0) {
            return res.status(400).json({ success: false, message: 'Minimum purchase cannot be negative.' });
        }

        if (isNaN(parsedMaxDiscount) || parsedMaxDiscount <= 0) {
            return res.status(400).json({ success: false, message: 'Maximum discount amount is required and must be positive.' });
        }

        if (parsedMaxDiscount < parsedDiscount) {
            return res.status(400).json({ success: false, message: 'Maximum discount must be ≥ discount percentage value.' });
        }

        if (isNaN(parsedUsageLimit) || parsedUsageLimit < 0) {
            return res.status(400).json({ success: false, message: 'Usage limit must be a non-negative number.' });
        }

        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const exp = new Date(expiryDate);
        if (isNaN(exp.getTime()) || exp < today) {
            return res.status(400).json({ success: false, message: 'Expiry date must be today or in the future.' });
        }

        
        const existingCoupon = await Coupon.findOne({ code: code.trim().toUpperCase() });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: 'Coupon code already exists.' });
        }

        const newCoupon = new Coupon({
            code: code.trim().toUpperCase(),
            discount: parsedDiscount,
            type: 'percentage',
            minPurchase: parsedMinPurchase,
            maxDiscount: parsedMaxDiscount,
            expiryDate: exp,
            usageLimit: parsedUsageLimit === 0 ? null : parsedUsageLimit
        });

        await newCoupon.save();

        return res.json({ success: true, message: 'Percentage coupon created successfully!' });

    } catch (error) {
        console.error('addCoupon error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};


const editCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            code,
            discount,
            type,
            minPurchase = 0,
            maxDiscount,
            usageLimit,
            expiryDate
        } = req.body;

        
        if (!code || !discount || !type || !expiryDate || usageLimit === undefined || maxDiscount === undefined) {
            return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
        }


        if (type !== 'percentage') {
            return res.status(400).json({ success: false, message: 'Only percentage-based coupons are allowed.' });
        }

        
        const codeRegex = /^[A-Z0-9]+$/;
        if (!codeRegex.test(code.trim())) {
            return res.status(400).json({ success: false, message: 'Coupon code must contain only uppercase letters and numbers.' });
        }

        const parsedDiscount = parseFloat(discount);
        const parsedMinPurchase = parseFloat(minPurchase) || 0;
        const parsedMaxDiscount = parseFloat(maxDiscount);
        const parsedUsageLimit = parseInt(usageLimit, 10);

        
        if (isNaN(parsedDiscount) || parsedDiscount < 1 || parsedDiscount > 90) {
            return res.status(400).json({ success: false, message: 'Discount must be between 1% and 90%.' });
        }

        if (parsedMinPurchase < 0) {
            return res.status(400).json({ success: false, message: 'Minimum purchase cannot be negative.' });
        }

        if (isNaN(parsedMaxDiscount) || parsedMaxDiscount <= 0) {
            return res.status(400).json({ success: false, message: 'Maximum discount amount is required and must be positive.' });
        }

        
        if (parsedMaxDiscount < parsedDiscount) {
            return res.status(400).json({ success: false, message: 'Maximum discount must be ≥ discount percentage value.' });
        }

        if (isNaN(parsedUsageLimit) || parsedUsageLimit < 0) {
            return res.status(400).json({ success: false, message: 'Usage limit must be a non-negative number.' });
        }

        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const exp = new Date(expiryDate);
        if (isNaN(exp.getTime()) || exp < today) {
            return res.status(400).json({ success: false, message: 'Expiry date must be today or in the future.' });
        }

        
        const existingCoupon = await Coupon.findOne({
            code: code.trim().toUpperCase(),
            _id: { $ne: id }
        });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: 'This coupon code is already used by another coupon.' });
        }

    
        const updated = await Coupon.findByIdAndUpdate(
            id,
            {
                code: code.trim().toUpperCase(),
                discount: parsedDiscount,
                type: 'percentage', 
                minPurchase: parsedMinPurchase,
                maxDiscount: parsedMaxDiscount,
                usageLimit: parsedUsageLimit === 0 ? null : parsedUsageLimit,
                expiryDate: exp
            },
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Coupon not found.' });
        }

        return res.json({ success: true, message: 'Coupon updated successfully!' });

    } catch (error) {
        console.error('editCoupon error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};


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