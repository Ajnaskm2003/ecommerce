const Coupon = require('../../models/coupenSchema');


const getActiveCoupons = async (req, res) => {
    try {
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0); 

        console.log("Fetching active coupons as of:", currentDate); 

        const coupons = await Coupon.find({
            expiryDate: { $gte: currentDate },
            $expr: { $lt: ["$usedCount", "$usageLimit"] }
        }).select("code discount type minPurchase maxDiscount");

        console.log("Found active coupons:", coupons.length); 

        res.json({
            success: true,
            coupons: coupons.map(coupon => ({
                code: coupon.code,
                discount: coupon.discount,
                type: coupon.type,
                minPurchase: coupon.minPurchase,
                maxDiscount: coupon.maxDiscount
            }))
        });
    } catch (error) {
        console.error("Error fetching active coupons:", error);
        res.status(500).json({ success: false, message: "Failed to fetch active coupons" });
    }
};


const applyCoupon = async (req, res) => {
    try {
        const { code, totalAmount } = req.body;
        const userId = req.session.user?.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to apply coupon" });
        }

        if (!code || !totalAmount) {
            return res.status(400).json({ success: false, message: "Coupon code and total amount required" });
        }

        const coupon = await Coupon.findOne({
            code: code.trim().toUpperCase(),
            isActive: true,
            expiryDate: { $gte: new Date() }
        });

        if (!coupon) {
            return res.status(400).json({ success: false, message: "Invalid or expired coupon" });
        }

        
        if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ success: false, message: "Coupon usage limit has been reached" });
        }

        
        if (coupon.perUserLimit > 0) {
            const usedCountByUser = await Order.countDocuments({
                userId,
                coupon: coupon.code,
                status: { $nin: ["Cancelled", "Returned", "Failed"] }
            });

            if (usedCountByUser >= coupon.perUserLimit) {
                return res.status(400).json({ success: false, message: "You have already used this coupon" });
            }
        }

        const cartTotal = parseFloat(totalAmount);

        if (cartTotal < coupon.minPurchase) {
            return res.status(400).json({
                success: false,
                message: `Minimum purchase of ₹${coupon.minPurchase} required for this coupon`
            });
        }

        let discountAmount = 0;
        if (coupon.type === "percentage") {
            discountAmount = (cartTotal * coupon.discount) / 100;
            if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
                discountAmount = coupon.maxDiscount;
            }
        } else {
            discountAmount = coupon.discount;
        }

        const newTotal = Math.max(0, cartTotal - discountAmount);

        return res.json({
            success: true,
            message: "Coupon applied successfully!",
            discountAmount: parseFloat(discountAmount.toFixed(2)),
            newTotal: parseFloat(newTotal.toFixed(2)),
            coupon: {
                code: coupon.code,
                type: coupon.type,
                discount: coupon.discount,
                maxDiscount: coupon.maxDiscount || null,
                minPurchase: coupon.minPurchase
            }
        });

    } catch (error) {
        console.error("Apply Coupon Error:", error);
        return res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
};



module.exports = {
    applyCoupon,
    getActiveCoupons
}