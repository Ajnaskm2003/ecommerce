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
        console.log("Received Coupon Code:", code);
        console.log("Received Total Amount:", totalAmount);

        const coupon = await Coupon.findOne({ code });

        if (!coupon) {
            return res.status(400).json({ message: "❌ Invalid coupon code" });
        }

        
        if (coupon.expiryDate < new Date()) {
            return res.status(400).json({ message: "❌ Coupon expired" });
        }

        
        if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ message: "❌ Coupon usage limit reached" });
        }

        
        const cartTotal = parseFloat(totalAmount);

    
        if (cartTotal < coupon.minPurchase) {
            return res.status(400).json({ message: `❌ Minimum purchase should be ₹${coupon.minPurchase}` });
        }

        
        let discountAmount = 0;
        if (coupon.type === "percentage") {
            discountAmount = (cartTotal * coupon.discount) / 100;
            if (coupon.maxDiscount > 0 && discountAmount > coupon.maxDiscount) {
                discountAmount = coupon.maxDiscount; 
            }
        } else {
            discountAmount = coupon.discount; 
        }

        
        const newTotal = cartTotal - discountAmount;

        
        await Coupon.updateOne({ code }, { $inc: { usedCount: 1 } });

        return res.json({ success: true, discountAmount, newTotal });
    } catch (error) {
        console.error("Error applying coupon:", error);
        return res.status(500).json({ message: "❌ Error applying coupon" });
    }
};



module.exports = {
    applyCoupon,
    getActiveCoupons
}