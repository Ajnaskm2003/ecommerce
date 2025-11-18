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
            maxDiscount = null,
            expiryDate,
            usageLimit
        } = req.body;

    
        if (!code || !discount || !type || !expiryDate || usageLimit === undefined) {
            return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
        }

        
        const codeRegex = /^[A-Z0-9]+$/;
        if (!codeRegex.test(code)) {
            return res.status(400).json({ success: false, message: 'Coupon code must contain only uppercase letters and numbers.' });
        }

        
        const parsedDiscount = parseFloat(discount);
        const parsedMinPurchase = parseFloat(minPurchase) || 0;
        const parsedMaxDiscount = maxDiscount ? parseFloat(maxDiscount) : null;
        const parsedUsageLimit = parseInt(usageLimit, 10);

        if (isNaN(parsedDiscount) || parsedDiscount <= 0) {
            return res.status(400).json({ success: false, message: 'Discount amount must be a positive number.' });
        }
        if (parsedMinPurchase < 0) {
            return res.status(400).json({ success: false, message: 'Minimum purchase cannot be negative.' });
        }
        if (parsedMaxDiscount !== null && parsedMaxDiscount < 0) {
            return res.status(400).json({ success: false, message: 'Maximum discount cannot be negative.' });
        }
        if (isNaN(parsedUsageLimit) || parsedUsageLimit < 0) {
            return res.status(400).json({ success: false, message: 'Usage limit must be a non-negative integer.' });
        }

        
        if (type === 'percentage') {
            if (parsedDiscount > 100) {
                return res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100%.' });
            }
            if (parsedMaxDiscount === null) {
                return res.status(400).json({ success: false, message: 'Maximum discount is required for percentage coupons.' });
            }
            if (parsedMaxDiscount < parsedDiscount) {
                return res.status(400).json({ success: false, message: 'Maximum discount must be ≥ discount amount for percentage coupons.' });
            }
        } else if (type === 'flat') {
            if (parsedMaxDiscount !== null) {
                return res.status(400).json({ success: false, message: 'Maximum discount should be empty for flat amount coupons.' });
            }
        } else {
            return res.status(400).json({ success: false, message: 'Invalid discount type.' });
        }

    
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const exp = new Date(expiryDate);
        if (isNaN(exp.getTime()) || exp < today) {
            return res.status(400).json({ success: false, message: 'Expiry date must be today or a future date.' });
        }

        
        const existingCoupon = await Coupon.findOne({ code: code.trim().toUpperCase() });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: 'Coupon code already exists.' });
        }

        
        const newCoupon = new Coupon({
            code: code.trim().toUpperCase(),
            discount: parsedDiscount,
            type,
            minPurchase: parsedMinPurchase,
            maxDiscount: type === 'percentage' ? parsedMaxDiscount : undefined,
            expiryDate: exp,
            usageLimit: parsedUsageLimit === 0 ? null : parsedUsageLimit
        });

        await newCoupon.save();

        
        return res.json({ success: true, message: 'Coupon created successfully!' });

    } catch (error) {
        console.error('addCoupon error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
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