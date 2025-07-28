const Coupon = require('../../models/coupenSchema');


const applyCoupon = async (req, res) => {
    try {
        const { code, totalAmount } = req.body;  
        console.log("Received Coupon Code:", code);
        console.log("Received Total Amount:", totalAmount);

        const coupon = await Coupon.findOne({ code });

        if (!coupon) {
            return res.status(400).json({ message: "❌ Invalid coupon code" });
        }

        // Check if coupon is expired
        if (coupon.expiryDate < new Date()) {
            return res.status(400).json({ message: "❌ Coupon expired" });
        }

        // Check if usage limit is reached
        if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ message: "❌ Coupon usage limit reached" });
        }

        // Convert totalAmount to a number (to avoid string issues)
        const cartTotal = parseFloat(totalAmount);

        // Check if cart total meets the minimum purchase amount
        if (cartTotal < coupon.minPurchase) {
            return res.status(400).json({ message: `❌ Minimum purchase should be ₹${coupon.minPurchase}` });
        }

        // Calculate discount amount
        let discountAmount = 0;
        if (coupon.type === "percentage") {
            discountAmount = (cartTotal * coupon.discount) / 100;
            if (coupon.maxDiscount > 0 && discountAmount > coupon.maxDiscount) {
                discountAmount = coupon.maxDiscount; // Apply max discount limit
            }
        } else {
            discountAmount = coupon.discount; // Flat discount
        }

        // Calculate the new total after applying discount
        const newTotal = cartTotal - discountAmount;

        // Increment used count for the coupon
        await Coupon.updateOne({ code }, { $inc: { usedCount: 1 } });

        return res.json({ success: true, discountAmount, newTotal });
    } catch (error) {
        console.error("Error applying coupon:", error);
        return res.status(500).json({ message: "❌ Error applying coupon" });
    }
};



module.exports = {
    applyCoupon,
}